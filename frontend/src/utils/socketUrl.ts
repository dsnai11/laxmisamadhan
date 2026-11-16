// Where the browser opens the Socket.IO (live updates) connection.
// Web: the site's own origin — nginx proxies /socket.io/ to the backend (laxmisamadhan.conf), and
// the Vite dev server proxies it too. Port 3001 is NOT reachable from outside, so the old fallback
// "https://<host>:3001" timed out on every page (live updates silently broken). Native apps load
// from capacitor://, so they use the production URL. VITE_WS_URL (absolute) still overrides.
export const PRODUCTION_ORIGIN = 'https://laxmisamadhan.lifc.in';

export function resolveSocketUrl(opts: { envWs?: string; isNative: boolean; origin?: string }): string {
  const env = (opts.envWs || '').trim();
  if (/^(https?|wss?):\/\//.test(env)) return env;
  if (opts.isNative) return PRODUCTION_ORIGIN;
  return opts.origin || PRODUCTION_ORIGIN;
}
