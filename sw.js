const CACHE='hyuny-ai-v2';
const CORE=[
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/app-icon.svg',
  '/assets/characters/police-saver-mini.webp',
  '/assets/characters/robot-lab-poster-mini.webp',
  '/data/memory/creative-index.json'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(res=>{
    const copy=res.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return res;
  }).catch(()=>cached)));
});