import fs from 'node:fs';
import path from 'node:path';
const base = process.env.BASE_PATH || '/';
let checked = 0;
function walk(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) { const file = path.join(dir,entry.name); if (entry.isDirectory()) walk(file); else if (file.endsWith('.html')) {
 const html = fs.readFileSync(file,'utf8');
 for (const [,link] of html.matchAll(/(?:href|src|action)="([^"#?]+)(?:[?#][^"]*)?"/g)) {
  if (!link.startsWith('/')) continue;
  if (!link.startsWith(base)) throw Error(`Missing base path: ${link}`);
  const local = path.join('_site',link.slice(base.length));
  if (!fs.existsSync(local) && !fs.existsSync(path.join(local,'index.html'))) throw Error(`Broken URL in ${file}: ${link}`);
  checked++;
 }
} } }
walk('_site'); console.log(`Verified ${checked} local URLs under ${base}`);
