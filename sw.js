/* Escola Piaget — service worker V1.6.0-rc2.7.20 */
const VERSION='1.6.0-rc2.7.20';
const CACHE=`piaget-${VERSION}`;
const RELEASE='/releases/1.6.0-rc2.7.20/';
const PRECACHE=[
  '/',
  '/index.html',
  '/equipe.html',
  '/meu-piaget.html',
  '/pagamento.html',
  '/obrigado.html',
  `${RELEASE}css/app.css`,
  '/assets/logo-piaget-icon-v152.png',
  '/assets/logo-piaget-horizontal-v152.png'
];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)).catch(()=>{}).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('piaget-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname==='/version.json'||url.pathname==='/sw.js'){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  if(request.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/obrigado.html'||url.pathname==='/pagamento.html'){
    event.respondWith(
      fetch(request,{cache:'no-store'}).then(response=>{
        const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});return response;
      }).catch(()=>caches.match(request).then(hit=>{if(hit)return hit;const familyHost=url.hostname==='meupiaget.com.br'||url.hostname==='www.meupiaget.com.br',fallback=(url.pathname==='/meu-piaget.html'||(familyHost&&(url.pathname==='/'||url.pathname==='/index.html')))?'/meu-piaget.html':url.pathname==='/equipe.html'?'/equipe.html':url.pathname==='/pagamento.html'?'/pagamento.html':url.pathname==='/obrigado.html'?'/obrigado.html':'/index.html';return caches.match(fallback)}))
    );
    return;
  }

  if(url.pathname.startsWith(RELEASE)){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});return response;}).catch(()=>caches.match(request)));
    return;
  }
  if(url.pathname.startsWith('/assets/')){
    event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});return response;})));
    return;
  }

  event.respondWith(fetch(request).catch(()=>caches.match(request)));
});
