"""Create German recordings for dictionary words that do not have one yet.

Usage: python scripts/make_audio.py dictionary/words.csv dictionary/audio <voice.onnx>
Voice: Piper "de_DE-thorsten-high" (https://huggingface.co/rhasspy/piper-voices).
File names match the app: "der Affe" -> der-affe.mp3.
"""
import csv, os, re, subprocess, sys, tempfile, wave

def slug(t):
    t = t.lower().replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
    return re.sub(r'[^a-z0-9]+', '-', t).strip('-')

def main(csv_path, out_dir, voice_path):
    from piper import PiperVoice
    rows = list(csv.DictReader(open(csv_path, encoding='utf-8-sig')))
    texts = []
    for r in rows:
        de = (r.get('german') or '').strip()
        art = (r.get('article') or '').strip().lower()
        if de: texts.append((art + ' ' + de).strip())
    os.makedirs(out_dir, exist_ok=True)
    todo = [t for t in dict.fromkeys(texts) if not os.path.exists(os.path.join(out_dir, slug(t) + '.mp3'))]
    if not todo:
        print('All words have recordings.'); return
    voice = PiperVoice.load(voice_path)
    with tempfile.TemporaryDirectory() as tmp:
        for t in todo:
            wav = os.path.join(tmp, 'x.wav'); mp3 = os.path.join(out_dir, slug(t) + '.mp3')
            with wave.open(wav, 'wb') as wf: voice.synthesize_wav(t, wf)
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB',
                            '-ac', '1', '-b:a', '48k', mp3], check=True)
            print('created', mp3)

if __name__ == '__main__':
    main(*sys.argv[1:4])
