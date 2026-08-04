/* Escola Piaget — service worker V1.6.0-rc2.2-visoes-operacionais */
const VERSION='1.6.0-rc2.2-visoes-operacionais';
const CACHE=`piaget-${VERSION}`;
const RELEASE='/releases/1.6.0-rc2.2-visoes-operacionais/';
const PRECACHE=[
  `${RELEASE}css/app.css`,
  `${RELEASE}js/00-portal-utils.js`,
  `${RELEASE}js/01-core.js`,
  `${RELEASE}js/02-operations.js`,
  `${RELEASE}js/03-cash.js`,
  `${RELEASE}js/04-brand.js`,
  `${RELEASE}js/05-auth.js`,
  `${RELEASE}js/06-notifications-navigation.js`,
  `${RELEASE}js/07-account-checkout.js`,
  `${RELEASE}js/08-orders-agenda.js`,
  `${RELEASE}js/09-portal-sales.js`,
  `${RELEASE}js/10-mobile-runtime.js`,
  `${RELEASE}js/11-bootstrap.js`,
  `${RELEASE}js/12-portal-finalization.js`,
  `${RELEASE}js/13-secretary-online-sales.js`,
  `${RELEASE}js/14-catalog-sales.js`,
  `${RELEASE}js/15-operational-views.js`,
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
      }).catch(()=>caches.match(request).then(hit=>hit||caches.match('/index.html')))
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
