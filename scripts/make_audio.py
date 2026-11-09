"""Create recordings for dictionary words that do not have one yet, for every language in languages.json.

Usage: python scripts/make_audio.py dictionary [voice_cache_dir]
Reads dictionary/languages.json; for each language with words in dictionary/<code>/words.csv it writes
dictionary/<code>/audio/<slug>.mp3 using that language's Piper voice (downloaded from Hugging Face on first use).
Inactive languages are recorded too, so their audio is ready when they are switched on.
File names must match src/lib/audio.js: "der Affe" -> der-affe.mp3, "l'élève" -> l-eleve.mp3.
"""
import csv, json, os, re, subprocess, sys, tempfile, unicodedata, urllib.request, wave

HF = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/'
# Same as LANGS[code].articles in src/lib/langs.js; an article not listed here is ignored, as in the app.
ARTICLES = {'de': ['der', 'die', 'das'], 'fr': ['le', 'la', "l'", 'les'], 'en': []}
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
        csv_path = os.path.join(root, code, 'words.csv')
        if not voice or not os.path.exists(csv_path): continue
        out_dir = os.path.join(root, code, 'audio')
        todo = [t for t in texts_for(csv_path, code) if not os.path.exists(os.path.join(out_dir, slug(t) + '.mp3'))]
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
