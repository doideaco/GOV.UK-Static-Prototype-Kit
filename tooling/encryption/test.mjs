import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
const base = '/sample.repo/';
function run(args, env) {
  return new Promise((resolve,reject) => {
    const child = spawn(process.execPath,args,{stdio:'inherit',env});
    child.on('error',reject); child.on('exit',code => code === 0 ? resolve() : reject(Error('Encrypted export checks failed')));
  });
}
// A new, throwaway credential per test run, passed only through process memory/environment.
const passphrase = randomBytes(32).toString('base64url');
const env = {...process.env,BASE_PATH:base,NODE_ENV:'production'};
delete env.ENCRYPTION_PASSPHRASE;
await new Promise((resolve,reject) => {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',['run','build:encrypted'],{stdio:'inherit',env:{...env,ENCRYPTION_PASSPHRASE:passphrase}});
  child.on('error',reject); child.on('exit',code => code === 0 ? resolve() : reject(Error('Static build failed')));
});
await run(['node_modules/@playwright/test/cli.js','test','--config=playwright.encrypted.config.ts'],{...env,ENCRYPTION_TEST_PASSPHRASE:passphrase});
