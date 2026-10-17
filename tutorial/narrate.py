"""Turns out/narration.json into one WAV per scene using the offline Kokoro TTS model.

Usage: python3 narrate.py [--voice af_heart] [--speed 1.0]
Needs: pip install kokoro-onnx soundfile, plus kokoro-v1.0.int8.onnx and voices-v1.0.bin
(from https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0) in
$KOKORO_DIR (default: ./models).
"""
import argparse
import hashlib
import json
import os
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

HERE = Path(__file__).parent
OUT = HERE / "out"
AUDIO = OUT / "audio"

parser = argparse.ArgumentParser()
parser.add_argument("--voice", default="af_heart")
parser.add_argument("--speed", type=float, default=1.0)
args = parser.parse_args()

models = Path(os.environ.get("KOKORO_DIR", HERE / "models"))
kokoro = Kokoro(str(models / "kokoro-v1.0.int8.onnx"), str(models / "voices-v1.0.bin"))

AUDIO.mkdir(parents=True, exist_ok=True)
lines = json.loads((OUT / "narration.json").read_text())
durations_file = AUDIO / "durations.json"
durations = json.loads(durations_file.read_text()) if durations_file.exists() else {}
hashes_file = AUDIO / "hashes.json"
hashes = json.loads(hashes_file.read_text()) if hashes_file.exists() else {}

for line in lines:
    key = hashlib.sha1(f"{args.voice}|{args.speed}|{line['text']}".encode()).hexdigest()
    wav = AUDIO / f"{line['id']}.wav"
    if hashes.get(line["id"]) == key and wav.exists():
        continue
    samples, rate = kokoro.create(line["text"], voice=args.voice, speed=args.speed, lang="en-us")
    sf.write(wav, samples, rate)
    durations[line["id"]] = round(len(samples) / rate, 2)
    hashes[line["id"]] = key
    print(f"{line['id']}: {durations[line['id']]}s")

durations_file.write_text(json.dumps(durations, indent=2))
hashes_file.write_text(json.dumps(hashes, indent=2))
print(f"Narration ready: {len(lines)} clips")
