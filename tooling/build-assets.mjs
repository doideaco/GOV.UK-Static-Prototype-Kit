import { build } from 'esbuild';
import { compile } from 'sass';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

// Reuse only local, byte-for-byte verified outputs. Never cache plaintext exports
// or credentials. Hash dependency inputs too, so npm ci or tooling edits invalidate.
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = ['package-lock.json', ...['src/assets', 'tooling'].flatMap(directory =>
  fs.readdirSync(directory, {recursive:true}).map(file => `${directory}/${file}`).filter(file => fs.statSync(file).isFile())
)].sort();
const fingerprint = digest(process.version + '\n' + process.platform + '\n' + process.arch + '\n' + inputs.map(file => `${file}\0${digest(fs.readFileSync(file))}`).join('\n'));
const outputs = ['build/main.css', 'build/runtime.js'];
let previous;
try { previous = JSON.parse(fs.readFileSync('build/asset-cache.json','utf8')); } catch {}
if (previous?.fingerprint === fingerprint && outputs.every(file => fs.existsSync(file) && previous.outputs?.[file] === digest(fs.readFileSync(file)))) {
  console.log('Assets unchanged; reusing verified CSS and JavaScript.');
} else {
  fs.mkdirSync('build', {recursive:true});
  fs.writeFileSync('build/main.css', compile('src/assets/styles/main.scss', {loadPaths:['node_modules/govuk-frontend/dist'], style:'compressed', quietDeps:true, silenceDeprecations:['import','global-builtin','if-function','color-functions']}).css);
  await build({entryPoints:['src/assets/scripts/runtime.ts'], outfile:'build/runtime.js',bundle:true,minify:true,target:'es2022'});
  fs.writeFileSync('build/asset-cache.json', JSON.stringify({fingerprint,outputs:Object.fromEntries(outputs.map(file => [file,digest(fs.readFileSync(file))]))}));
  console.log('Built CSS and JavaScript.');
}
