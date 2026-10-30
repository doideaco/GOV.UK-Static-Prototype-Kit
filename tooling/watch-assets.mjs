import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
let timer;
watch('src/assets', {recursive:true}, () => { clearTimeout(timer); timer = setTimeout(() => spawn(process.execPath,['tooling/build-assets.mjs'],{stdio:'inherit'}),100); });
