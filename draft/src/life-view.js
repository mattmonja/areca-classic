(function(){
  'use strict';
  const canvas=document.querySelector('#life-canvas'),ctx=canvas.getContext('2d',{alpha:false});
  const composition=document.querySelector('#composition'),status=document.querySelector('#status');
  const pauseButton=document.querySelector('#pause-life'),textButton=document.querySelector('#text-toggle');
  const about=document.querySelector('#about');
  document.querySelector('#about-open').addEventListener('click',()=>about.showModal());
  if(!ctx){document.querySelector('#canvas-fallback').hidden=false;return;}
  const preset={
    cells:{params:{b1:.254,b2:.312,d1:.34,d2:.518,an:.028,am:.22,dt:.1},seed:621,steps:6,bg:[236,238,222],body:[100,149,108],edge:[29,76,48]},
    current:{params:{b1:.254,b2:.312,d1:.34,d2:.518,an:.018,am:.147,dt:.1},seed:871,steps:8,bg:[9,29,27],body:[58,103,78],edge:[169,190,130]},
    type:{params:{b1:.265,b2:.323,d1:.34,d2:.518,an:.028,am:.147,dt:.1},seed:241,steps:5,bg:[239,234,218],body:[92,126,83],edge:[26,63,40]}
  };
  const params=new URLSearchParams(location.search);
  let look=Object.hasOwn(preset,params.get('look'))?params.get('look'):'current';
  let model,display,offscreen=document.createElement('canvas'),offctx=offscreen.getContext('2d');
  const layer=document.createElement('canvas'),layerctx=layer.getContext('2d');
  let image,width=1,height=1,dpr=1,frame=0,last=0,accumulator=0,drawDown=false,pointer=null,seedOffset=0,steps=3;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let paused=media.matches,showType=true;
  const blend=(a,b,t)=>a+(b-a)*t;
  const clamp=v=>Math.max(0,Math.min(1,v));
  function updatePause(){pauseButton.textContent=paused?'Resume':'Pause';pauseButton.setAttribute('aria-pressed',String(paused));document.querySelector('#interaction-note').textContent=paused?'Paused — press Resume to animate':'Drag to add life';}
  function setupModel(){
    const gridWidth=Math.round(Math.max(140,Math.min(280,width*.22))),gridHeight=Math.round(Math.max(100,Math.min(220,gridWidth*height/width)));
    model=new window.ArecaLife.LifeModel(gridWidth,gridHeight,preset[look].params,preset[look].seed+seedOffset);
    // Start with an established culture; the following frames remain a live simulation.
    for(let i=0;i<22;i++)model.step();
    display=new Float32Array(model.state);offscreen.width=gridWidth;offscreen.height=gridHeight;
    image=offctx.createImageData(gridWidth,gridHeight);
  }
  function draw(){
    const {bg,body,edge}=preset[look],state=model.state,pixels=image.data,w=model.width,h=model.height;
    for(let i=0;i<state.length;i++)display[i]=display[i]*.62+state[i]*.38;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const i=y*w+x,v=display[i],right=display[y*w+(x+1)%w],down=display[((y+1)%h)*w+x];
      const gradient=Math.min(1,(Math.abs(v-right)+Math.abs(v-down))*2.2);
      const density=look==='current'?Math.pow(v,.7)*.8:Math.pow(v,.86)*.82;
      const line=look==='current'?gradient*.8:gradient*.32;
      for(let c=0;c<3;c++)pixels[i*4+c]=blend(blend(bg[c],body[c],density),edge[c],line);
      pixels[i*4+3]=255;
    }
    offctx.putImageData(image,0,0);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=`rgb(${bg.join(',')})`;ctx.fillRect(0,0,width,height);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    if(look==='type'&&showType){
      layerctx.setTransform(dpr,0,0,dpr,0,0);layerctx.clearRect(0,0,width,height);
      layerctx.globalCompositeOperation='source-over';layerctx.drawImage(offscreen,0,0,width,height);
      layerctx.globalCompositeOperation='destination-in';
      const size=Math.min(width*.36,640),baseline=height*.57;
      layerctx.font=`400 ${size}px Georgia`;layerctx.textAlign='center';layerctx.fillStyle='#000';
      layerctx.fillText('areca',width*.5,baseline,width*.92);
      ctx.drawImage(layer,0,0,width,height);
      ctx.font=`400 ${size}px Georgia`;ctx.textAlign='center';ctx.strokeStyle='rgba(26,63,40,.35)';ctx.lineWidth=.65;ctx.strokeText('areca',width*.5,baseline,width*.92);
    }else ctx.drawImage(offscreen,0,0,width,height);
  }
  function tick(now){
    frame=0;if(paused||document.hidden){last=0;return;}
    if(!last)last=now;
    accumulator+=Math.min(80,now-last);last=now;
    if(accumulator>=1000/30){
      if(drawDown&&pointer)model.brush(pointer.x,pointer.y,6,pointer.erase);
      const computeStart=performance.now(),budget=width<700?12:23;
      for(let n=0;n<steps;n++){model.step();if(performance.now()-computeStart>=budget)break;}
      draw();accumulator%=1000/30;
    }
    frame=requestAnimationFrame(tick);
  }
  function run(){if(!frame&&!paused&&!document.hidden)frame=requestAnimationFrame(tick);}
  function resize(){
    const r=composition.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,1.5);
    canvas.width=layer.width=Math.round(width*dpr);canvas.height=layer.height=Math.round(height*dpr);
    if(!model)setupModel();draw();run();
  }
  function choose(next){
    look=next;document.body.dataset.look=look;composition.className='composition '+(look==='current'?'current-mode':look==='type'?'type-mode':'');
    if(!showType)composition.classList.add('type-hidden');
    document.querySelectorAll('[data-look]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.look===look));});
    steps=preset[look].steps;document.querySelector('#pace').value=steps;
    setupModel();draw();run();
    const u=new URL(location);u.searchParams.set('look',look);history.replaceState(null,'',u);
    status.textContent=next+' draft selected.';
  }
  document.querySelectorAll('.draft-options button').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.look)));
  pauseButton.addEventListener('click',()=>{paused=!paused;updatePause();cancelAnimationFrame(frame);frame=0;last=0;run();});
  document.querySelector('#seed-life').addEventListener('click',()=>{seedOffset+=127;setupModel();draw();run();status.textContent='New starting pattern.';});
  document.querySelector('#pace').addEventListener('input',e=>{steps=Number(e.target.value);});
  textButton.addEventListener('click',()=>{showType=!showType;composition.classList.toggle('type-hidden',!showType);textButton.textContent=showType?'Hide type':'Show type';textButton.setAttribute('aria-pressed',String(!showType));draw();});
  function seedAt(event){const r=canvas.getBoundingClientRect();pointer={x:clamp((event.clientX-r.left)/r.width),y:clamp((event.clientY-r.top)/r.height),erase:event.shiftKey};model.brush(pointer.x,pointer.y,6,pointer.erase);draw();}
  canvas.addEventListener('pointerdown',event=>{drawDown=true;canvas.setPointerCapture(event.pointerId);seedAt(event);});
  canvas.addEventListener('pointermove',event=>{if(drawDown)seedAt(event);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(event=>canvas.addEventListener(event,()=>{drawDown=false;pointer=null;}));
  document.addEventListener('visibilitychange',()=>{last=0;run();});
  media.addEventListener('change',()=>{paused=media.matches;updatePause();cancelAnimationFrame(frame);frame=0;last=0;run();});
  const observer=new ResizeObserver(resize);observer.observe(composition);
  resize();choose(look);updatePause();
  const lifecycle=new AbortController();
  if(document.modelContext?.registerTool){
    try{
      Promise.resolve(document.modelContext.registerTool({
        name:'configure_life_draft',title:'Configure living draft',
        description:'Select one of the three Areca living drafts and set its visible pace or pause state.',
        inputSchema:{type:'object',properties:{look:{type:'string',enum:['cells','current','type']},pace:{type:'integer',minimum:1,maximum:8},paused:{type:'boolean'}},additionalProperties:false},
        annotations:{readOnlyHint:false,untrustedContentHint:false},
        execute(input){
          if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected an object.');
          if(Object.keys(input).some(k=>!['look','pace','paused'].includes(k)))throw new Error('Unknown setting.');
          if(input.look!==undefined&&!Object.hasOwn(preset,input.look))throw new Error('Unknown draft.');
          if(input.pace!==undefined&&(!Number.isInteger(input.pace)||input.pace<1||input.pace>8))throw new Error('Pace must be 1–8.');
          if(input.paused!==undefined&&typeof input.paused!=='boolean')throw new Error('Paused must be boolean.');
          if(input.look!==undefined)choose(input.look);
          if(input.pace!==undefined){steps=input.pace;document.querySelector('#pace').value=steps;}
          if(input.paused!==undefined){paused=input.paused;updatePause();cancelAnimationFrame(frame);frame=0;last=0;run();}
          return {look,pace:steps,paused};
        }
      },{signal:lifecycle.signal})).catch(()=>{});
    }catch{}
  }
  window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(!event.persisted){observer.disconnect();lifecycle.abort();}});
  window.addEventListener('pageshow',event=>{if(event.persisted){last=0;resize();run();}});
})();
