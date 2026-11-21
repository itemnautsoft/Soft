import * as esbuild from '/opt/npm-tools/node_modules/esbuild/lib/main.js';
import fs from 'fs';
const L = '/home/claude/libs';
const map = [
  [/^three$/, `${L}/three/src/Three.js`],
  [/^three\/addons\/(.*)$/, `${L}/three/examples/jsm/$1`],
  [/^three\/examples\/jsm\/(.*)$/, `${L}/three/examples/jsm/$1`],
  [/^3d-tiles-renderer$/, `${L}/tiles/src/index.js`],
  [/^3d-tiles-renderer\/plugins$/, `${L}/tiles/src/plugins.js`],
  [/^3d-tiles-renderer\/core$/, `${L}/tiles/src/core/renderer/index.js`],
  [/^3d-tiles-renderer\/core\/plugins$/, `${L}/tiles/src/core/plugins/index.js`],
  [/^3d-tiles-renderer\/three$/, `${L}/tiles/src/three/renderer/index.js`],
  [/^3d-tiles-renderer\/three\/plugins$/, `${L}/tiles/src/three/plugins/index.js`],
  [/^3d-tiles-renderer\/src\/(.*)$/, `${L}/tiles/src/$1`],
  [/^three-mesh-bvh$/, `${L}/bvh/src/index.js`],
];
const alias = { name: 'alias', setup(b) {
  b.onResolve({ filter: /^(pmtiles|@mapbox\/vector-tile|pbf)$/ }, a => ({ path: a.path, namespace: 'stub' }));
  b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export default class {}; export class PMTiles {}; export class VectorTile {}; export class FetchSource {};', loader: 'js' })); b.onResolve({ filter: /^(three|3d-tiles-renderer|three-mesh-bvh)/ }, a => {
  for (const [re, p] of map) if (re.test(a.path)) return { path: a.path.replace(re, p) };
  return { errors: [{ text: 'unmapped ' + a.path }] }; }) } };
const r = await esbuild.build({ entryPoints: [process.env.ENTRY || 'src/main.js'], bundle: true, minify: process.argv.includes('--min'), format: 'esm',
  target: 'es2020', write: false, plugins: [alias], legalComments: 'none', logLevel: 'warning' });
const js = r.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const html = fs.readFileSync(process.env.SHELLFILE || 'src/shell.html', 'utf8').replace('/*__BUNDLE__*/', () => js);
fs.writeFileSync(process.env.OUT || 'dist/index.html', html);
console.log('ok', (html.length / 1024).toFixed(0) + ' KB');
