// Injected into every page before the app loads. Draws the tutorial chrome
// (role badge, caption bar, title card, highlight box, fake cursor) on top of
// the app. State lives in sessionStorage so it survives full page loads.
(() => {
  const KEY = '__tutorial_overlay';
  const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = (s) => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

  const css = `
    #tut-root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483647; font-family: Inter, 'Noto Sans Devanagari', system-ui, sans-serif; }
    #tut-badge { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); background: #111827e6; color: #fff;
      padding: 6px 16px; border-radius: 999px; font-size: 15px; font-weight: 600; letter-spacing: .02em; box-shadow: 0 4px 14px #0004; }
    #tut-badge b { color: #fca5a5; font-weight: 700; }
    #tut-caption { position: absolute; left: 50%; bottom: 28px; transform: translateX(-50%); max-width: 78%;
      background: #111827eb; color: #fff; padding: 14px 24px; border-radius: 14px; font-size: 22px; line-height: 1.4;
      text-align: center; box-shadow: 0 8px 28px #0005; transition: opacity .25s; }
    #tut-caption:empty { opacity: 0; }
    #tut-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: radial-gradient(circle at 30% 20%, #b91c1c, #450a0a); color: #fff; transition: opacity .5s; }
    #tut-card h1 { font-size: 64px; margin: 0 0 12px; font-weight: 800; }
    #tut-card p { font-size: 28px; margin: 0; opacity: .85; }
    #tut-card small { margin-top: 36px; font-size: 18px; opacity: .7; }
    #tut-hl { position: absolute; border: 4px solid #f59e0b; border-radius: 10px; box-shadow: 0 0 0 9999px #0000001f, 0 0 18px #f59e0b;
      transition: all .35s ease; }
    #tut-cursor { position: absolute; width: 26px; height: 26px; margin: -4px 0 0 -4px; transition: left .6s ease, top .6s ease; }
    #tut-cursor.click::after { content: ''; position: absolute; left: -10px; top: -10px; width: 44px; height: 44px; border-radius: 50%;
      background: #f59e0b66; animation: tut-ping .5s ease-out; }
    @keyframes tut-ping { from { transform: scale(.3); opacity: 1 } to { transform: scale(1.4); opacity: 0 } }
  `;

  function ensure() {
    if (!document.body) return null;
    let root = document.getElementById('tut-root');
    if (root) return root;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.id = 'tut-root';
    root.innerHTML = `<div id="tut-badge" hidden></div><div id="tut-caption"></div><div id="tut-hl" hidden></div>
      <svg id="tut-cursor" viewBox="0 0 24 24"><path d="M3 2l7 19 2.6-7.4L20 11z" fill="#111" stroke="#fff" stroke-width="1.6"/></svg>`;
    document.body.appendChild(root);
    render();
    return root;
  }

  function render() {
    const s = read();
    const root = document.getElementById('tut-root');
    if (!root) return;
    const badge = root.querySelector('#tut-badge');
    badge.hidden = !s.badge;
    badge.innerHTML = s.badge || '';
    root.querySelector('#tut-caption').textContent = s.caption || '';
    let card = root.querySelector('#tut-card');
    if (s.card && !card) {
      card = document.createElement('div');
      card.id = 'tut-card';
      root.prepend(card);
    }
    if (card) {
      if (s.card) card.innerHTML = `<h1>${s.card.title}</h1><p>${s.card.subtitle || ''}</p><small>${s.card.brand || 'Laxmi Samadhan · IT Service Desk tutorial'}</small>`;
      else card.remove();
    }
    const cur = root.querySelector('#tut-cursor');
    cur.style.left = (s.cx ?? window.innerWidth / 2) + 'px';
    cur.style.top = (s.cy ?? window.innerHeight / 2) + 'px';
  }

  window.__tut = {
    set(patch) { write({ ...read(), ...patch }); ensure(); render(); },
    highlight(box) {
      ensure();
      const hl = document.getElementById('tut-hl');
      if (!box) { hl.hidden = true; return; }
      const pad = 6;
      Object.assign(hl.style, { left: box.x - pad + 'px', top: box.y - pad + 'px', width: box.width + pad * 2 + 'px', height: box.height + pad * 2 + 'px' });
      hl.hidden = false;
    },
    cursor(x, y, click) {
      ensure();
      write({ ...read(), cx: x, cy: y });
      const cur = document.getElementById('tut-cursor');
      cur.style.left = x + 'px';
      cur.style.top = y + 'px';
      if (click) { cur.classList.remove('click'); void cur.offsetWidth; cur.classList.add('click'); }
    },
  };

  // Hide dev-only widgets that would otherwise appear in the recording.
  const hideDevTools = document.createElement('style');
  hideDevTools.textContent = '.tsqd-open-btn-container, .tsqd-parent-container, button[aria-label="Open Tanstack query devtools"] { display: none !important; }';

  const boot = () => { document.head.appendChild(hideDevTools); ensure(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  new MutationObserver(() => { if (!document.getElementById('tut-root')) ensure(); })
    .observe(document.documentElement, { childList: true, subtree: true });
})();
