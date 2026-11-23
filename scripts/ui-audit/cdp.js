// Runs a JS file inside the Android app's WebView (emulator, debug build) and prints the result.
// Setup: adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof in.lifc.laxmisamadhan)
// Run:   cd frontend && node ../scripts/ui-audit/cdp.js ../scripts/ui-audit/audit_app.js
const WebSocket = require('ws');
const http = require('http'); const fs = require('fs');
http.get('http://localhost:9222/json', r => { let b=''; r.on('data',d=>b+=d); r.on('end',()=>{
  const t = JSON.parse(b).find(x=>x.type==='page'); const ws = new WebSocket(t.webSocketDebuggerUrl);
  ws.on('open',()=> ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:fs.readFileSync(process.argv[2],'utf8'),awaitPromise:true,returnByValue:true,timeout:170000}})));
  ws.on('message',m=>{const j=JSON.parse(m); if(j.id===1){ console.log(JSON.stringify(j.result?.result?.value ?? j.result ?? j.error, null, 1)); ws.close(); }});
});});
