import { describe, it, expect } from 'vitest';
import { buildVoiceFile, voiceFileName } from './voiceRecording';

const fmt = { mimeType: 'audio/webm', ext: 'webm' };

describe('voice recording file', () => {
  it('names the file with a timestamp and the right extension', () => {
    expect(voiceFileName('webm', new Date(2026, 10, 26, 13, 45, 7))).toBe('voice-message-20261126-134507.webm');
  });
  it('builds an audio File from the recorded chunks', () => {
    const f = buildVoiceFile([new Blob(['abc']), new Blob(['def'])], fmt)!;
    expect(f.size).toBe(6);
    expect(f.type).toBe('audio/webm');
    expect(f.name.endsWith('.webm')).toBe(true);
  });
  it('returns null for an empty recording', () => {
    expect(buildVoiceFile([], fmt)).toBeNull();
    expect(buildVoiceFile([new Blob([])], fmt)).toBeNull();
  });
});

import { uploadWithRetry } from './voiceRecording';
describe('uploadWithRetry', () => {
  const noWait = async () => {};
  it('succeeds first time', async () => {
    let n = 0;
    expect(await uploadWithRetry(async () => { n++; }, 3, noWait)).toBe(true);
    expect(n).toBe(1);
  });
  it('retries after failures and then succeeds', async () => {
    let n = 0;
    expect(await uploadWithRetry(async () => { if (++n < 3) throw new Error('x'); }, 3, noWait)).toBe(true);
    expect(n).toBe(3);
  });
  it('gives up after the attempts and reports failure', async () => {
    let n = 0;
    expect(await uploadWithRetry(async () => { n++; throw new Error('x'); }, 3, noWait)).toBe(false);
    expect(n).toBe(3);
  });
});
