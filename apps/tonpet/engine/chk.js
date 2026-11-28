const makeVoice=require('./dsp.js');const sr=48000;
function f0of(s){let m=0;for(const q of s)m+=q;m/=s.length;const L=4096;const ac=[];
 for(let lag=20;lag<1500;lag++){let c=0,e1=0,e2=0;for(let i=0;i<L;i++){const a=s[i]-m,b=s[i+lag]-m;c+=a*b;e1+=a*a;e2+=b*b;}ac[lag]=c/Math.sqrt(e1*e2+1e-20);}
 const mx=Math.max(...ac.slice(20));let l=20;for(;l<1500;l++)if(ac[l]>0.9*mx)break;while(ac[l+1]>ac[l])l++;return sr/l;}
function render(v,sec){const n=Math.floor(sr*sec),a=new Float32Array(n),b=new Float32Array(n);for(let i=0;i<n;i+=128){const m=Math.min(128,n-i);v.process(a.subarray(i,i+m),b.subarray(i,i+m),m);}return [a,b];}
const rms=s=>{let r=0;for(const q of s)r+=q*q;return Math.sqrt(r/s.length)};
const LT=+process.argv[2]||0.925, RT=+process.argv[3]||1, RP=process.argv[4];
for(const f of [55,73.4,98,130.8,174.6,233,311,415,554,740]){
 let row=f+'';
 for(const b of [0.1,0.2,0.4,0.7,1]){
  const v=makeVoice(sr);if(process.argv[5])v.lipSm=+process.argv[5];if(process.argv[6])v.reedLp=+process.argv[6];v.lipTune=[LT,LT];v.reedTune=[RT,RT];v.f=v.fT=f;v.bT=b;
  const [a,c]=render(v,0.9);const sa=a.subarray(a.length-10000),sc=c.subarray(c.length-10000);
  const ra=rms(sa),rc=rms(sc);
  row+=` | b${b} L ${ra.toFixed(2)}@${ra>0.01?(f0of(sa)/f).toFixed(2):'--'} R ${rc.toFixed(2)}@${rc>0.01?(f0of(sc)/f).toFixed(2):'--'}`;
 }
 console.log(row);
}
