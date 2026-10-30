import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const base=process.env.BASE_PATH || '/';
const output=process.env.TEST_OUTPUT || '_site';
const port=Number(process.env.TEST_PORT || 8080);
http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/'&&base!=='/'){res.end('Ready');return;}if(!p.startsWith(base)){res.writeHead(404).end();return;}let file=path.resolve(output,p.slice(base.length));if(!file.startsWith(path.resolve(output)+path.sep)&&file!==path.resolve(output)){res.writeHead(403).end();return;}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(port);
