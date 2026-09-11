(function(){
  'use strict';
  const fern=window.ArecaBotanical.mount(document.querySelector('#fern-only'),{mature:true});
  if(!fern){document.querySelector('#fern-error').hidden=false;return;}
  const hash=new URLSearchParams(location.hash.slice(1)),settings={wind:.4,detail:.64};
  for(const key of['wind','detail']){const value=Number(hash.get(key));if(hash.has(key)&&Number.isFinite(value))settings[key]=Math.max(key==='detail'?.25:0,Math.min(1,value));}
  const panel=document.querySelector('#fern-settings'),adjust=document.querySelector('#adjust-fern');
  function apply(){
    fern.wind(settings.wind);fern.fullness(settings.detail);
    for(const key of['wind','detail']){document.querySelector('#fern-'+key).value=settings[key];document.querySelector('#'+key+'-value').textContent=String(settings[key]);}
    const url=new URL(location.href);url.hash=new URLSearchParams(settings).toString();history.replaceState(null,'',url);
  }
  for(const key of['wind','detail'])document.querySelector('#fern-'+key).addEventListener('input',event=>{settings[key]=Number(event.target.value);apply();});
  adjust.addEventListener('click',()=>{panel.hidden=!panel.hidden;adjust.setAttribute('aria-expanded',String(!panel.hidden));});
  document.querySelector('#regrow-fern').addEventListener('click',()=>fern.regrow());
  apply();window.addEventListener('pagehide',event=>{if(!event.persisted)fern.destroy();});
})();
