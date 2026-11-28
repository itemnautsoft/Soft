const makeVoice=require('./dsp.js');const sr=48000;const v=makeVoice(sr);
let bad=0,pk0=0,pk1=0;const a=new Float32Array(128),b=new Float32Array(128);
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
for(let blk=0;blk<sr*60/128;blk++){
  if(blk%40==0){v.fT=55*Math.pow(2,rnd()*4.2);} if(blk%25==0){v.bT=rnd()<0.2?0:rnd()*1.2;} v.vibT=rnd();
  v.process(a,b,128);
  for(let i=0;i<128;i++){if(!isFinite(a[i])||!isFinite(b[i]))bad++;pk0=Math.max(pk0,Math.abs(a[i]));pk1=Math.max(pk1,Math.abs(b[i]));}
}
console.log('nonfinite',bad,'peak lip',pk0.toFixed(2),'peak reed',pk1.toFixed(2));
// CPU: samples/sec
const t=Date.now();for(let i=0;i<sr*10/128;i++)v.process(a,b,128);console.log('realtime factor',(10000/(Date.now()-t)).toFixed(0)+'x');
