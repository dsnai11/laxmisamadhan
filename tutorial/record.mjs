// Records every tutorial video with Playwright, then muxes in the narration.
//   node record.mjs --export          write out/narration.json (input for narrate.py)
//   node record.mjs [--only 03-agent] record + mux into out/videos/*.mp4
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_URL } from './accounts.mjs';
import { videos } from './scenes.mjs';
import { Director, DryDirector } from './lib/director.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'out');
const AUDIO = path.join(OUT, 'audio');
const RAW = path.join(OUT, 'raw');
const VIDEOS = path.join(OUT, 'videos');
const VIEWPORT = { width: 1600, height: 900 };
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;

fs.mkdirSync(OUT, { recursive: true });

if (args.includes('--export')) {
  const lines = [];
  for (const v of videos) {
    const d = new DryDirector(v.id);
    await v.run.call(v, d, {});
    lines.push(...d.lines);
  }
  fs.writeFileSync(path.join(OUT, 'narration.json'), JSON.stringify(lines, null, 2));
  console.log(`Wrote ${lines.length} narration lines to out/narration.json`);
  process.exit(0);
}

const durationsFile = path.join(AUDIO, 'durations.json');
const durations = fs.existsSync(durationsFile) ? JSON.parse(fs.readFileSync(durationsFile, 'utf8')) : {};
if (!Object.keys(durations).length) console.warn('No narration found - run narrate.py first. Recording silent videos.');

for (const dir of [RAW, VIDEOS]) fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-proxy-server', '--hide-scrollbars'],
});
const stateFile = path.join(OUT, 'state.json');
const state = only && fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : {};
const overlay = fs.readFileSync(path.join(here, 'lib/overlay.js'), 'utf8');

for (const v of videos) {
  if (only && !only.includes(v.id)) continue;
  console.log(`Recording ${v.id}...`);
  await v.prepare?.(state);
  const context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: RAW, size: VIEWPORT } });
  await context.addInitScript(overlay);
  const page = await context.newPage();
  const t0 = Date.now();
  const d = new Director({ videoId: v.id, page, durations, t0, log: console.log });

  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await d.titleCard(v.title, v.subtitle);
  await page.waitForTimeout(400);
  const start = d.now();
  await page.waitForTimeout(1200);

  await v.run.call(v, d, state);
  fs.writeFileSync(stateFile, JSON.stringify(state));
  await page.waitForTimeout(1500);
  const end = d.now();

  const video = page.video();
  await context.close();
  const raw = path.join(RAW, `${v.id}.webm`);
  fs.renameSync(await video.path(), raw);
  fs.writeFileSync(path.join(RAW, `${v.id}.cues.json`), JSON.stringify(d.cues, null, 2));

  mux(v.id, raw, d.cues, start, end);
}
await browser.close();

// Trim the blank lead-in, lay each narration clip at the time its scene began,
// scale to 1080p and write an H.264/AAC mp4.
function mux(id, raw, cues, start, end) {
  const out = path.join(VIDEOS, `${id}.mp4`);
  const clips = cues.filter((c) => fs.existsSync(path.join(AUDIO, `${c.id}.wav`)));
  const inputs = ['-y', '-ss', start.toFixed(2), '-t', (end - start).toFixed(2), '-i', raw];
  const filters = ['[0:v]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p[v]'];
  clips.forEach((c, i) => {
    inputs.push('-i', path.join(AUDIO, `${c.id}.wav`));
    const ms = Math.max(0, Math.round((c.start - start) * 1000));
    filters.push(`[${i + 1}:a]aresample=48000,adelay=${ms}|${ms}[a${i}]`);
  });
  const audioMap = [];
  if (clips.length) {
    filters.push(`${clips.map((_, i) => `[a${i}]`).join('')}amix=inputs=${clips.length}:normalize=0:duration=longest,apad=whole_dur=${(end - start).toFixed(2)}[a]`);
    audioMap.push('-map', '[a]', '-c:a', 'aac', '-b:a', '160k');
  }
  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    ...inputs, '-filter_complex', filters.join(';'), '-map', '[v]', ...audioMap, '-t', (end - start).toFixed(2),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', out,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`  -> ${path.relative(here, out)}`);
}
