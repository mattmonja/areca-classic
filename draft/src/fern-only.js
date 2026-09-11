(function(){
  'use strict';
  const about=document.querySelector('#about'),panel=document.querySelector('#tune-panel'),adjust=document.querySelector('#tune');
  document.querySelector('#about-open').addEventListener('click',()=>about.showModal());
  about.addEventListener('click',event=>{
    if(event.target!==about)return;const box=about.getBoundingClientRect();
    if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)about.close();
  });
  const fern=window.ArecaBotanical.mount(document.querySelector('#fern-only'),{mature:true});
  if(!fern){document.querySelector('#study-status').textContent='The fern animation is unavailable in this browser.';document.querySelector('.play-controls').hidden=true;return;}
  const hash=new URLSearchParams(location.hash.slice(1)),settings={wind:.4,detail:.64};
  for(const key of['wind','detail']){const value=Number(hash.get(key));if(hash.has(key)&&Number.isFinite(value))settings[key]=Math.max(key==='detail'?.25:0,Math.min(1,value));}
  function apply(){
    fern.wind(settings.wind);fern.fullness(settings.detail);
    for(const key of['wind','detail']){document.querySelector('#'+key).value=settings[key];document.querySelector('#'+key+'-value').textContent=String(settings[key]);}
    const url=new URL(location.href);url.hash=new URLSearchParams(settings).toString();history.replaceState(null,'',url);
  }
  for(const key of['wind','detail'])document.querySelector('#'+key).addEventListener('input',event=>{settings[key]=Number(event.target.value);apply();});
  adjust.addEventListener('click',()=>{panel.hidden=!panel.hidden;adjust.setAttribute('aria-expanded',String(!panel.hidden));});
  document.querySelector('#regrow').addEventListener('click',()=>fern.regrow());
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){panel.hidden=true;adjust.setAttribute('aria-expanded','false');adjust.focus();}});
  apply();window.addEventListener('pagehide',event=>{if(!event.persisted)fern.destroy();});
})();
