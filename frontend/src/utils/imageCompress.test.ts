import { describe, it, expect } from 'vitest';
import { planImageResize, renamedForType, MAX_DIMENSION } from './imageCompress';

const MB = 1024 * 1024;

describe('planImageResize — which uploads get shrunk', () => {
  it('a 6 MB 4000x3000 phone photo is resized to 1920 px on the long side, JPEG', () => {
    expect(planImageResize({ type: 'image/jpeg', size: 6 * MB, width: 4000, height: 3000 })).toEqual({
      compress: true, width: MAX_DIMENSION, height: 1440, outType: 'image/jpeg',
    });
  });
  it('portrait photos keep their orientation', () => {
    const p = planImageResize({ type: 'image/jpeg', size: 5 * MB, width: 3000, height: 4000 });
    expect([p.width, p.height]).toEqual([1440, 1920]);
  });
  it('a large PNG screenshot becomes JPEG (the server does not accept WebP)', () => {
    const p = planImageResize({ type: 'image/png', size: 3 * MB, width: 2880, height: 1800 });
    expect(p.compress).toBe(true);
    expect(p.outType).toBe('image/jpeg');
    expect(p.width).toBe(1920);
  });
  it('a big file that is already small in pixels is re-encoded but not upscaled', () => {
    const p = planImageResize({ type: 'image/jpeg', size: 2 * MB, width: 1600, height: 1200 });
    expect(p).toMatchObject({ compress: true, width: 1600, height: 1200 });
  });
  it('small images are left alone', () => {
    expect(planImageResize({ type: 'image/png', size: 270 * 1024, width: 1280, height: 800 }).compress).toBe(false);
  });
  it('non-images and GIFs are never touched', () => {
    expect(planImageResize({ type: 'application/pdf', size: 8 * MB, width: 0, height: 0 }).compress).toBe(false);
    expect(planImageResize({ type: 'image/gif', size: 8 * MB, width: 3000, height: 3000 }).compress).toBe(false);
    expect(planImageResize({ type: 'audio/webm', size: 3 * MB, width: 0, height: 0 }).compress).toBe(false);
  });
});

describe('renamedForType', () => {
  it('swaps the extension to match the new format', () => {
    expect(renamedForType('screenshot.png', 'image/jpeg')).toBe('screenshot.jpg');
    expect(renamedForType('photo.jpeg', 'image/jpeg')).toBe('photo.jpg');
    expect(renamedForType('noext', 'image/jpeg')).toBe('noext.jpg');
  });
});
