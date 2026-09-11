(function(){
  'use strict';
  const scene=document.querySelector('#composition'),front=document.querySelector('#flock-front'),back=document.querySelector('#flock-back'),palmCanvas=document.querySelector('#palm-canvas');
  const ctx=front.getContext('2d'),rear=back.getContext('2d'),status=document.querySelector('#status');
  const textButton=document.querySelector('#text-toggle'),paletteButton=document.querySelector('#palette'),panel=document.querySelector('#adjust-panel');
  const note=document.querySelector('#save-note'),keepButton=document.querySelector('#keep-settings'),about=document.querySelector('#about');
  document.querySelector('#about-open').addEventListener('click',()=>about.showModal());
  if(!ctx||!rear){document.querySelector('#canvas-fallback').hidden=false;return;}
  const schema=window.ArecaFlockSettings,storageKey='areca-palm-flock-v2',savedKey=storageKey+'-kept';
  let stored={};try{stored=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{}
  const hash=new URLSearchParams(location.hash.slice(1)),linked=hash.get('v')==='2';
  let settings=schema.normalize(linked?Object.fromEntries(hash):stored.settings);
  let night=linked?hash.get('night')==='1':!!stored.night,showType=linked?hash.get('type')!=='0':stored.showType!==false;
  let seed=Number(linked?hash.get('seed'):stored.seed);if(!Number.isInteger(seed)||seed<1||seed>2147483647)seed=712;
  let kept=linked?hash.get('kept')==='1':!!stored.kept;
  let preferred=null;try{preferred=JSON.parse(localStorage.getItem(savedKey)||'null');}catch{}
  document.querySelector('#restore-settings').hidden=!preferred;
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let width=1,height=1,dpr=1,scale=1,model,fern,frame=0,last=null,accumulator=0,lastPalmTime=-Infinity;
  const pointer={active:false,attract:false,x:0,y:0},look={x:0,y:0,targetX:0,targetY:0};
  const step=1/60,order=[],inputs=new Map();let panelOpen=true;
  const colors={day:[['#1e432f','#396546','#6e9060','#a8b781'],['#3e5639','#6b784b','#96995f','#c1be89'],['#315e58','#527d6b','#7e9b7c','#bdc3a3']],night:[['#9ba868','#c2cb8b','#e2e5b2','#f1eed0'],['#78968c','#a3b5a1','#c6ceab','#e3dfb6'],['#69835a','#9bad71','#c0cd8a','#e7e4ae']]};
  function snapshot(){return{version:2,settings:{...settings},seed,night,showType,kept};}
  function sync(message){
    const values=new URLSearchParams({v:'2',seed:String(seed),night:night?'1':'0',type:showType?'1':'0',kept:kept?'1':'0'});
    for(const[key,value]of Object.entries(settings))values.set(key,String(value));
    const url=new URL(location.href);url.hash=values.toString();history.replaceState(null,'',url);
    try{localStorage.setItem(storageKey,JSON.stringify(snapshot()));}catch{}
    keepButton.textContent=kept?'Kept':'Keep this';
    note.textContent=message||(kept?'This version is kept. Its exact settings are in the link.':'Settings save as you adjust.');
  }
  function project(x,y,z){
    const depth=z/settings.depth,denominator=Math.max(.13,1-settings.perspective*.85*depth),perspective=1/denominator;
    return[width*.5+x*scale*perspective+look.x*settings.parallax*depth*perspective,height*.5-y*scale*perspective+look.y*settings.parallax*depth*perspective];
  }
  function tint(hex,z){
    const haze=Math.max(0,Math.min(1,(1-z/settings.depth)*.5))*settings.haze,paper=night?[20,37,30]:[238,238,222];
    const rgb=[1,3,5].map((start,c)=>Math.round(parseInt(hex.slice(start,start+2),16)*(1-haze)+paper[c]*haze));
    return `rgb(${rgb.join(',')})`;
  }
  function drawBird(i,target){
    const k=i*3,t=i*4,p=model.position,v=model.velocity,traits=model.traits,perched=model.mode[i]===2;
    const anchorX=p[k],anchorY=p[k+1],z=p[k+2],perspectiveDenom=1-settings.perspective*.85*z/settings.depth;
    if(perspectiveDenom<.17)return;
    const size=settings.size*(1+traits[t+2]*settings.variation*.72);
    let x=anchorX,y=anchorY;
    const speed=Math.hypot(v[k],v[k+1],v[k+2]);
    const facing=Math.cos(traits[t+1])>0?1:-1;
    const fx=perched?facing*.45:v[k]/Math.max(speed,.001),fy=perched?.893:v[k+1]/Math.max(speed,.001),fz=perched?0:v[k+2]/Math.max(speed,.001),flat=Math.hypot(fx,fy);
    if(perched)y+=size*.72;
    const rx=flat>.001?-fy/flat:1,ry=flat>.001?fx/flat:0,ux=-fz*ry,uy=fz*rx,uz=fx*ry-fy*rx;
    const bank=perched?0:model.bank[i]*settings.banking,cb=Math.cos(bank),sb=Math.sin(bank);
    const sx=rx*cb+ux*sb,sy=ry*cb+uy*sb,sz=uz*sb,nx=ux*cb-rx*sb,ny=uy*cb-ry*sb,nz=uz*cb;
    const beat=model.time*(7.2+traits[t]*1.8)+traits[t+1],flap=perched?0:Math.sin(beat)*settings.wingbeat;
    const open=perched?.13:(.76+.22*Math.cos(beat))*settings.wingspan,lift=perched?0:flap*1.3;
    let clipped=false;
    function point(f,s,u){f*=settings.bodyLength;const depth=z+size*(fz*f+sz*s+nz*u);if(1-settings.perspective*.85*depth/settings.depth<.15)clipped=true;return project(x+size*(fx*f+sx*s+nx*u),y+size*(fy*f+sy*s+ny*u),depth);}
    const nose=point(1.75,0,0),shoulder=point(.45,0,.2),tail=point(-1.5,0,-.08),leftRoot=point(-.22,-.28,0),rightRoot=point(-.22,.28,0);
    const leftElbow=point(.35,-1.32*open,lift*.43),rightElbow=point(.35,1.32*open,lift*.43),leftTip=point(-1.08,-2.65*open,lift),rightTip=point(-1.08,2.65*open,lift);
    const leftTrailing=point(-.94,-.8*open,lift*.2),rightTrailing=point(-.94,.8*open,lift*.2);
    if(clipped)return;
    const palette=colors[night?'night':'day'][Math.min(2,Math.floor(traits[t+3]*3))].map(c=>tint(c,z)),shade=flap<-.15?1:2;
    function polygon(points,color){target.fillStyle=color;target.beginPath();target.moveTo(points[0][0],points[0][1]);for(let j=1;j<points.length;j++)target.lineTo(points[j][0],points[j][1]);target.closePath();target.fill();}
    if(perched){
      const feet=project(anchorX,anchorY,0),hip=point(-.1,0,0);
      target.strokeStyle=palette[0];target.lineWidth=Math.max(.6,scale*size*.11);target.beginPath();target.moveTo(hip[0],hip[1]);target.lineTo(feet[0],feet[1]);target.lineTo(feet[0]+size*scale*.3,feet[1]);target.stroke();
    }
    polygon([shoulder,leftElbow,leftTip,leftTrailing],palette[shade]);polygon([shoulder,leftTip,leftRoot],palette[0]);
    polygon([shoulder,rightElbow,rightTip,rightTrailing],palette[3]);polygon([shoulder,rightTip,rightRoot],palette[1]);
    polygon([nose,leftRoot,tail],palette[0]);polygon([nose,shoulder,rightRoot,tail],palette[2]);
  }
  function updateAnchors(){
    if(!fern||!model)return;const r=palmCanvas.getBoundingClientRect(),s=scene.getBoundingClientRect();
    const anchors=fern.getPerches().map(a=>({id:a.id,x:(r.left-s.left+a.x*r.width-width*.5)/scale,y:-(r.top-s.top+a.y*r.height-height*.5)/scale}));
    model.setPerches(anchors);
    for(let i=0;i<model.count;i++)if(model.mode[i]===2){const a=anchors[model.anchor[i]];if(a){model.position[i*3]=a.x;model.position[i*3+1]=a.y;model.position[i*3+2]=0;}}
  }
  function draw(forcePalm=false){
    if(fern&&(forcePalm||model.time-lastPalmTime>=1/30)){fern.renderAt(model.time*1000);lastPalmTime=model.time;updateAnchors();}
    ctx.setTransform(dpr,0,0,dpr,0,0);rear.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);rear.clearRect(0,0,width,height);
    order.length=model.count;for(let i=0;i<model.count;i++)order[i]=i;
    order.sort((a,b)=>model.position[a*3+2]-model.position[b*3+2]);
    for(const i of order)drawBird(i,model.position[i*3+2]>=0||model.mode[i]===2?ctx:rear);
  }
  function tick(now){
    frame=0;if(document.hidden){last=null;return;}if(last===null)last=now;
    const elapsed=Math.min(.08,(now-last)/1000);last=now;
    look.x+=(look.targetX-look.x)*Math.min(1,elapsed*4);look.y+=(look.targetY-look.y)*Math.min(1,elapsed*4);
    // Reduced motion respects the device setting without adding a speed control.
    if(!media.matches){accumulator+=elapsed;let steps=0;while(accumulator>=step&&steps<5){model.step(step,pointer);accumulator-=step;steps++;}}
    draw();frame=requestAnimationFrame(tick);
  }
  function run(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
  function stylePalm(){
    palmCanvas.style.width=settings.palmScale*100+'%';palmCanvas.style.height=settings.palmScale*105+'%';palmCanvas.style.left=settings.palmX+'%';palmCanvas.style.top=settings.palmY+'%';
    palmCanvas.style.opacity=Math.min(1,settings.palmInk);palmCanvas.style.filter=`brightness(${(night?2.2:1)/Math.max(1,settings.palmInk)})`;
  }
  function resize(){
    const r=scene.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(devicePixelRatio||1,1.75);scale=height/104*settings.zoom;
    for(const c of[front,back]){c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);}
    if(!model)model=new window.ArecaBoids.Flock(settings.count,width/height,seed,settings);else model.resize(width/height);
    stylePalm();if(fern)fern.resize();updateAnchors();draw(true);run();
  }
  function reflect(){
    for(const[key,{input,output}]of inputs){input.value=settings[key];output.value=String(settings[key]);output.textContent=String(settings[key]);}
    document.body.classList.toggle('night',night);paletteButton.textContent=night?'Day':'Night';paletteButton.setAttribute('aria-pressed',String(night));
    scene.classList.toggle('type-hidden',!showType);textButton.textContent=showType?'Hide type':'Show type';textButton.setAttribute('aria-pressed',String(!showType));
  }
  function configure(input){
    const old=settings;settings=schema.normalize({...settings,...input});kept=false;model.configure(settings);
    if(old.detail!==settings.detail){model.releaseAll();fern.fullness(settings.detail);}
    if(old.wind!==settings.wind)fern.wind(settings.wind);
    if(['palmX','palmY','palmScale','zoom'].some(key=>old[key]!==settings[key]))resize();else{stylePalm();draw(true);}
    reflect();sync();return snapshot();
  }
  for(const[label,rows]of schema.groups){
    const group=document.createElement('details');group.className='parameter-group';group.open=['Depth','Perching'].includes(label);
    const title=document.createElement('summary');title.textContent=label;group.append(title);
    for(const[key,name,min,max,step]of rows){
      const row=document.createElement('div');row.className='parameter-row';const label=document.createElement('label');label.htmlFor='setting-'+key;label.textContent=name;
      const output=document.createElement('output');output.htmlFor='setting-'+key;output.id='value-'+key;
      const input=document.createElement('input');input.id='setting-'+key;input.type='range';input.min=min;input.max=max;input.step=step;input.setAttribute('aria-describedby',output.id);
      input.addEventListener('input',()=>configure({[key]:Number(input.value)}));row.append(label,output,input);group.append(row);inputs.set(key,{input,output});
    }
    document.querySelector('#parameter-groups').append(group);
  }
  function togglePanel(value){panelOpen=value;panel.hidden=!value;document.querySelector('#adjust-toggle').setAttribute('aria-expanded',String(value));}
  document.querySelector('#adjust-toggle').addEventListener('click',()=>togglePanel(!panelOpen));document.querySelector('#adjust-close').addEventListener('click',()=>togglePanel(false));
  function keep(){kept=true;preferred=snapshot();try{localStorage.setItem(savedKey,JSON.stringify(preferred));}catch{}document.querySelector('#restore-settings').hidden=false;sync('Kept. Tell me “use this” and I can read the settings in your link.');return snapshot();}
  keepButton.addEventListener('click',keep);
  document.querySelector('#restore-settings').addEventListener('click',()=>{if(!preferred)return;night=preferred.night;showType=preferred.showType;seed=preferred.seed;configure(preferred.settings);model.reset(seed);kept=true;draw(true);sync('Restored your kept settings.');});
  document.querySelector('#copy-settings').addEventListener('click',async()=>{
    sync();try{await navigator.clipboard.writeText(location.href);note.textContent='Link copied, including every setting.';}catch{const a=document.querySelector('#settings-link');a.href=location.href;a.hidden=false;note.textContent='Use the settings link below.';}
  });
  document.querySelector('#reset-settings').addEventListener('click',()=>configure(schema.defaults));
  textButton.addEventListener('click',()=>{showType=!showType;kept=false;reflect();sync();});
  paletteButton.addEventListener('click',()=>{night=!night;kept=false;reflect();stylePalm();draw(true);sync();});
  document.querySelector('#scatter-flock').addEventListener('click',()=>{model.releaseAll();for(let i=0;i<model.count;i++){if(!model.mode[i]){model.cooldown[i]=6+model.random()*8;model.velocity[i*3]+=(model.random()-.5)*12;model.velocity[i*3+1]+=6;}}status.textContent='The birds take flight.';});
  function locate(event){const r=front.getBoundingClientRect();pointer.x=(event.clientX-r.left-width*.5)/scale;pointer.y=-(event.clientY-r.top-height*.5)/scale;pointer.active=true;look.targetX=(event.clientX-r.left-width*.5)/(width*.5);look.targetY=(event.clientY-r.top-height*.5)/(height*.5);}
  front.addEventListener('pointermove',locate);front.addEventListener('pointerdown',event=>{locate(event);pointer.attract=true;front.setPointerCapture(event.pointerId);});
  function release(event){pointer.attract=false;if(event.type!=='pointerup'||event.pointerType!=='mouse')pointer.active=false;}
  ['pointerup','pointercancel','lostpointercapture'].forEach(name=>front.addEventListener(name,release));
  front.addEventListener('pointerleave',()=>{if(!pointer.attract)pointer.active=false;look.targetX=look.targetY=0;});
  document.addEventListener('visibilitychange',()=>{pointer.active=pointer.attract=false;last=null;accumulator=0;run();});
  media.addEventListener('change',()=>{last=null;accumulator=0;});
  resize();fern=window.ArecaBotanical.mount(palmCanvas,{externalClock:true,mature:true});
  if(!fern){document.querySelector('#canvas-fallback').hidden=false;}else{fern.wind(settings.wind);fern.fullness(settings.detail);}
  reflect();resize();sync();
  const observer=new ResizeObserver(resize);observer.observe(scene);
  const lifecycle=new AbortController();
  const readSettings=()=>({...snapshot(),preferred});
  window.ArecaFlock={getSettings:readSettings,configure,keep};
  if(document.modelContext?.registerTool){
    const properties=Object.fromEntries(schema.definitions.map(([key,,minimum,maximum,step])=>[key,{type:step===1?'integer':'number',minimum,maximum}]));
    const tools=[
      {name:'get_flock_settings',title:'Read palm and flock settings',description:'Read every current slider, seed, palette and kept preference for the Areca palm and flock.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute:readSettings},
      {name:'configure_flock',title:'Adjust palm and flock',description:'Set the same palm, perching, depth and bird sliders shown in the adjustment panel.',inputSchema:{type:'object',properties,additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
        if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Expected settings.');
        for(const[key,value]of Object.entries(input)){const spec=properties[key];if(!spec||!Number.isFinite(value)||value<spec.minimum||value>spec.maximum||(spec.type==='integer'&&!Number.isInteger(value)))throw new Error('Invalid setting: '+key);}
        return configure(input);
      }},
      {name:'keep_flock_settings',title:'Keep this palm and flock',description:'Save the current visible settings as the preferred version, using the Keep this button action.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:keep}
    ];
    for(const tool of tools){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  }
  window.addEventListener('pagehide',event=>{cancelAnimationFrame(frame);frame=0;if(!event.persisted){observer.disconnect();fern?.destroy();lifecycle.abort();}});
  window.addEventListener('pageshow',event=>{if(event.persisted){last=null;resize();run();}});
})();
