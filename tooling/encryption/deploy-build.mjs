import { spawn } from 'node:child_process';
const mode = process.env.PROTOTYPE_PUBLISH_MODE || 'static';
if (!['static','encrypted'].includes(mode)) throw Error('PROTOTYPE_PUBLISH_MODE must be static or encrypted. Deployment stopped.');
const env = {...process.env};
if (mode === 'static') delete env.ENCRYPTION_PASSPHRASE;
const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm',['run',mode === 'encrypted' ? 'build:encrypted' : 'build'],{stdio:'inherit',env});
child.on('error',()=>{ console.error('Deployment build could not start.'); process.exitCode=1; });
child.on('exit',code=>{ process.exitCode=code ?? 1; });
