// Stacks offline cache: the app shell, the PDF engine and the fonts, so the library opens with no connection.
const V='stacks-v4';
const CORE=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
const PDF='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const EXT=[PDF+'pdf.min.js',PDF+'pdf.worker.min.js'];
const FONTS='https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;0,7..72,700;1,7..72,400&display=swap';

async function put(c,url){try{const r=await fetch(url,{mode:'cors'});if(r.ok){await c.put(url,r.clone());return r}}catch(e){}return null}
self.addEventListener('install',e=>{e.waitUntil((async()=>{
 const c=await caches.open(V);await c.addAll(CORE);
 await Promise.all(EXT.map(u=>put(c,u)));
 const css=await put(c,FONTS);
 if(css){const t=await css.text();const urls=[...t.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m=>m[1]);await Promise.all(urls.map(u=>put(c,u)))}
 await self.skipWaiting();
})())});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==V)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener('fetch',e=>{
 const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.origin===location.origin){
  // App files: use the network when it's there (so updates arrive), the cache when it isn't.
  e.respondWith((async()=>{const c=await caches.open(V);try{const n=await fetch(r);if(n.ok)c.put(r,n.clone());return n}catch(err){return (await c.match(r,{ignoreSearch:true}))||(r.mode==='navigate'?await c.match('index.html'):Response.error())}})());
  return;
 }
 if(/^(cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname)){
  // PDF engine and fonts never change at a given URL: cache first.
  e.respondWith((async()=>{const c=await caches.open(V);const hit=await c.match(r.url);if(hit)return hit;try{const n=await fetch(r);if(n.ok||n.type==='opaque')c.put(r.url,n.clone());return n}catch(err){return Response.error()}})());
 }
});
