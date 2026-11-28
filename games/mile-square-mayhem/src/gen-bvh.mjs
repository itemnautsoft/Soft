import fs from 'fs'; import path from 'path';
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk('src').filter(f => f.endsWith('.template.js'))) {
  const src = fs.readFileSync(f, 'utf8');
  for (const ind of [true, false]) {
    const env = { INDIRECT: ind, INDIRECT_STRING: ind ? '_indirect' : '', VERSION: '0.9.18' };
    let out = src.replace(/\/\*\s*@echo\s+(\w+)\s*\*\//g, (_, k) => env[k]);
    // nested-free if/else/endif
    out = out.replace(/\/\*\s*@if\s+(\w+)\s*\*\/([\s\S]*?)(?:\/\*\s*@else\s*\*\/([\s\S]*?))?\/\*\s*@endif\s*\*\//g, (_, k, a, b) => env[k] ? a : (b || ''));
    if (/@if|@endif|@else/.test(out)) throw new Error('unhandled directive in ' + f);
    fs.writeFileSync(f.replace(/\.template\.js$/, ind ? '_indirect.generated.js' : '.generated.js'), out);
  }
}
console.log('generated');
