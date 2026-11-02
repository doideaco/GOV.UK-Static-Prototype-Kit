import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { publishingConfig } from './publish-config.mjs';
import { validatePassphrase } from './export.mjs';
const config = publishingConfig(process.env.PROTOTYPE_PUBLISH_MODE);
const env = {...process.env};
// Fail before invoking a build if encrypted publishing has no valid credential.
if (config.mode === 'encrypted') validatePassphrase(env.ENCRYPTION_PASSPHRASE);
else delete env.ENCRYPTION_PASSPHRASE;
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',['run',config.command],{stdio:'inherit',env});
child.on('error',()=>{ console.error('Deployment build could not start.'); process.exitCode=1; });
child.on('exit',code=>{
  process.exitCode=code ?? 1;
  // Upload the output selected by the successful build, not an independent workflow fallback.
  if (code === 0 && process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`directory=${config.directory}\n`);
  }
});
