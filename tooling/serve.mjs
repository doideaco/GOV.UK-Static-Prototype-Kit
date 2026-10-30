import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const base=process.env.BASE_PATH || '/';
http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/'){res.end('Ready');return;}if(!p.startsWith(base)){res.writeHead(404).end();return;}let file=path.resolve('_site',p.slice(base.length));if(!file.startsWith(path.resolve('_site')+path.sep)&&file!==path.resolve('_site')){res.writeHead(403).end();return;}try{if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}}).listen(8080);
