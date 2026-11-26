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
