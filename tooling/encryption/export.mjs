import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { compileString } from 'sass';
import { deriveKey, randomSalt, encryptWithKey } from './crypto.mjs';
const require = createRequire(import.meta.url);
const nunjucks = require('nunjucks');
export const outputDirectory = '_encrypted';
export const minimumPassphraseLength = 20;
export function validatePassphrase(value) {
  if (typeof value !== 'string' || value.trim().length < minimumPassphraseLength) {
    throw Error(`ENCRYPTION_PASSPHRASE must contain at least ${minimumPassphraseLength} characters. Use a long, unique, randomly generated passphrase.`);
  }
}
const types = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.gif':'image/gif', '.ico':'image/x-icon', '.woff':'font/woff', '.woff2':'font/woff2', '.pdf':'application/pdf', '.txt':'text/plain' };
export async function collectFiles(directory, prefix = '') {
  const result = {};
  for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
    if (entry.isSymbolicLink()) throw Error('Encrypted export does not accept symlinks');
    const relative = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) Object.assign(result, await collectFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) {
      const bytes = await fs.readFile(path.join(directory, entry.name));
      result[relative] = { data: bytes.toString('base64'), type: types[path.extname(entry.name)] || 'application/octet-stream' };
    }
  }
  return result;
}
export async function exportEncrypted({passphrase, base = process.env.BASE_PATH || '/', source = '_site'} = {}) {
  validatePassphrase(passphrase);
  if (!/^\/(?:[a-zA-Z0-9_.-]+\/)*$/.test(base) || base.includes('/../') || base.includes('/./')) throw Error('Invalid encryption base path');
  const files = await collectFiles(source);
  const pages = Object.keys(files).filter(name => name.endsWith('.html'));
  if (!pages.includes('/index.html')) throw Error('Build the prototype before encrypting it');
  if (!pages.every(p => p.endsWith('/index.html') || p === '/404.html')) throw Error('Encrypted pages need directory-style index.html output (or 404.html)');
  const salt = randomSalt();
  const key = await deriveKey(passphrase, salt);
  const payload = await encryptWithKey(JSON.stringify({files}), key);
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(['tooling/encryption','node_modules/govuk-frontend/dist']), {autoescape:true});
  const shell = env.render('unlock.njk', {root: `${base}__encrypted/`, credentialKey: JSON.stringify(`govuk-static-kit:encrypted:${base}`)});
  // Build outside the publish folder. Replace it only when the export is complete.
  const staging = await fs.mkdtemp(path.resolve('.encrypted-stage-'));
  try {
    const publicDir = path.join(staging, '__encrypted');
    await fs.mkdir(publicDir, {recursive:true});
    await fs.copyFile('node_modules/staticrypt/LICENSE',path.join(publicDir,'STATICRYPT-LICENSE.txt'));
    await fs.writeFile(path.join(publicDir,'payload.json'), JSON.stringify({format:1,salt,payload,base}));
    await fs.writeFile(path.join(publicDir,'unlock.css'), compileString('@use "govuk/index" with ($govuk-assets-path: "./assets/"); [hidden] {display:none !important}', {loadPaths:['node_modules/govuk-frontend/dist'],style:'compressed',quietDeps:true}).css);
    await fs.cp('node_modules/govuk-frontend/dist/govuk/assets', path.join(publicDir,'assets'), {recursive:true});
    await build({entryPoints:['tooling/encryption/unlock.ts'],outfile:path.join(publicDir,'unlock.js'),bundle:true,minify:true,target:'es2022',external:['node:crypto']});
    for (const page of pages) {
      const target = path.join(staging,page.slice(1));
      await fs.mkdir(path.dirname(target),{recursive:true});
      await fs.writeFile(target,shell);
    }
    // A generic error page also lets visitors unlock a direct link before seeing a 404.
    await fs.writeFile(path.join(staging,'404.html'),shell);
    await fs.writeFile(path.join(staging,'.nojekyll'),'');
    await fs.rm(outputDirectory,{recursive:true,force:true});
    await fs.rename(staging,outputDirectory);
  } catch (error) {
    await fs.rm(staging,{recursive:true,force:true});
    throw error;
  }
  console.log(`Encrypted ${Object.keys(files).length} files; publish only ${outputDirectory}/. Plaintext remains in ${source}/ locally.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await exportEncrypted({passphrase:process.env.ENCRYPTION_PASSPHRASE});
  } catch (error) {
    // Do not print objects or environment values that could include the passphrase.
    console.error(error instanceof Error ? error.message : 'Encrypted export failed');
    process.exitCode = 1;
  }
}
