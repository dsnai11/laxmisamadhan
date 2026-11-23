(async () => {
  const routes = ['/admin/dashboard','/admin/management-dashboard','/admin/tickets','/admin/approvals','/admin/users','/admin/departments','/admin/teams','/admin/sla','/admin/assets','/admin/knowledge','/admin/reports','/admin/settings','/admin/audit-logs','/admin/role-permissions','/raiser/dashboard','/raiser/create-ticket','/raiser/my-tickets','/raiser/knowledge','/raiser/profile','/agent/dashboard','/agent/queue','/agent/my-assignments','/agent/team-bucket'];
  const out = [];
  const go = async (p) => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); await new Promise(r=>setTimeout(r,2200)); };
  const sel = (e)=> e.tagName.toLowerCase() + (typeof e.className==='string' && e.className ? '.'+e.className.trim().split(/\s+/).slice(0,3).join('.') : '');
  const inScroller = (e)=>{ for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){ const o=getComputedStyle(p).overflowX; if((o==='auto'||o==='scroll'||o==='hidden') && p.scrollWidth>=p.clientWidth) return true;} return false; };
  const parse = c => { const m=c.match(/rgba?\(([^)]+)\)/); if(!m) return null; const p=m[1].split(',').map(s=>parseFloat(s)); return {r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}; };
  const lum = ({r,g,b}) => { const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const bgOf = (e)=>{ let acc=null; for(let p=e;p;p=p.parentElement){ const c=parse(getComputedStyle(p).backgroundColor); if(c&&c.a>0.05){ if(c.a>=0.95) return acc? mix(acc,c):c; acc=acc?mix(acc,c):c; } } const base=getComputedStyle(document.body).backgroundColor; return parse(base)||{r:255,g:255,b:255,a:1}; };
  const mix = (top,bot)=>({r:top.r*top.a+bot.r*(1-top.a),g:top.g*top.a+bot.g*(1-top.a),b:top.b*top.a+bot.b*(1-top.a),a:1});
  const ratio = (a,b)=>{const L1=lum(a),L2=lum(b);return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)};
  for (const r of routes) {
    await go(r);
    const W = innerWidth, de = document.documentElement;
    const off = [...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect(); return b.width>0 && b.right>W+1 && getComputedStyle(e).position!=='fixed' && !inScroller(e);}).slice(0,3).map(sel);
    const clipped = [...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect(); const cs=getComputedStyle(e); return b.width>0 && cs.overflow==='hidden' && cs.textOverflow==='ellipsis' && e.scrollWidth>e.clientWidth+1;}).slice(0,3).map(e=>(e.innerText||'').trim().slice(0,30));
    const low = []; const seen = new Set();
    for (const e of document.querySelectorAll('body *')) {
      if (![...e.childNodes].some(n=>n.nodeType===3 && n.textContent.trim().length>1)) continue;
      const b=e.getBoundingClientRect(); const cs=getComputedStyle(e);
      if (b.width===0||b.height===0||cs.visibility==='hidden'||cs.display==='none'||parseFloat(cs.opacity)<0.3) continue;
      const fg=parse(cs.color); if(!fg) continue; const bg=bgOf(e); const eff = fg.a<1? mix(fg,bg):fg;
      const cr=ratio(eff,bg);
      if (cr<3) { const t=e.textContent.trim().slice(0,28); if(!seen.has(t)) { seen.add(t); low.push(cr.toFixed(1)+' '+t); } }
    }
    const small = [...document.querySelectorAll('button,a[href],input,select,[role=button]')].filter(e=>{const b=e.getBoundingClientRect(); return b.width>0&&b.height>0&&getComputedStyle(e).visibility!=='hidden'&&(b.height<30||b.width<30)&&!['checkbox','radio','hidden'].includes(e.type);}).length;
    out.push({route:r, landed:location.pathname, dark:document.documentElement.classList.contains('dark'), hOverflow: de.scrollWidth>W+1?de.scrollWidth-W:0, offscreen:off, ellipsis:clipped, lowContrast:low.slice(0,6), small});
  }
  return {width:innerWidth, results:out};
})()
