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
 const env={...process.env};delete env.ENCRYPTION_PASSPHRASE;
 const absent=spawnSync(process.execPath,['tooling/encryption/build.mjs'],{env,encoding:'utf8'});
 expect(absent.status).toBe(1);expect(absent.stderr).toContain('Set ENCRYPTION_PASSPHRASE');
 const invalid=spawnSync(process.execPath,['tooling/encryption/deploy-build.mjs'],{env:{...env,PROTOTYPE_PUBLISH_MODE:'typo'},encoding:'utf8'});
 expect(invalid.status).toBe(1);expect(invalid.stderr).toContain('Deployment stopped');
 const short=spawnSync(process.execPath,['tooling/encryption/build.mjs'],{env:{...env,ENCRYPTION_PASSPHRASE:'DoNotEchoThis'},encoding:'utf8'});
 expect(short.status).toBe(1);expect(short.stderr).not.toContain('DoNotEchoThis');
});
