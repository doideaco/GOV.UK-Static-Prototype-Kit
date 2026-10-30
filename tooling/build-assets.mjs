import { build } from 'esbuild';
import { compile } from 'sass';
import fs from 'node:fs';
fs.mkdirSync('build', {recursive:true});
fs.writeFileSync('build/main.css', compile('src/assets/styles/main.scss', {loadPaths:['node_modules/govuk-frontend/dist'], style:'compressed', quietDeps:true, silenceDeprecations:['import','global-builtin','if-function','color-functions']}).css);
await build({entryPoints:['src/assets/scripts/runtime.ts'], outfile:'build/runtime.js',bundle:true,minify:true,target:'es2022'});
