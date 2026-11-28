// TONPET voice engine — shared by the AudioWorklet, the ScriptProcessor fallback and the node tests.
// ch0: lip-valve brass bore (trumpet side)  ch1: conical double-reed bore (bassoon side)
function makeVoice(sr){
  const N=32768,M=N-1;
  const v={sr,breath:0,bT:0,f:146.8,fT:146.8,glide:0.0015,vib:0,vibT:0,vp:0,vibRate:5.2,
    lipT:1,lipLow:1,lipSm:0.25,reedLp:0.5,reedT:1,lipTune:[0.925,0.925,0.926,0.927,0.928,0.931,0.933,0.942,0.947],reedTune:[1.001,1.004,1.005,1.004,1.010,1.016,1.010,1.020,1.020],seed:12345,
    D:new Float32Array(N),w:0,x:0,xv:0,lp:0,pP:0,dcx:0,dcy:0,
    r0:new Float32Array(N),r1:new Float32Array(N),fz:0,rdx:0,rdy:0};
  const rd=(b,w,d)=>{const p=w-d,i=Math.floor(p),fr=p-i;const a=b[i&M],c=b[(i-1)&M];return a+(c-a)*fr;};
  const tuneAt=(tab,f)=>{if(!tab)return 1;const l=Math.log2(f/55)*2;const i=Math.max(0,Math.min(tab.length-2,Math.floor(l)));const t=Math.max(0,Math.min(1,l-i));return tab[i]+(tab[i+1]-tab[i])*t;};
  v.process=function(o0,o1,n){
    const sr=v.sr,dt=1/sr;
    const ft=tuneAt(v.lipTune,v.f),rt=tuneAt(v.reedTune,v.f); const lt=Math.max(0,Math.min(1,(v.f-100)/30)); 
    for(let k=0;k<n;k++){ v.lipLow+=(lt-v.lipLow)*0.002;
      v.breath+=(v.bT-v.breath)*0.004;
      v.f*=Math.pow(v.fT/v.f,v.glide);
      v.vib+=(v.vibT-v.vib)*0.0004;
      v.vp+=v.vibRate*dt; if(v.vp>1)v.vp-=1;
      const f=v.f*(1+v.vib*0.01*Math.sin(6.2831853*v.vp));
      const b=v.breath>0?v.breath:0;
      v.seed=(v.seed*1664525+1013904223)>>>0; const nz=v.seed/2147483648-1;
      // ---- lip valve + bore
      const fl=f*ft;
      const pm=b*(1+0.025*nz);
      const r=rd(v.D,v.w,1.5*sr/fl);
      v.lp+=(r-v.lp)*(0.35+0.3*b);                 // bell/wall loss: brighter when blown harder
      const pminus=-0.97*v.lp;
      const wl=6.2831853*fl;
      let dp=pm-v.pP; dp=dp>2?2:dp<-2?-2:dp;
      v.xv+=(wl*wl*(dp-v.x)-(wl/6)*v.xv)*dt; v.x+=v.xv*dt;
      let h=v.x; h=h<0?0:h>1.5?1.5:h;
      const df=pm-v.pP; const u=h*Math.sqrt(df>0?df:0);
      const p=2*pminus+0.6*u;
      v.pP+=(p-v.pP)*v.lipSm; v.D[v.w&M]=pminus+0.6*u;
      const dc=p-v.dcx+0.996*v.dcy; v.dcx=p; v.dcy=dc;
      o0[k]=dc*v.lipLow;
      // ---- conical reed (two-section bore)
      const fr=f*rt;
      const span=fr<330?0.15:0.15*330/fr; const rp=b<0.08?b*7:0.57+span*(b-0.08)/0.92;
      const bp=rp+rp*0.16*nz;
      const tot=sr/fr-1.5;
      const d0=rd(v.r0,v.w,tot*0.78), d1=rd(v.r1,v.w,tot*0.22);
      v.fz+=(d0-v.fz)*v.reedLp; const fz=v.fz;
      const t=-0.95*fz, last=t-d1, pd=bp-last;
      let tb=0.7+0.3*pd; tb=tb>1?1:tb<-1?-1:tb;
      v.r1[v.w&M]=t; v.r0[v.w&M]=bp-pd*tb-t;
      const ro=last-v.rdx+0.996*v.rdy; v.rdx=last; v.rdy=ro;
      o1[k]=ro*(0.3+0.7*b);
      v.w++;
    }
  };
  return v;
}
if(typeof module!=='undefined')module.exports=makeVoice;
