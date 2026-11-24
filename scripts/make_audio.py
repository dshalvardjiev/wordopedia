"""Create recordings for dictionary words that do not have one yet, for every language in languages.json.

Usage: python scripts/make_audio.py dictionary [voice_cache_dir]
Reads dictionary/languages.json; for each language it reads dictionary/<code>/words.csv and, for languages with
courses, dictionary/<code>/<course>/words.csv (plus verbs.csv and the lines of dialogues.json beside them), and writes dictionary/<code>/audio/<slug>.mp3 (shared by the courses)
using that language's Piper voice (downloaded from Hugging Face on first use).
Inactive languages are recorded too, so their audio is ready when they are switched on.
File names must match src/lib/audio.js: "der Affe" -> der-affe.mp3, "l'élève" -> l-eleve.mp3.
"""
import csv, json, os, re, subprocess, sys, tempfile, unicodedata, urllib.request, wave

HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/'
# Same as LANGS[code].articles in src/lib/langs.js; an article not listed here is ignored, as in the app.
ARTICLES = {'de': ['der', 'die', 'das'], 'fr': ['le', 'la', "l'", 'les'], 'en': []}
# Same as LANGS[code].pronouns in src/lib/langs.js: verbs.csv column and the words spoken before the form.
PRONOUNS = {'de': [('ich', 'ich'), ('du', 'du'), ('er', 'er, sie, es'), ('wir', 'wir'), ('ihr', 'ihr'), ('sie', 'sie')],
            'fr': [('je', 'je'), ('tu', 'tu'), ('il', 'il'), ('nous', 'nous'), ('vous', 'vous'), ('ils', 'ils')]}
# Same as LANGS[code].elide and parseVerbs() in src/lib/verbs.js: "je" + "ai" -> "j'ai" before a vowel or h.
ELIDE = {'fr': {'je': "j'"}}
VOWEL = re.compile(r"^[aeiouyàâäéèêëîïôöûùüœæh]", re.I)
APOS = str.maketrans({'’': "'", '`': "'", '´': "'", 'ʼ': "'"})

def slug(t):
    t = t.lower()
    for a, b in (('ä', 'ae'), ('ö', 'oe'), ('ü', 'ue'), ('ß', 'ss'), ('œ', 'oe'), ('æ', 'ae')):
        t = t.replace(a, b)
    t = ''.join(c for c in unicodedata.normalize('NFD', t) if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')

def join_art(art, word):
    if not art: return word
    return art + word if art.endswith("'") else art + ' ' + word

def texts_for(csv_path, code):
    out = []
    for r in csv.DictReader(open(csv_path, encoding='utf-8-sig')):
        word = (r.get('german') or r.get('foreign') or '').strip()
        art = (r.get('article') or '').strip().lower().translate(APOS)
        if art not in ARTICLES.get(code, []): art = ''
        if word: out.append(join_art(art, word))
    return list(dict.fromkeys(out))

def verb_texts(csv_path, code):
    # "ich fliege", "du fliegst", "er, sie, es fliegt", "j'ai", … for each verb in verbs.csv
    out = []
    for r in csv.DictReader(open(csv_path, encoding='utf-8-sig')):
        for col, say in PRONOUNS.get(code, []):
            form = ' '.join((r.get(col) or '').translate(APOS).split())
            if not form: continue
            e = ELIDE.get(code, {}).get(col)
            out.append(e + form if e and VOWEL.match(form) else f'{say} {form}')
    return out

def dialogue_texts(json_path):
    # Every line of every dialogue, as written (src/lib/dialogues.js plays them by their text).
    data = json.load(open(json_path, encoding='utf-8'))
    return [' '.join(str(x.get('text', '')).split()) for d in data.get('dialogues', []) for x in d.get('lines', []) if x.get('text')]

def voice_file(voice, cache):
    os.makedirs(cache, exist_ok=True)
    name = os.path.basename(voice)
    for ext in ('.onnx', '.onnx.json'):
        dst = os.path.join(cache, name + ext)
        if not os.path.exists(dst):
            print('downloading voice', name + ext)
            urllib.request.urlretrieve(HF + voice + ext, dst)
    return os.path.join(cache, name + '.onnx')

def main(root, cache='voice'):
    from piper import PiperVoice
    conf = json.load(open(os.path.join(root, 'languages.json'), encoding='utf-8'))
    for lang in conf['languages']:
        code, voice = lang['code'], lang.get('voice')
        paths = [os.path.join(root, code, 'words.csv')] + [os.path.join(root, code, c['id'], 'words.csv') for c in lang.get('courses', [])]
        paths = [p for p in paths if os.path.exists(p)]
        if not voice or not paths: continue
        out_dir = os.path.join(root, code, 'audio')
        texts = [t for p in paths for t in texts_for(p, code)]
        for d in [os.path.dirname(p) for p in paths]:
            vp = os.path.join(d, 'verbs.csv')
            if os.path.exists(vp): texts += verb_texts(vp, code)
            dp = os.path.join(d, 'dialogues.json')
            if os.path.exists(dp): texts += dialogue_texts(dp)
        texts = list(dict.fromkeys(texts))
        todo = [t for t in texts if not os.path.exists(os.path.join(out_dir, slug(t) + '.mp3'))]
        print(f'{code}: {len(todo)} new recording(s)')
        if not todo: continue
        os.makedirs(out_dir, exist_ok=True)
        v = PiperVoice.load(voice_file(voice, cache))
        with tempfile.TemporaryDirectory() as tmp:
            for t in todo:
                wav = os.path.join(tmp, 'x.wav'); mp3 = os.path.join(out_dir, slug(t) + '.mp3')
                with wave.open(wav, 'wb') as wf: v.synthesize_wav(t, wf)
                subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB',
                                '-ac', '1', '-b:a', '48k', mp3], check=True)
                print('  created', mp3)

if __name__ == '__main__':
    main(*sys.argv[1:3])
