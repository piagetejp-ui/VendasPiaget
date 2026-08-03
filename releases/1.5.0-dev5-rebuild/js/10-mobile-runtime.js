/* Escola Piaget — V1.5.0-dev5-rebuild
   Runtime único de viewport, navegação mobile e apresentação responsiva. */
(function(){
  'use strict';
  const VERSION='1.5.0-dev5-rebuild';

  function setViewportHeight(){
    const height=Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0);
    if(height>0)document.documentElement.style.setProperty('--app-height',`${height}px`);
  }

  function tableIsReport(table){
    return !!table.closest('#reportHost,.wa-report,.report-sheet,[data-no-mobile-cards]');
  }

  function enhanceTable(table){
    if(!table||table.dataset.mobileEnhanced==='1'||tableIsReport(table))return;
    const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    if(!headers.length)return;
    table.classList.add('mobile-card-table');
    table.querySelectorAll('tbody tr').forEach(row=>{
      [...row.children].forEach((cell,index)=>{
        if(cell.tagName!=='TD')return;
        if(Number(cell.getAttribute('colspan')||1)>1)return;
        cell.dataset.label=headers[index]||`Campo ${index+1}`;
      });
    });
    table.dataset.mobileEnhanced='1';
  }

  function enhanceTables(root=document){
    root.querySelectorAll?.('table').forEach(enhanceTable);
  }

  function injectVersionInSidebar(){
    const sidebar=document.getElementById('sidebar');
    if(!sidebar)return;
    let badge=sidebar.querySelector('.mobile-version-badge');
    if(!badge){
      badge=document.createElement('div');
      badge.className='mobile-version-badge';
      badge.style.cssText='font-size:10px;color:var(--muted);padding:8px 11px 0;word-break:break-word';
      sidebar.appendChild(badge);
    }
    badge.textContent=`Versão ${VERSION}`;
  }

  function syncMobileControls(){
    const internal=!!window.state?.user;
    const parent=!!window.state?.parentStudent&&!internal;
    const btn=document.getElementById('v151MenuBtn');
    if(btn)btn.classList.toggle('hidden',!internal);
    if(parent){
      try{window.closeMobileMenuV151?.()}catch(e){}
    }
    if(internal)injectVersionInSidebar();
  }

  async function registerServiceWorker(){
    if(!('serviceWorker'in navigator)||location.protocol==='file:')return;
    try{
      const registration=await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(VERSION)}`,{scope:'/',updateViaCache:'none'});
      registration.update().catch(()=>{});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(window.__piagetSwReloading)return;
        window.__piagetSwReloading=true;
        location.reload();
      });
    }catch(error){console.warn('service-worker',error?.message||error)}
  }

  function init(){
    setViewportHeight();
    enhanceTables();
    syncMobileControls();
    registerServiceWorker();

    const observer=new MutationObserver(mutations=>{
      for(const mutation of mutations){
        mutation.addedNodes.forEach(node=>{
          if(node.nodeType!==1)return;
          if(node.matches?.('table'))enhanceTable(node);
          enhanceTables(node);
        });
      }
      syncMobileControls();
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

    window.addEventListener('resize',setViewportHeight,{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(setViewportHeight,100),{passive:true});
    window.visualViewport?.addEventListener('resize',setViewportHeight,{passive:true});
    window.visualViewport?.addEventListener('scroll',setViewportHeight,{passive:true});
    window.addEventListener('pageshow',event=>{
      setViewportHeight();syncMobileControls();enhanceTables();
      if(event.persisted)window.checkPublishedVersionClean?.({forceReload:true});
    });
    window.addEventListener('online',()=>window.checkPublishedVersionClean?.());
    document.addEventListener('keydown',event=>{if(event.key==='Escape')window.closeMobileMenuV151?.()});
  }

  window.PIAGET_APP_VERSION=VERSION;
  window.refreshPiagetResponsiveUI=()=>{setViewportHeight();enhanceTables();syncMobileControls()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
