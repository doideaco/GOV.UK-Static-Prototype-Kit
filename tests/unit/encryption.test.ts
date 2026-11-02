import { test, expect } from 'vitest';
import { deriveKey, randomSalt, encryptWithKey, decryptWithKey } from '../../tooling/encryption/crypto.mjs';
import { validatePassphrase } from '../../tooling/encryption/export.mjs';
test('StatiCrypt round-trip rejects wrong keys and modified ciphertext',async()=>{
 const salt=randomSalt();const key=await deriveKey('Test-only, fictional encryption phrase',salt);
 const encoded=await encryptWithKey('private fictional content',key);
 expect(encoded).not.toContain('private fictional content');
 expect(await decryptWithKey(encoded,key,salt)).toMatchObject({success:true,decoded:'private fictional content'});
 expect(await decryptWithKey(encoded,'0'.repeat(64),salt)).toMatchObject({success:false});
 expect(await decryptWithKey(encoded.slice(0,-1)+(encoded.at(-1)==='0'?'1':'0'),key,salt)).toMatchObject({success:false});
 expect(await encryptWithKey('private fictional content',key)).not.toBe(encoded);
});
test('missing or short credentials fail without echoing their value',()=>{
 for (const value of [undefined,'','short',' '.repeat(30)]) expect(()=>validatePassphrase(value)).toThrow('at least 20 characters');
 expect(()=>validatePassphrase('A sufficiently long fictional phrase')).not.toThrow();
});

test('noninteractive builds fail closed for absent credentials or an invalid publishing mode',async()=>{
 const { spawnSync }=await import('node:child_process');
 const env={...process.env};delete env.ENCRYPTION_PASSPHRASE;delete env.PROTOTYPE_PUBLISH_MODE;
 const absent=spawnSync(process.execPath,['tooling/encryption/build.mjs'],{env,encoding:'utf8'});
 expect(absent.status).toBe(1);expect(absent.stderr).toContain('Set ENCRYPTION_PASSPHRASE');
 const invalid=spawnSync(process.execPath,['tooling/encryption/deploy-build.mjs'],{env:{...env,PROTOTYPE_PUBLISH_MODE:'typo'},encoding:'utf8'});
 expect(invalid.status).toBe(1);expect(invalid.stderr).toContain('Deployment stopped');
 const short=spawnSync(process.execPath,['tooling/encryption/build.mjs'],{env:{...env,ENCRYPTION_PASSPHRASE:'DoNotEchoThis'},encoding:'utf8'});
 expect(short.status).toBe(1);expect(short.stderr).not.toContain('DoNotEchoThis');
});


test('publishing defaults to encrypted output and requires an explicit plaintext opt-out',async()=>{
 const { publishingConfig }=await import('../../tooling/encryption/publish-config.mjs');
 expect(publishingConfig(undefined)).toEqual({mode:'encrypted',command:'build:encrypted',directory:'_encrypted'});
 expect(publishingConfig('')).toEqual(publishingConfig('encrypted'));
 expect(publishingConfig('static')).toEqual({mode:'static',command:'build',directory:'_site'});
 expect(()=>publishingConfig('typo')).toThrow('Deployment stopped');
 const { spawnSync }=await import('node:child_process');
 const env={...process.env};delete env.ENCRYPTION_PASSPHRASE;delete env.PROTOTYPE_PUBLISH_MODE;
 const result=spawnSync(process.execPath,['tooling/encryption/deploy-build.mjs'],{env,encoding:'utf8'});
 expect(result.status).toBe(1);
 expect(result.stderr).toContain('ENCRYPTION_PASSPHRASE');
 expect(result.stdout).not.toContain('eleventy');
});

test.each([
 {mode:undefined,command:'build:encrypted',directory:'_encrypted',hasSecret:true},
 {mode:'static',command:'build',directory:'_site',hasSecret:false}
])('successful $directory publishing reports the actual upload directory and scopes the secret',async({mode,command,directory,hasSecret})=>{
 const fs=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');
 const { spawnSync }=await import('node:child_process');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'prototype-publish-test-'));
 try {
  const executable=path.join(temp,'npm');
  await fs.writeFile(executable,'#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({args:process.argv.slice(2),hasSecret:Boolean(process.env.ENCRYPTION_PASSPHRASE)}));\n',{mode:0o755});
  const output=path.join(temp,'github-output');
  const env={...process.env,PATH:temp+path.delimiter+process.env.PATH,GITHUB_OUTPUT:output,ENCRYPTION_PASSPHRASE:'Fictional test-only publishing passphrase'};
  if (mode) env.PROTOTYPE_PUBLISH_MODE=mode;else delete env.PROTOTYPE_PUBLISH_MODE;
  const result=spawnSync(process.execPath,['tooling/encryption/deploy-build.mjs'],{env,encoding:'utf8'});
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual({args:['run',command],hasSecret});
  expect(await fs.readFile(output,'utf8')).toBe(`directory=${directory}\n`);
 } finally {await fs.rm(temp,{recursive:true,force:true});}
});
