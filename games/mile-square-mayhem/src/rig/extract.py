from blend import Blend
import struct, json, numpy as np
b=Blend('/mnt/user-data/uploads/9612fbec-Meshy_AI_Masked_Goblin_2K_Quad_1118193114_texture.blend')
me=[x for x in b.blocks if x['code']=='ME'][0]; o=me['off']
def layers(cdname):
    cd=b.get('Mesh',o,cdname); n=b.get('CustomData',cd,'totlayer'); lp=b.get('CustomData',cd,'layers')
    blk=b.blk(lp); out=[]
    sz=b.tlen[b.types.index('CustomDataLayer')]
    for i in range(n):
        a=blk['off']+i*sz
        dp=b.get('CustomDataLayer',a,'data'); db=b.blk(dp)
        out.append((b.get('CustomDataLayer',a,'type'), b.get('CustomDataLayer',a,'name'), db and b.stype(db), db and db['len'], db))
    return out
for cdn in ['vdata','edata','pdata','ldata']:
    print(cdn, [(t,n,st,l) for t,n,st,l,_ in layers(cdn)])
po=b.blk(b.get('Mesh',o,'poly_offset_indices')); print('polyoff', po['len'])
nv=b.get('Mesh',o,'totvert'); nl=b.get('Mesh',o,'totloop'); npoly=b.get('Mesh',o,'totpoly')
L={n:db for t,n,st,l,db in layers('vdata')+layers('ldata')+layers('pdata')}
pos=np.frombuffer(b.d, np.float32, nv*3, L['position']['off']).reshape(-1,3)
cv=np.frombuffer(b.d, np.int32, nl, L['.corner_vert']['off'])
uvname=[n for t,n,st,l,db in layers('ldata') if db and l==nl*8][0]; print('uv',uvname)
uv=np.frombuffer(b.d, np.float32, nl*2, L[uvname]['off']).reshape(-1,2)
off=np.frombuffer(b.d, np.int32, npoly+1, po['off'])
print(pos.min(0), pos.max(0), np.bincount(np.diff(off)))
# triangulate (fan), keep per-corner uv: build unique (vert, uv) pairs
tris=[]
for f in range(npoly):
    a,e=off[f],off[f+1]
    for k in range(a+1,e-1): tris.append((a,k,k+1))
tris=np.array(tris)
key={}; vpos=[]; vuv=[]; idx=[]; src=[]
for c in tris.ravel():
    kk=(int(cv[c]), round(float(uv[c,0]),6), round(float(uv[c,1]),6))
    if kk not in key: key[kk]=len(vpos); vpos.append(pos[cv[c]]); vuv.append(uv[c]); src.append(int(cv[c]))
    idx.append(key[kk])
np.savez('mesh.npz', pos=np.array(vpos,np.float32), uv=np.array(vuv,np.float32), idx=np.array(idx,np.int32), src=np.array(src,np.int32), opos=pos.copy())
print('verts out', len(vpos), 'tris', len(tris))
# packed images
for bl in b.blocks:
    if bl['code']=='IM':
        name=b.get('ID',b.get('Image',bl['off'],'id'),'name')[2:]
        pf=b.get('Image',bl['off'],'packedfile')
        if pf:
            pb=b.blk(pf); sz=b.get('PackedFile',pb['off'],'size'); dp=b.get('PackedFile',pb['off'],'data'); db=b.blk(dp)
            open(name,'wb').write(b.d[db['off']:db['off']+sz]); print('wrote',name,sz)
        else: print('not packed', name)
