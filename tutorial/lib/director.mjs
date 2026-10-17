// Drives one recorded video: each scene shows a caption, plays its narration
// clip (added later by the muxer at the recorded offset) and performs the UI
// actions, then holds until the narration has finished.
import { BASE_URL } from '../accounts.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Collects narration text without touching a browser (used by `--export`).
export class DryDirector {
  constructor(videoId) {
    this.videoId = videoId;
    this.lines = [];
  }
  async scene(text) {
    this.lines.push({ id: `${this.videoId}-${String(this.lines.length).padStart(2, '0')}`, text });
  }
  async hideCard() {}
  async badge() {}
}

export class Director {
  constructor({ videoId, page, durations, t0, log }) {
    this.videoId = videoId;
    this.page = page;
    this.durations = durations;
    this.t0 = t0;
    this.log = log;
    this.cues = [];
    this.count = 0;
  }

  now() { return (Date.now() - this.t0) / 1000; }

  async overlay(patch) {
    await this.page.evaluate((p) => window.__tut?.set(p), patch).catch(() => {});
  }

  async scene(text, actions = async () => {}, { pad = 0.6 } = {}) {
    const id = `${this.videoId}-${String(this.count++).padStart(2, '0')}`;
    const duration = this.durations[id] ?? text.split(/\s+/).length / 2.6;
    const start = this.now();
    this.cues.push({ id, start, text });
    await this.overlay({ caption: text });
    try {
      await actions();
    } catch (err) {
      this.log(`  ! ${id}: ${err.message.split('\n').filter((l) => /\S/.test(l)).slice(0, 3).join(' | ')}`);
    }
    const remaining = start + duration + pad - this.now();
    if (remaining > 0) await sleep(remaining * 1000);
    await this.highlight(null);
  }

  async titleCard(title, subtitle) { await this.overlay({ card: { title, subtitle }, caption: '' }); }
  async hideCard() { await this.overlay({ card: null }); }
  async badge(html) { await this.overlay({ badge: html }); }

  async highlight(locator) {
    if (!locator) return this.page.evaluate(() => window.__tut?.highlight(null)).catch(() => {});
    const box = await locator.boundingBox();
    if (box) await this.page.evaluate((b) => window.__tut?.highlight(b), box);
    return box;
  }

  async point(locator, { click = false } = {}) {
    await locator.waitFor({ state: 'visible', timeout: 10000 });
    await locator.scrollIntoViewIfNeeded();
    await sleep(250);
    const box = await this.highlight(locator);
    if (box) {
      await this.page.evaluate(([x, y]) => window.__tut?.cursor(x, y, false), [box.x + Math.min(box.width / 2, 60), box.y + box.height / 2]);
      await sleep(700);
      if (click) await this.page.evaluate(() => { const c = document.getElementById('tut-cursor'); c?.classList.remove('click'); void c?.offsetWidth; c?.classList.add('click'); });
    }
  }

  // Highlight something for a moment without clicking it.
  async show(locator, ms = 1500) {
    await this.point(locator);
    await sleep(ms);
  }

  async click(locator, { wait = 900 } = {}) {
    await this.point(locator, { click: true });
    await locator.click();
    await this.highlight(null);
    await sleep(wait);
  }

  async type(locator, text, { delay = 28 } = {}) {
    await this.point(locator, { click: true });
    await locator.click();
    await locator.pressSequentially(text, { delay });
    await this.highlight(null);
  }

  async select(locator, label) {
    await this.point(locator, { click: true });
    await locator.selectOption({ label });
    await this.highlight(null);
    await sleep(500);
  }

  // Click a sidebar entry by its visible name.
  async nav(name) {
    const link = this.page.locator('aside a, nav a').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`) }).first();
    await this.click(link, { wait: 1500 });
  }

  async goto(path) {
    await this.page.goto(BASE_URL + path);
    await this.page.waitForLoadState('domcontentloaded');
    await sleep(1500);
  }

  async scroll(y) {
    await this.page.mouse.wheel(0, y);
    await sleep(800);
  }

  async login({ email, password }) {
    const page = this.page;
    await this.type(page.locator('#email'), email, { delay: 18 });
    await this.type(page.locator('#password'), password, { delay: 18 });
    await this.click(page.locator('button[type=submit]'), { wait: 0 });
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 });
    await sleep(1500);
  }

  async logout() {
    await this.page.evaluate(() => { localStorage.clear(); });
  }
}
