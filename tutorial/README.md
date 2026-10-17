# Automated role-by-role tutorial videos

Generates narrated screen-recording tutorials of Laxmi Samadhan, one per role,
plus a joined full-length video. Playwright drives the real app, an overlay
adds captions, a role badge, a pointer and highlight boxes, and an offline
text-to-speech model (Kokoro) voices the narration.

| Video | Account used |
|-------|--------------|
| `01-raiser.mp4` | john.doe@company.com |
| `02-viewer.mp4` | viewer@company.com (created by `setup.mjs`) |
| `03-agent.mp4` | agent.hardware@ticketportal.local |
| `04-team-lead.mp4` | lead.hardware@ticketportal.local (created by `setup.mjs`) |
| `05-department-head.mp4` | hardware.head@ticketportal.local |
| `06-admin.mp4` | admin@ticketportal.local |

The videos follow one ticket from start to finish. The Raiser raises "Wireless mouse not working",
the Agent takes it and requests approval, the Team Lead approves it, and the Department
Head resolves it.

## Prerequisites

- Backend and frontend running against a **throwaway** database
  (`make-videos.sh` wipes and re-seeds it). The frontend must call the local API:
  `VITE_API_URL=http://localhost:8003/api/v1 VITE_WS_URL=http://localhost:3001 npx vite --port 8003`,
  with the backend on `PORT=3001` and `FRONTEND_URL=http://localhost:8003`.
- `ffmpeg`, Node 18+, Python 3.
- `npm install` here (Playwright). Set `CHROMIUM_PATH` if you use a system Chromium.
- `pip install kokoro-onnx soundfile`, then download `kokoro-v1.0.int8.onnx` and
  `voices-v1.0.bin` from the
  [kokoro-onnx model release](https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0)
  into `tutorial/models/`.

## Run

```bash
./make-videos.sh             # reset data, narrate, record, mux, join
./make-videos.sh --keep-db   # same, without resetting the database
node record.mjs --only 03-agent   # re-record one video (needs earlier videos' data)
```

Output goes to `out/videos/*.mp4` and `out/laxmi-samadhan-full-tutorial.mp4`.

### Hindi (and other languages)

```bash
./make-videos.sh --lang hi   # -> out/hi/videos/*.mp4, out/hi/laxmi-samadhan-full-tutorial-hi.mp4
```

Captions, title cards, the role badge and narration come from `i18n/hi.json`
(keyed by scene id, e.g. `03-agent-05`). The app UI itself stays in English.
Hindi uses the Kokoro `hf_alpha` voice; `hf_beta`, `hm_omega` and `hm_psi` also
work (`python3 narrate.py --lang hi --voice hm_omega`). Captions need a
Devanagari font (`apt-get install fonts-noto-core`).

To add a language, copy `i18n/hi.json`, translate every scene, and set `voice`
and `ttsLang` to a Kokoro voice/language. `record.mjs --export` fails if any
scene is missing a translation.

## Editing

- Narration and steps for each role are in `scenes.mjs`. Each `d.scene(text, actions)` is
  one caption plus its voice-over. The scene lasts as long as its narration.
- After changing narration text, run `node record.mjs --export && python3 narrate.py`.
  Only changed lines are re-synthesised.
- Change the voice with `python3 narrate.py --voice am_michael` (Kokoro voice list) or
  `--speed 0.95`.
- `lib/overlay.js` controls the on-screen styling (captions, badge, title cards).
