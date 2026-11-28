import struct, re
class Blend:
    def __init__(s, path):
        d = s.d = open(path, 'rb').read()
        assert d[:7] == b'BLENDER' and d[7:8] == b'-' and d[8:9] == b'v'
        s.blocks = []; o = 12
        while o < len(d):
            code = d[o:o+4]; ln, = struct.unpack_from('<i', d, o+4); ptr, = struct.unpack_from('<Q', d, o+8); sdna, cnt = struct.unpack_from('<ii', d, o+16)
            s.blocks.append(dict(code=code.rstrip(b'\0').decode('latin1'), len=ln, ptr=ptr, sdna=sdna, cnt=cnt, off=o+24)); o += 24 + ln
            if code == b'ENDB': break
        s.byptr = {b['ptr']: b for b in s.blocks}
        dna = next(b for b in s.blocks if b['code'] == 'DNA1'); p = dna['off']
        def al(p): return (p + 3) & ~3
        assert d[p:p+8] == b'SDNANAME'; p += 8; n, = struct.unpack_from('<i', d, p); p += 4
        s.names = []
        for _ in range(n): e = d.index(b'\0', p); s.names.append(d[p:e].decode()); p = e + 1
        p = al(p); assert d[p:p+4] == b'TYPE'; p += 4; n, = struct.unpack_from('<i', d, p); p += 4
        s.types = []
        for _ in range(n): e = d.index(b'\0', p); s.types.append(d[p:e].decode()); p = e + 1
        p = al(p); assert d[p:p+4] == b'TLEN'; p += 4
        s.tlen = list(struct.unpack_from('<%dh' % len(s.types), d, p)); p += 2 * len(s.types); p = al(p)
        assert d[p:p+4] == b'STRC'; p += 4; n, = struct.unpack_from('<i', d, p); p += 4
        s.structs = []; s.sidx = {}
        for i in range(n):
            t, nf = struct.unpack_from('<hh', d, p); p += 4
            fields = []; off = 0
            for _ in range(nf):
                ft, fn = struct.unpack_from('<hh', d, p); p += 4
                name = s.names[fn]; size = s.fsize(ft, name)
                fields.append((s.types[ft], name, off, size)); off += size
            s.structs.append((s.types[t], fields)); s.sidx[s.types[t]] = i
    def fsize(s, ft, name):
        arr = 1
        for m in re.findall(r'\[(\d+)\]', name): arr *= int(m)
        if name.startswith('*') or name.startswith('(*'): return 8 * arr
        return s.tlen[ft] * arr
    def fields(s, tname):
        return {re.sub(r'[\*\[\]\d()]', '', n) if True else n: (t, n, o, z) for t, n, o, z in s.structs[s.sidx[tname]][1]}
    def stype(s, b): return s.structs[b['sdna']][0]
    def get(s, tname, base, field):
        f = s.fields(tname)
        t, n, o, z = f[field]
        p = base + o
        if n.startswith('*'): return struct.unpack_from('<Q', s.d, p)[0]
        if t == 'int': return struct.unpack_from('<i', s.d, p)[0] if z == 4 else list(struct.unpack_from('<%di' % (z // 4), s.d, p))
        if t == 'short': return struct.unpack_from('<h', s.d, p)[0] if z == 2 else list(struct.unpack_from('<%dh' % (z // 2), s.d, p))
        if t == 'float': return struct.unpack_from('<f', s.d, p)[0] if z == 4 else list(struct.unpack_from('<%df' % (z // 4), s.d, p))
        if t == 'char': raw = s.d[p:p+z]; return raw.split(b'\0')[0].decode('latin1') if z > 1 else raw[0]
        return p  # nested struct: return address
    def blk(s, ptr): return s.byptr.get(ptr)
