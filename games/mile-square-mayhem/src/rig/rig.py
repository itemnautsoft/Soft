import numpy as np, base64, json
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
m=np.load('mesh.npz'); src=m['src']; idx=m['idx']; P=m['opos']; UV=m['uv']; VP=m['pos']
t=src[idx.reshape(-1,3)]
e=np.vstack([t[:,[0,1]],t[:,[1,2]],t[:,[2,0]]]); e=np.unique(np.sort(e,1),axis=0)
w=np.linalg.norm(P[e[:,0]]-P[e[:,1]],axis=1)
x,y,z=P[:,0],P[:,1],P[:,2]; ax=np.abs(x)
# vertex normals (area weighted) to split the fused hand/sleeve vs belly contact zone
N=np.zeros_like(P); tv=P[t]; fn=np.cross(tv[:,1]-tv[:,0],tv[:,2]-tv[:,0])
for k in range(3): np.add.at(N,t[:,k],fn)
N/=np.linalg.norm(N,axis=1,keepdims=True)+1e-9
zone=(ax>0.26)&(ax<0.42)&(y<0.12)&(y>-0.42)
outward=N[:,0]*np.sign(x)
lab=np.zeros(len(P),int)  # 0 = not zone, 1 = torso side, 2 = arm side
lab[zone&(outward>0.15)&(ax<0.375)]=1
lab[zone&(lab==0)]=2
cut=((lab[e[:,0]]==1)&(lab[e[:,1]]==2))|((lab[e[:,0]]==2)&(lab[e[:,1]]==1))
print('cut edges',cut.sum())
e=e[~cut]; w=w[~cut]
G=coo_matrix((w,(e[:,0],e[:,1])),shape=(len(P),len(P))).tocsr()
BONES=[  # name, parent, joint (mesh coords), seed mask
 ('pelvis',None,(0,-0.32,0.02), (y>-0.52)&(y<-0.15)&(ax<0.32)),
 ('spine','pelvis',(0,0.0,0.0), (y>0.02)&(y<0.36)&(ax<0.24)),
 ('head','spine',(0,0.46,-0.02), (y>0.62)),
 ('shL','spine',(0.36,0.28,-0.03), (x>0.40)&(y>0.08)&(y<0.26)),
 ('elL','shL',(0.41,0.02,-0.04), (x>0.37)&(y<-0.08)&(y>-0.37)),
 ('shR','spine',(-0.36,0.28,-0.03), (x<-0.40)&(y>0.08)&(y<0.26)),
 ('elR','shR',(-0.41,0.02,-0.04), (x<-0.37)&(y<-0.08)&(y>-0.37)),
 ('hipL','pelvis',(0.13,-0.42,0.0), (x>0.06)&(y<-0.5)&(y>-0.68)),
 ('knL','hipL',(0.14,-0.66,0.0), (x>0.0)&(y<-0.72)),
 ('hipR','pelvis',(-0.13,-0.42,0.0), (x<-0.06)&(y<-0.5)&(y>-0.68)),
 ('knR','hipR',(-0.14,-0.66,0.0), (x<0.0)&(y<-0.72)),
]
D=[]
for name,par,j,mask in BONES:
    seeds=np.where(mask)[0]; assert len(seeds)>0, name
    d=dijkstra(G,directed=False,indices=seeds,min_only=True); D.append(d)
    print(name,len(seeds))
D=np.array(D).T  # nv x nb
bad=~np.isfinite(D).any(1); print('isolated verts', bad.sum())
if bad.any():
    # fall back to straight-line distance to the bone seeds
    for bi,(name,par,j,mask) in enumerate(BONES):
        sp=P[mask]; D[bad,bi]=np.min(np.linalg.norm(P[bad][:,None,:]-sp[None],axis=2),1)
W=1.0/(D+0.015)**4
# keep top 4
order=np.argsort(-W,1)[:,:4]
top=np.take_along_axis(W,order,1); top/=top.sum(1,keepdims=True)
# drop tiny
top[top<0.02]=0; top/=top.sum(1,keepdims=True)
S=0.93; OFF=0.951
def tr(v): v=np.array(v,np.float32); return ((v+np.array([0,OFF,0],np.float32))*S)
pos=tr(VP)
ski=order[src].astype(np.uint8); skw=top[src].astype(np.float32)
bones=[dict(name=n,parent=p,pos=tr(j).round(4).tolist()) for n,p,j,_ in BONES]
b64=lambda a: base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()
open('/home/claude/hob/src/goblin_data.js','w').write(
 "export const POS='%s';\nexport const UV='%s';\nexport const IDX='%s';\nexport const SKI='%s';\nexport const SKW='%s';\nexport const BONES=%s;\nexport const TEX='data:image/jpeg;base64,%s';\n" % (
  b64(pos.astype(np.float32)), b64(UV.astype(np.float32)), b64(idx.astype(np.uint16)), b64(ski), b64(skw), json.dumps(bones), base64.b64encode(open('tex2k.jpg','rb').read()).decode()))
# debug: dominant bone per vertex image
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
dom=order[:,0]
fig,ax_=plt.subplots(1,2,figsize=(10,9))
for a,(i,j) in zip(ax_,[(0,1),(2,1)]):
    a.scatter(P[:,i],P[:,j],c=dom,cmap='tab20',s=6); a.set_aspect('equal')
plt.savefig('/tmp/seg.png',dpi=70)
print(json.dumps(bones))
names=[b[0] for b in BONES]
sel=np.where((x>0.2)&(x<0.37)&(y>-0.45)&(y<-0.05))[0]
for v in sel[:25]:
    print(np.round(P[v],2), [(names[order[v,i]], round(float(top[v,i]),2)) for i in range(4) if top[v,i]>0], 'dArm',round(float(D[v,4]),2),'dPel',round(float(D[v,0]),2))
