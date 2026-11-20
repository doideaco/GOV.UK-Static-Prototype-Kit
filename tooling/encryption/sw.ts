// Service worker for the encrypted export: decrypt once, then serve pages from the browser's cache.
//
// The unlock screen decrypts the whole site once and hands the files to this worker, which keeps them in
// Cache Storage and answers page and asset requests from there. It never decrypts anything itself and
// never caches what it fetches from the network.
//
// Trade-off: decrypted pages stay on the device after the tab closes, until someone locks the prototype,
// opens it without an unlocked session (each decrypted page checks for one and clears the cache if
// not), or a new version is deployed.

type InstallMessage = { type: 'install'; version: string; files: Record<string, { type: string; body: ArrayBuffer }> };
type PurgeMessage = { type: 'purge' };
type RecheckMessage = { type: 'recheck' };
type WorkerScope = {
  registration: { scope: string };
  location: Location;
  addEventListener(type: 'install' | 'activate', listener: (event: { waitUntil(p: Promise<unknown>): void }) => void): void;
  addEventListener(type: 'message', listener: (event: { data: InstallMessage | PurgeMessage | RecheckMessage; ports: readonly MessagePort[]; waitUntil(p: Promise<unknown>): void }) => void): void;
  addEventListener(type: 'fetch', listener: (event: { request: Request; respondWith(r: Promise<Response>): void }) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
};
const worker = self as unknown as WorkerScope;
const base = new URL(worker.registration.scope).pathname;
const PREFIX = 'encrypted-prototype:';
const VERSION_URL = `${base}__encrypted/version.txt`;
// Check for a new deploy at most once a minute, so most navigations need no network request.
// Safari stops idle service workers quickly, which would reset an in-memory timer and send every
// navigation to the network, so the time of the last check is also kept in Cache Storage.
const CHECK_INTERVAL = 60_000;
const META_CACHE = 'encrypted-prototype-meta';
const CHECK_KEY = `${base}__encrypted/last-check`;
let lastCheck = 0;
async function readLastCheck() {
  if (lastCheck) return lastCheck;
  try { lastCheck = Number(await (await (await caches.open(META_CACHE)).match(CHECK_KEY))?.text()) || 0; } catch {}
  return lastCheck;
}
async function writeLastCheck(time: number) {
  lastCheck = time;
  try { await (await caches.open(META_CACHE)).put(CHECK_KEY, new Response(String(time))); } catch {}
}

async function currentCache() {
  const name = (await caches.keys()).find(key => key.startsWith(PREFIX));
  return name ? { name, version: name.slice(PREFIX.length), cache: await caches.open(name) } : undefined;
}
async function purge() {
  await Promise.all((await caches.keys()).filter(key => key.startsWith(PREFIX)).map(key => caches.delete(key)));
}
async function install({ version, files }: InstallMessage) {
  await purge();
  const cache = await caches.open(PREFIX + version);
  await Promise.all(Object.entries(files).map(([path, file]) => {
    const response = () => new Response(file.body, { headers: { 'Content-Type': file.type, 'Cache-Control': 'no-store' } });
    const url = new URL(base + path.slice(1), worker.location.origin).href;
    // Pages are requested by directory ("/find/"), assets by file name.
    const puts = [cache.put(url, response())];
    if (path.endsWith('/index.html')) puts.push(cache.put(url.slice(0, -'index.html'.length), response()));
    return Promise.all(puts);
  }));
}

worker.addEventListener('install', event => event.waitUntil(worker.skipWaiting()));
worker.addEventListener('activate', event => event.waitUntil(worker.clients.claim()));
worker.addEventListener('message', event => {
  const reply = () => event.ports[0]?.postMessage('done');
  const fail = () => event.ports[0]?.postMessage('failed');
  // "recheck" makes the next navigation check for a new deploy straight away (used by tests).
  if (event.data.type === 'recheck') { event.waitUntil(writeLastCheck(0).then(reply)); return; }
  const work = event.data.type === 'install' ? install(event.data) : purge();
  event.waitUntil(work.then(reply, async () => { await purge(); fail(); }));
});

worker.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Only plain GET requests for this prototype's own pages and assets; the encrypted files always come
  // from the network.
  if (request.method !== 'GET' || url.origin !== worker.location.origin || !url.pathname.startsWith(base)) return;
  if (url.pathname.startsWith(`${base}__encrypted/`) || url.pathname === `${base}sw.js`) return;
  event.respondWith((async () => {
    const current = await currentCache();
    if (!current) return fetch(request);
    if (request.mode === 'navigate' && Date.now() - await readLastCheck() > CHECK_INTERVAL) {
      // A new deploy has a new version: drop the old pages and load the unlock screen. Bypass the HTTP
      // cache for both, so a cached old unlock screen cannot reinstall the old version in a loop.
      try {
        const deployed = await fetch(VERSION_URL, { cache: 'no-store' }).then(r => r.ok ? r.text() : undefined);
        await writeLastCheck(Date.now());
        if (deployed && deployed.trim() !== current.version) {
          await purge();
          return fetch(url.href, { cache: 'reload', credentials: 'same-origin' });
        }
      } catch { /* Offline: keep serving what was decrypted. */ }
    }
    const hit = await current.cache.match(url.origin + url.pathname);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const missing = await current.cache.match(`${url.origin}${base}404.html`);
      if (missing) return new Response(missing.body, { status: 404, headers: missing.headers });
    }
    return fetch(request);
  })());
});
