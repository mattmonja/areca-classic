/* Continuous Life: floating states and disk/annulus neighbourhoods.
 * Transition rule after Stephan Rafler, SmoothLife (2011).
 * Horizontal prefix sums evaluate circular neighbourhoods in O(N * radius).
 */
(function(root){
  'use strict';
  const clamp=v=>Math.max(0,Math.min(1,v));
  const defaults={b1:.278,b2:.365,d1:.267,d2:.445,an:.028,am:.147,dt:.1};
  function makeRandom(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
  function disk(radius){const rows=[];let area=0;for(let y=-radius;y<=radius;y++){const x=Math.floor(Math.sqrt(radius*radius-y*y));rows.push([y,x]);area+=2*x+1;}return {rows,area};}
  class LifeModel{
    constructor(width,height,params={},seed=8271){
      this.width=width;this.height=height;this.params={...defaults,...params};this.seed=seed;this.ticks=0;
      this.state=new Float32Array(width*height);this.next=new Float32Array(width*height);
      this.outer=disk(6);this.inner=disk(2);this.stride=width+13;
      this.prefix=new Float32Array(this.stride*height);
      this.outerRows=new Int32Array(height*this.outer.rows.length);this.innerRows=new Int32Array(height*this.inner.rows.length);
      for(let y=0;y<height;y++){
        this.outer.rows.forEach(([dy],k)=>this.outerRows[y*this.outer.rows.length+k]=((y+dy+height)%height)*this.stride);
        this.inner.rows.forEach(([dy],k)=>this.innerRows[y*this.inner.rows.length+k]=((y+dy+height)%height)*this.stride);
      }
      this.reset(seed);
    }
    reset(seed=this.seed){
      this.seed=seed;const random=makeRandom(seed);this.state.fill(0);this.ticks=0;
      const count=Math.round(this.width*this.height/750);
      for(let n=0;n<count;n++){
        const cx=random()*this.width,cy=random()*this.height;
        const rx=5+random()*11,ry=4+random()*9;
        for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){
          const distance=((x-cx)/rx)**2+((y-cy)/ry)**2;
          if(distance<1){const i=((y+this.height)%this.height)*this.width+(x+this.width)%this.width;
            this.state[i]=Math.max(this.state[i],clamp((1-distance)*3+random()*.15));}
        }
      }
    }
    brush(nx,ny,radius=6,erase=false){
      const cx=nx*this.width,cy=ny*this.height;
      for(let oy=-radius;oy<=radius;oy++)for(let ox=-radius;ox<=radius;ox++){
        const d=Math.hypot(ox,oy)/radius;if(d>=1)continue;
        const x=(Math.floor(cx)+ox+this.width)%this.width,y=(Math.floor(cy)+oy+this.height)%this.height,i=y*this.width+x;
        this.state[i]=erase?this.state[i]*d:Math.max(this.state[i],clamp((1-d)*2));
      }
    }
    step(){
      const w=this.width,h=this.height,field=this.state,next=this.next,prefix=this.prefix,stride=this.stride,p=this.params;
      for(let y=0;y<h;y++){
        let sum=0;const base=y*stride,row=y*w;prefix[base]=0;
        for(let x=0;x<w+12;x++){sum+=field[row+(x-6+w)%w];prefix[base+x+1]=sum;}
      }
      const out=this.outer,inside=this.inner,outerCount=out.rows.length,innerCount=inside.rows.length;
      const ia=1/inside.area,oa=1/(out.area-inside.area),an=4/p.an,am=4/p.am;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=y*w+x,center=x+6;let total=0,small=0;
        for(let k=0;k<outerCount;k++){
          const base=this.outerRows[y*outerCount+k]+center,rx=out.rows[k][1];total+=prefix[base+rx+1]-prefix[base-rx];
        }
        for(let k=0;k<innerCount;k++){
          const base=this.innerRows[y*innerCount+k]+center,rx=inside.rows[k][1];small+=prefix[base+rx+1]-prefix[base-rx];
        }
        const m=small*ia,n=(total-small)*oa;
        const alive=1/(1+Math.exp(-(m-.5)*am));
        const low=p.b1+(p.d1-p.b1)*alive,high=p.b2+(p.d2-p.b2)*alive;
        const growth=(1/(1+Math.exp(-(n-low)*an)))*(1-1/(1+Math.exp(-(n-high)*an)));
        next[i]=clamp(field[i]+p.dt*(2*growth-1));
      }
      this.state=next;this.next=field;this.ticks++;
    }
    statistics(previous){
      let sum=0,sq=0,delta=0,nonzero=0;
      for(let i=0;i<this.state.length;i++){const v=this.state[i];sum+=v;sq+=v*v;if(v>.1)nonzero++;if(previous)delta+=Math.abs(v-previous[i]);}
      const mean=sum/this.state.length;
      return {mean,variance:sq/this.state.length-mean*mean,active:nonzero/this.state.length,change:previous?delta/this.state.length:null};
    }
  }
  const api={LifeModel,defaults};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ArecaLife=api;
})(typeof window==='undefined'?globalThis:window);
