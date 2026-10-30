import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { exportEncrypted, validatePassphrase } from './export.mjs';
async function passphrase() {
  if (process.env.ENCRYPTION_PASSPHRASE) return process.env.ENCRYPTION_PASSPHRASE;
  if (!process.stdin.isTTY) throw Error('Set ENCRYPTION_PASSPHRASE as a build-time secret for encrypted export. No unencrypted fallback will be published.');
  const silent = new Writable({write(_chunk,_encoding,done) { done(); }});
  const reader = createInterface({input:process.stdin,output:silent,terminal:true});
  process.stdout.write('Encryption passphrase (20+ characters, input hidden): ');
  try { return await reader.question(''); }
  finally { reader.close(); process.stdout.write('\n'); }
}
try {
  const password = await passphrase();
  validatePassphrase(password);
  // The ordinary template/asset build never receives the secret environment value.
  const env = {...process.env}; delete env.ENCRYPTION_PASSPHRASE;
  await new Promise((resolve,reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',['run','build'],{stdio:'inherit',env});
    child.on('error',reject);
    child.on('exit',code => code === 0 ? resolve(undefined) : reject(Error('Static build failed; encrypted export was not published.')));
  });
  await exportEncrypted({passphrase:password});
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Encrypted export failed');
  process.exitCode = 1;
}
