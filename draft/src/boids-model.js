(function(root){
  'use strict';
  const schema=typeof module!=='undefined'&&module.exports?require('./boids-settings.js'):root.ArecaFlockSettings;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function random(seed){return()=>{seed|=0;seed=seed+0x6d2b79f5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  class Flock{
    constructor(count=100,aspect=1.6,seed=712,params={}){
      this.params=schema.normalize({...params,count});this.count=this.params.count;this.aspect=aspect;this.seed=seed;this.time=0;
      this.bounds=[Math.max(.35,aspect)*43,43,this.params.depth];this.perches=[];
      for(const key of['position','velocity','acceleration'])this[key]=new Float64Array(this.count*3);
      this.traits=new Float64Array(this.count*4);this.bank=new Float64Array(this.count);
      this.mode=new Uint8Array(this.count);this.anchor=new Int32Array(this.count);
      this.timer=new Float64Array(this.count);this.cooldown=new Float64Array(this.count);this.launch=new Float64Array(this.count);this.reset(seed);
    }
    reset(seed=this.seed+1){
      this.seed=seed;this.time=0;const r=this.random=random(seed);
      for(let i=0;i<this.count;i++){
        const k=i*3,t=i*4,heading=r()*Math.PI*2;
        this.traits[t]=.88+r()*.24;this.traits[t+1]=r()*Math.PI*2;this.traits[t+2]=r()*2-1;this.traits[t+3]=r();
        this.position[k+2]=(r()*2-1)*this.bounds[2]*.8;
        const spread=1-this.params.perspective*.85*this.position[k+2]/this.params.depth;
        this.position[k]=(r()*2-1)*this.bounds[0]*.7*spread/this.params.zoom;
        this.position[k+1]=(r()*2-1)*this.bounds[1]*.7*spread/this.params.zoom;
        this.velocity[k]=Math.cos(heading)*19;this.velocity[k+1]=Math.sin(heading)*19;
        this.velocity[k+2]=(r()*2-1)*13;this.bank[i]=0;
        this.mode[i]=0;this.anchor[i]=-1;this.timer[i]=0;this.cooldown[i]=.5+r()*5;this.launch[i]=0;
      }
      this.acceleration.fill(0);
    }
    configure(input){
      const old=this.params,next=schema.normalize({...old,...input});this.params=next;
      if(next.count!==this.count){
        const fresh=new Flock(next.count,this.aspect,this.seed,next);
        for(const key of['position','velocity','acceleration','traits','bank','mode','anchor','timer','cooldown','launch']){
          fresh[key].set(this[key].subarray(0,Math.min(this[key].length,fresh[key].length)));this[key]=fresh[key];
        }
        this.count=next.count;
      }
      if(next.depth!==old.depth){for(let i=0;i<this.count;i++)if(!this.mode[i])this.position[i*3+2]*=next.depth/old.depth;this.bounds[2]=next.depth;}
      if(!next.perching)this.releaseAll();
    }
    resize(aspect){this.aspect=aspect;this.bounds[0]=Math.max(.35,aspect)*43;}
    setPerches(perches){
      const byId=new Map(perches.map((p,i)=>[p.id,i]));
      for(let i=0;i<this.count;i++)if(this.mode[i]){
        const id=this.perches[this.anchor[i]]?.id,next=byId.get(id);
        if(next===undefined)this.takeoff(i);else this.anchor[i]=next;
      }
      this.perches=perches;
    }
    takeoff(i){
      const k=i*3,phase=this.traits[i*4+1],power=this.params.takeoff;
      this.mode[i]=0;this.anchor[i]=-1;this.timer[i]=0;this.cooldown[i]=8+this.random()*12;this.launch[i]=1;
      this.velocity[k]=Math.cos(phase)*13*power;this.velocity[k+1]=(14+this.random()*7)*power;
      this.velocity[k+2]=(Math.sin(phase)>.0?1:-1)*13*power;
    }
    releaseAll(){for(let i=0;i<this.count;i++)if(this.mode[i])this.takeoff(i);}
    step(dt=1/60,pointer=null){
      dt=clamp(dt,0,1/30);if(!dt)return;
      const p=this.position,v=this.velocity,a=this.acceleration,n=this.count,b=this.bounds,s=this.params;
      this.time+=dt;const occupied=new Set();
      for(let i=0;i<n;i++)if(this.mode[i])occupied.add(this.anchor[i]);
      // Branches own a single reservation from the beginning of the approach.
      for(let i=0;i<n;i++){
        const k=i*3;this.cooldown[i]=Math.max(0,this.cooldown[i]-dt);this.launch[i]=Math.max(0,this.launch[i]-dt);
        if(this.mode[i]){
          const perch=this.perches[this.anchor[i]];
          if(!perch||!s.perching||(pointer?.active&&!pointer.attract&&Math.hypot(pointer.x-perch.x,pointer.y-perch.y)<s.pointerReach*.5)){
            occupied.delete(this.anchor[i]);this.takeoff(i);continue;
          }
          this.timer[i]+=dt;
          if(this.mode[i]===2){
            p[k]=perch.x;p[k+1]=perch.y;p[k+2]=0;v[k]=v[k+1]=v[k+2]=0;a[k]=a[k+1]=a[k+2]=0;
            if(this.timer[i]>s.rest*(.65+this.traits[i*4]*.7)){occupied.delete(this.anchor[i]);this.takeoff(i);}
            continue;
          }
          if(this.timer[i]>10){occupied.delete(this.anchor[i]);this.takeoff(i);}
        }
        if(!this.mode[i]&&!this.cooldown[i]&&s.perching&&occupied.size<Math.ceil(n*.45)){
          this.cooldown[i]=2+this.random()*3;
          if(this.random()>s.perching)continue;
          let nearest=s.landingReach,index=-1;
          for(let j=0;j<this.perches.length;j++){
            if(occupied.has(j))continue;const perch=this.perches[j];
            const d=Math.hypot(perch.x-p[k],perch.y-p[k+1],p[k+2]);
            if(d<nearest){nearest=d;index=j;}
          }
          if(index>=0){this.mode[i]=1;this.anchor[i]=index;this.timer[i]=0;occupied.add(index);}
        }
      }
      // Compute from the previous state, then integrate every airborne bird.
      for(let i=0;i<n;i++){
        const k=i*3,t=i*4;if(this.mode[i]===2)continue;
        const x=p[k],y=p[k+1],z=p[k+2],vx=v[k],vy=v[k+1],vz=v[k+2];
        let fx=0,fy=0,fz=0;
        if(this.mode[i]===1){
          const perch=this.perches[this.anchor[i]],dx=perch.x-x,dy=perch.y-y,dz=-z,d=Math.hypot(dx,dy,dz);
          if(d<.45&&Math.hypot(vx,vy,vz)<2.2){this.mode[i]=2;this.timer[i]=0;p[k]=perch.x;p[k+1]=perch.y;p[k+2]=0;v[k]=v[k+1]=v[k+2]=0;a[k]=a[k+1]=a[k+2]=0;continue;}
          const approach=Math.min(19,d*2/s.landing)/Math.max(.001,d);
          fx=(dx*approach-vx)*4;fy=(dy*approach-vy)*4;fz=(dz*approach-vz)*4;
        }else{
          const speed=Math.hypot(vx,vy,vz),radius=s.radius*this.traits[t],r2=radius*radius,space2=s.spacing*s.spacing;
          let sx=0,sy=0,sz=0,cx=0,cy=0,cz=0,ax=0,ay=0,az=0,neighbours=0;
          for(let j=0;j<n;j++){
            if(i===j||this.mode[j]===2)continue;const q=j*3,dx=p[q]-x,dy=p[q+1]-y,dz=p[q+2]-z,d2=dx*dx+dy*dy+dz*dz;
            if(d2>Math.max(r2,space2))continue;
            if(d2<space2){if(d2<1e-8){sx+=i<j?-1:1;sy+=i<j?.5:-.5;}else{const repel=(1-Math.sqrt(d2)/s.spacing)/Math.max(d2,.15);sx-=dx*repel;sy-=dy*repel;sz-=dz*repel;}}
            if(d2>r2||dx*vx+dy*vy+dz*vz<-.35*Math.sqrt(d2)*speed)continue;
            cx+=dx;cy+=dy;cz+=dz;ax+=v[q];ay+=v[q+1];az+=v[q+2];neighbours++;
          }
          fx=sx*105*s.separation;fy=sy*105*s.separation;fz=sz*105*s.separation;
          if(neighbours){fx+=(ax/neighbours-vx)*s.alignment+cx/neighbours*s.cohesion;fy+=(ay/neighbours-vy)*s.alignment+cy/neighbours*s.cohesion;fz+=(az/neighbours-vz)*s.alignment+cz/neighbours*s.cohesion;}
          const phase=this.traits[t+1],time=this.time;
          fx+=(4.4*Math.sin(time*.71+phase)+2*Math.sin(time*.29+phase*3))*s.wander;
          fy+=(4.4*Math.cos(time*.59+phase*1.7)+2*Math.sin(time*.37+phase))*s.wander;
          fz+=(7*Math.sin(time*.47+phase*2.3)+3*Math.cos(time*.19+phase))*s.depthRoam-z*.012;
          const frustum=Math.max(.18,1-s.perspective*.85*z/s.depth)/s.zoom;
          for(let axis=0;axis<3;axis++){
            const edge=axis===2?b[axis]:Math.max(9,b[axis]*frustum-3*s.size),pos=p[k+axis],vel=v[k+axis];
            const band=Math.min(22,edge*.65),near=clamp((Math.abs(pos)-(edge-band))/band,0,3);
            const force=(-Math.sign(pos)*near*near*60-vel*near*.65)*s.boundary;
            if(axis===0)fx+=force;else if(axis===1)fy+=force;else fz+=force;
          }
          if(pointer?.active){
            const dx=pointer.x-x,dy=pointer.y-y,d=Math.hypot(dx,dy);
            if(d<s.pointerReach){
              const ux=d>.01?dx/d:Math.cos(phase),uy=d>.01?dy/d:Math.sin(phase);
              const strength=(pointer.attract?(d>7?20*(d-7)/20:-18*(1-d/7)):-65*(1-d/s.pointerReach)**2)*s.pointerForce;
              fx+=ux*strength;fy+=uy*strength;if(pointer.attract){fx-=uy*8*s.pointerForce;fy+=ux*8*s.pointerForce;}
            }
          }
        }
        const force=Math.hypot(fx,fy,fz),limit=this.mode[i]===1?Math.max(48,s.turning):s.turning,scale=force>limit?limit/force:1;
        a[k]=fx*scale;a[k+1]=fy*scale;a[k+2]=fz*scale;
        // The depth wall remains safe even with deliberately weak flock steering.
        const outward=Math.max(0,Math.sign(z)*vz),distance=s.depth-Math.abs(z);
        if(distance<outward*.55+5)a[k+2]=-Math.sign(z)*Math.max(55,outward*5);
      }
      for(let i=0;i<n;i++){
        if(this.mode[i]===2)continue;const k=i*3,oldX=v[k],oldY=v[k+1],trait=this.traits[i*4];
        let vx=v[k]+a[k]*dt,vy=v[k+1]+a[k+1]*dt,vz=v[k+2]+a[k+2]*dt;
        const speed=Math.hypot(vx,vy,vz),min=this.mode[i]===1?0:13*trait,max=23*trait*(1+this.launch[i]*Math.max(0,s.takeoff-.6));
        const scale=clamp(speed,min,max)/Math.max(speed,1e-9);
        if(speed<1e-9&&min){vx=min;vy=0;vz=0;}else{vx*=scale;vy*=scale;vz*=scale;}
        v[k]=vx;v[k+1]=vy;v[k+2]=vz;p[k]+=vx*dt;p[k+1]+=vy*dt;p[k+2]+=vz*dt;
        const turn=(oldX*vy-oldY*vx)/Math.max(10,oldX*oldX+oldY*oldY)/dt;
        this.bank[i]+=(clamp(turn*.62,-.85,.85)-this.bank[i])*Math.min(1,dt*5);
      }
    }
    statistics(){
      const states={flying:0,approaching:0,perched:0};let maxSpeed=0,maxAcceleration=0;
      for(let i=0;i<this.count;i++){states[['flying','approaching','perched'][this.mode[i]]]++;const k=i*3;maxSpeed=Math.max(maxSpeed,Math.hypot(...this.velocity.subarray(k,k+3)));maxAcceleration=Math.max(maxAcceleration,Math.hypot(...this.acceleration.subarray(k,k+3)));}
      return{...states,maxSpeed,maxAcceleration};
    }
  }
  const api={Flock};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArecaBoids=api;
})(typeof window!=='undefined'?window:globalThis);
