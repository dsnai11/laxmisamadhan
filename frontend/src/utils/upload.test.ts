import { describe, it, expect } from 'vitest';
import { uploadSizeError, formatBytes, MAX_UPLOAD_BYTES } from './upload';

describe('uploadSizeError — check attachment size before sending', () => {
  it('blocks the 535 MB file seen in production with a clear message', () => {
    expect(uploadSizeError({ size: 534841405, name: 'video.mp4' })).toBe('"video.mp4" is 510.1 MB. The maximum attachment size is 25 MB.');
  });
  it('allows files up to exactly 25 MB', () => {
    expect(uploadSizeError({ size: MAX_UPLOAD_BYTES, name: 'a.pdf' })).toBeNull();
    expect(uploadSizeError({ size: 2 * 1024 * 1024, name: 'a.pdf' })).toBeNull();
  });
  it('blocks empty files', () => {
    expect(uploadSizeError({ size: 0, name: 'x.txt' })).toMatch(/empty/);
  });
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
