(function(root){
  'use strict';
  // One schema drives the controls, validation, share link and agent read-back.
  const groups=[
    ['Depth',[
      ['depth','Flight depth',35,130,1,80],['perspective','Perspective',0,.92,.01,.84],
      ['parallax','Parallax',0,18,.5,8],['zoom','Camera zoom',.55,1.4,.01,.86],['haze','Distance haze',0,.9,.01,.48]
    ]],
    ['Palm',[
      ['palmScale','Palm size',.6,1.5,.01,1],['palmX','Palm position · across',25,85,1,61],
      ['palmY','Palm position · down',20,80,1,50],['wind','Branch sway',0,1,.01,.4],
      ['detail','Palm detail',.25,1,.01,.64],['palmInk','Palm contrast',.3,1.5,.01,1]
    ]],
    ['Perching',[
      ['perching','Desire to perch',0,1,.01,.65],['rest','Time on branch',3,35,1,12],
      ['landingReach','Landing range',12,65,1,45],['landing','Landing softness',.5,2,.05,1],
      ['takeoff','Takeoff force',.4,2,.05,1]
    ]],
    ['Flock',[
      ['count','Birds',12,240,1,100],['separation','Separation',0,3,.05,1.1],
      ['alignment','Alignment',0,2,.05,.8],['cohesion','Cohesion',0,2,.05,.5],
      ['radius','Neighbour range',8,45,1,23],['spacing','Personal space',2,12,.5,6],
      ['wander','Wander',0,3,.05,1],['depthRoam','Flight into depth',0,3,.05,1.8],
      ['turning','Turning force',18,100,1,48],['boundary','Edge steering',.4,2,.05,1]
    ]],
    ['Bird shape',[
      ['size','Bird size',.35,2.5,.05,1.05],['variation','Size variation',0,.9,.05,.4],
      ['wingspan','Wingspan',.4,2,.05,1],['wingbeat','Wing movement',0,1.8,.05,1],
      ['banking','Banking',0,2,.05,1],['bodyLength','Body length',.5,2,.05,1]
    ]],
    ['Interaction',[
      ['pointerReach','Pointer range',5,55,1,27],['pointerForce','Pointer force',0,2,.05,1]
    ]]
  ];
  const definitions=groups.flatMap(([,rows])=>rows),defaults=Object.fromEntries(definitions.map(r=>[r[0],r[5]]));
  function normalize(input={}){
    const out={...defaults};for(const[key,,min,max,step]of definitions){const value=Number(input[key]);if(input[key]!==undefined&&Number.isFinite(value))out[key]=Number((Math.round((Math.max(min,Math.min(max,value))-min)/step)*step+min).toFixed(3));}return out;
  }
  const api={groups,definitions,defaults,normalize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArecaFlockSettings=api;
})(typeof window!=='undefined'?window:globalThis);
