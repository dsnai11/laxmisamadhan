import { describe, it, expect } from 'vitest';
import { resolveSocketUrl } from './socketUrl';

describe('resolveSocketUrl — live updates connection', () => {
  it('web build without VITE_WS_URL uses the site origin, never port 3001', () => {
    const url = resolveSocketUrl({ isNative: false, origin: 'https://laxmisamadhan.lifc.in' });
    expect(url).toBe('https://laxmisamadhan.lifc.in');
    expect(url).not.toMatch(/:3001/);
  });
  it('local dev uses the dev server origin (Vite proxies /socket.io)', () => {
    expect(resolveSocketUrl({ isNative: false, origin: 'http://localhost:8003' })).toBe('http://localhost:8003');
  });
  it('native app uses the production URL', () => {
    expect(resolveSocketUrl({ isNative: true, origin: 'capacitor://localhost' })).toBe('https://laxmisamadhan.lifc.in');
  });
  it('an absolute VITE_WS_URL still overrides', () => {
    expect(resolveSocketUrl({ envWs: 'wss://ws.example.test', isNative: false, origin: 'https://x' })).toBe('wss://ws.example.test');
  });
  it('a relative/garbage VITE_WS_URL is ignored', () => {
    expect(resolveSocketUrl({ envWs: '/ws', isNative: false, origin: 'https://laxmisamadhan.lifc.in' })).toBe('https://laxmisamadhan.lifc.in');
  });
});
