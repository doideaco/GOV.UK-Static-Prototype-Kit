// @ts-expect-error StatiCrypt wrapper is shared between the Node exporter and browser.
import { deriveKey, decryptWithKey } from './crypto.mjs';

type FileEntry = {data?: string; text?: string; type: string};
type Archive = {files: Record<string, FileEntry>};
type Envelope = {format: number; compression?: 'gzip'; salt: string; payload: string; base: string};
const loader = document.currentScript as HTMLScriptElement;
const payloadUrl = loader.dataset.payload!;
const form = document.querySelector<HTMLFormElement>('#unlock-form')!;
const input = document.querySelector<HTMLInputElement>('#encryption-passphrase')!;
const button = form.querySelector<HTMLButtonElement>('button')!;
const status = document.querySelector<HTMLElement>('#unlock-status')!;
const summary = document.querySelector<HTMLElement>('#unlock-error')!;
const errorMessage = document.querySelector<HTMLElement>('#unlock-error-message')!;
const urls: string[] = [];
let envelopePromise: Promise<Envelope> | undefined;
let opening = false;
function envelope() {
  // The payload URL carries a content hash, so the browser can reuse it between pages and still
  // fetches a new copy after each deploy.
  // Revalidate with the server ("not modified" when unchanged), so a stale unlock screen still gets the
  // deployed payload and its salt matches __encrypted/version.txt.
  return envelopePromise ||= fetch(payloadUrl, {cache:'no-cache'}).then(async response => {
    if (!response.ok) throw Error('Unable to load the encrypted prototype. Reload the page and try again.');
    const value = await response.json();
    if (![1,2].includes(value.format) || (value.format === 2 && value.compression !== 'gzip') || typeof value.salt !== 'string' || typeof value.payload !== 'string' || typeof value.base !== 'string') throw Error('Unsupported encrypted prototype format.');
    return value as Envelope;
  }).catch(error => { envelopePromise = undefined; throw error; });
}
function sessionKey(base: string) { return `govuk-static-kit:encrypted:${base}`; }
function forget(base: string) { try { sessionStorage.removeItem(sessionKey(base)); } catch {} }
function remember(data: Envelope, key: string) {
  try { sessionStorage.setItem(sessionKey(data.base), JSON.stringify({salt:data.salt,key})); } catch {}
}
function showError(message: string) {
  errorMessage.textContent = message;
  summary.hidden = false;
  input.setAttribute('aria-invalid','true');
  input.setAttribute('aria-describedby','unlock-hint unlock-error-message');
  summary.focus();
}
function decodeFile(file: FileEntry) {
  if (file.text !== undefined) return new TextEncoder().encode(file.text);
  return Uint8Array.from(atob(file.data!), char => char.charCodeAt(0));
}
function render(archive: Archive, data: Envelope) {
  const root = new URL(data.base, location.origin);
  const sourceUrl = (file: string) => new URL(file.slice(1), root);
  const findFile = (value: string, relativeTo: URL): string | undefined => {
    if (/^(?:data:|blob:|#|mailto:|tel:)/i.test(value)) return;
    const resolved = new URL(value, relativeTo);
    if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname)) return;
    const file = '/' + decodeURIComponent(resolved.pathname.slice(root.pathname.length));
    return Object.hasOwn(archive.files,file) ? file : undefined;
  };
  const blobCache = new Map<string,string>();
  const building = new Set<string>();
  function rewriteCss(css: string, relativeTo: URL): string {
    // Sass normally flattens imports. These also support ordinary local CSS imports.
    const imported = css.replace(/@import\s+(['"])([^'"]+)\1/g, (_, quote, value) => `@import url("${asset(value,relativeTo)}")`);
    return imported.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/g, (_, double, single, bare) => {
      const original = (double ?? single ?? bare).trim();
      return `url("${asset(original,relativeTo)}")`;
    });
  }
  function asset(value: string, relativeTo: URL): string {
    const file = findFile(value,relativeTo);
    if (!file) return value;
    const fragment = new URL(value, relativeTo).hash;
    if (blobCache.has(file)) return blobCache.get(file)! + fragment;
    if (building.has(file)) throw Error('A circular stylesheet import cannot be opened in encrypted export.');
    building.add(file);
    const entry = archive.files[file];
    const bytes = decodeFile(entry);
    const body = entry.type === 'text/css' ? rewriteCss(new TextDecoder().decode(bytes),sourceUrl(file)) : bytes;
    const blobUrl = URL.createObjectURL(new Blob([body],{type:entry.type}));
    urls.push(blobUrl); blobCache.set(file,blobUrl); building.delete(file);
    return blobUrl + fragment;
  }
  const pathname = '/' + decodeURIComponent(location.pathname.slice(root.pathname.length));
  const page = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
  const file = archive.files[page] || archive.files['/404.html'];
  if (!file || file.type !== 'text/html') throw Error('This page is not included in the encrypted prototype. Check the link you were sent.');
  const html = new TextDecoder().decode(decodeFile(file));
  const doc = new DOMParser().parseFromString(html,'text/html');
  // An authored base tag must not redirect resource resolution away from the encrypted map.
  doc.querySelectorAll('base').forEach(el => el.remove());
  const relativeTo = new URL(location.href);
  doc.querySelectorAll<HTMLElement>('*').forEach(el => {
    for (const attribute of ['src','poster','data','background']) {
      const value = el.getAttribute(attribute);
      if (value) el.setAttribute(attribute,asset(value,relativeTo));
    }
    const href = el.getAttribute('href');
    if (href) {
      const target = findFile(href,relativeTo);
      if (target && archive.files[target].type !== 'text/html') el.setAttribute('href',asset(href,relativeTo));
    }
    const srcset = el.getAttribute('srcset');
    if (srcset && !srcset.includes('data:')) el.setAttribute('srcset',srcset.split(',').map(part => {
      const [value,...descriptor] = part.trim().split(/\s+/);
      return [asset(value,relativeTo),...descriptor].join(' ');
    }).join(', '));
    const style = el.getAttribute('style');
    if (style) el.setAttribute('style',rewriteCss(style,relativeTo));
  });
  doc.querySelectorAll('style').forEach(style => { style.textContent = rewriteCss(style.textContent || '',relativeTo); });
  const nav = doc.createElement('nav'); nav.setAttribute('aria-label','Encrypted prototype');
  nav.className = 'govuk-width-container govuk-!-padding-bottom-4';
  const lock = doc.createElement('button'); lock.type = 'button'; lock.className = 'govuk-button govuk-button--secondary'; lock.textContent = 'Lock prototype'; lock.dataset.encryptedLock = '';
  nav.append(lock); (doc.querySelector('main') || doc.body).after(nav);
  // Parse the prototype's namespace before replacing the unlock screen.
  let prototypeConfig: any;
  try { prototypeConfig = JSON.parse(doc.querySelector('#prototype-config')?.textContent || '{}'); } catch {}
  const controls = doc.createElement('script');
  const settings = {base:data.base,site:prototypeConfig?.site,blobUrls:urls};
  controls.textContent = `(${installLock.toString()})(${JSON.stringify(settings).replace(/</g,'\\u003c')});`;
  doc.body.append(controls);
  document.open();
  document.write('<!doctype html>\n' + doc.documentElement.outerHTML);
  document.close();
}
// Installed by the new document's parser, rather than on the document being replaced.
function installLock(settings: {base:string;site:any;blobUrls:string[]}) {
  const credential = 'govuk-static-kit:encrypted:' + settings.base;
  document.querySelector('[data-encrypted-lock]')!.addEventListener('click', () => {
    try { sessionStorage.removeItem(credential); sessionStorage.removeItem(credential + ':installs'); } catch {}
    const site = settings.site;
    if (site) {
      const key = `govuk-static-kit:${site.prototypeId}:v${site.schemaVersion}`;
      try { (site.storage === 'local' ? localStorage : sessionStorage).removeItem(key); } catch {}
      try { sessionStorage.removeItem(key+':scenario'); sessionStorage.removeItem(key+':gate'); } catch {}
    }
    settings.blobUrls.forEach(url => URL.revokeObjectURL(url));
    const reload = () => location.replace(location.pathname);
    const controller = navigator.serviceWorker?.controller;
    if (!controller) return reload();
    const channel = new MessageChannel();
    channel.port1.onmessage = reload;
    controller.postMessage({type:'purge'}, [channel.port2]);
    setTimeout(reload, 3000);
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      try { if (!sessionStorage.getItem(credential)) location.reload(); } catch { location.reload(); }
    }
  });
}

// Runs first in every page the service worker serves. Without an unlocked session in this tab, hide the
// page before it paints, clear the decrypted cache, and reload so the unlock screen loads instead.
function pageGuard(settings: {credential:string}) {
  try { if (sessionStorage.getItem(settings.credential)) return; } catch {}
  document.documentElement.style.display = 'none';
  const reload = () => location.replace(location.href);
  const controller = navigator.serviceWorker?.controller;
  if (!controller) return reload();
  const channel = new MessageChannel();
  channel.port1.onmessage = reload;
  controller.postMessage({type:'purge'}, [channel.port2]);
  setTimeout(reload, 3000);
}
const serialise = (value: unknown) => JSON.stringify(value).replace(/</g,'\\u003c');
const lockNav = '<nav aria-label="Encrypted prototype" class="govuk-width-container govuk-!-padding-bottom-4"><button type="button" class="govuk-button govuk-button--secondary" data-encrypted-lock>Lock prototype</button></nav>';

// Decrypt once: hand every file to the service worker, then reload so it serves the real page.
// Returns false when service workers are unavailable, so the caller can render in place instead.
async function installWithServiceWorker(archive: Archive, data: Envelope) {
  if (!('serviceWorker' in navigator)) return false;
  // Loop breaker: if this tab has already installed twice in the last 30 seconds, something is sending it
  // back to the unlock screen. Stop using the service worker and render in place instead.
  const attemptsKey = sessionKey(data.base) + ':installs';
  let attempts: number[] = [];
  try { attempts = (JSON.parse(sessionStorage.getItem(attemptsKey) || '[]') as number[]).filter(time => Date.now() - time < 30000); } catch {}
  if (attempts.length >= 2) return false;
  try { sessionStorage.setItem(attemptsKey, JSON.stringify([...attempts, Date.now()])); } catch {}
  try {
    // Some browsers or policies block service workers in a way that never settles: fall back after 3 seconds.
    const timeout = new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 3000));
    const registration = await Promise.race([
      navigator.serviceWorker.register(`${data.base}sw.js`, {scope: data.base}).then(async r => { await navigator.serviceWorker.ready; return r; }),
      timeout
    ]);
    const worker = registration?.active;
    if (!worker) return false;
    let prototypeConfig: any;
    try { prototypeConfig = JSON.parse(new TextDecoder().decode(decodeFile(archive.files['/index.html'])).match(/<script id="prototype-config" type="application\/json">([\s\S]*?)<\/script>/)?.[1] || '{}'); } catch {}
    const credential = sessionKey(data.base);
    const guard = `<script>(${pageGuard.toString()})(${serialise({credential})});</script>`;
    const controls = `<script>(${installLock.toString()})(${serialise({base:data.base,site:prototypeConfig?.site,blobUrls:[]})});</script>`;
    const files: Record<string,{type:string;body:ArrayBuffer}> = {};
    for (const [path, entry] of Object.entries(archive.files)) {
      let bytes = decodeFile(entry);
      if (entry.type === 'text/html') {
        const html = new TextDecoder().decode(bytes)
          .replace(/<head([^>]*)>/i, match => match + guard)
          .replace('</main>', '</main>' + lockNav)
          .replace('</body>', controls + '</body>');
        bytes = new TextEncoder().encode(html);
      }
      files[path] = {type:entry.type, body:bytes.buffer as ArrayBuffer};
    }
    const installed = await new Promise<boolean>(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = event => resolve(event.data === 'done');
      worker.postMessage({type:'install', version:data.salt, files}, [channel.port2, ...Object.values(files).map(file => file.body)]);
      setTimeout(() => resolve(false), 10000);
    });
    if (!installed) return false;
    location.replace(location.href);
    return true;
  } catch { return false; }
}
async function gunzip(base64: string) {
  if (typeof DecompressionStream === 'undefined') throw Error('Update your browser to open this prototype.');
  const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
}
async function openWithKey(data: Envelope, key: string) {
  const result = await decryptWithKey(data.payload,key,data.salt);
  if (!result.success) return false;
  const archive = JSON.parse(data.compression === 'gzip' ? await gunzip(result.decoded) : result.decoded) as Archive;
  if (!archive.files || !Object.hasOwn(archive.files,'/index.html')) throw Error('The encrypted prototype is incomplete.');
  // Cache only a successful decryption key. It is a credential, not a harmless hash.
  remember(data,key);
  if (!await installWithServiceWorker(archive,data)) render(archive,data);
  return true;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (opening) return;
  opening = true; button.disabled = true; summary.hidden = true; status.textContent = 'Unlocking prototype';
  // On success the page is replaced or reloads: keep the message and disabled button until it does,
  // rather than briefly showing a ready form again.
  let unlocked = false;
  try {
    if (!globalThis.crypto?.subtle) throw Error('Open this prototype over HTTPS or localhost to use browser decryption.');
    const data = await envelope();
    const passphrase = input.value; input.value = '';
    const key = await deriveKey(passphrase,data.salt);
    unlocked = await openWithKey(data,key);
    if (!unlocked) { forget(data.base); showError('The passphrase is incorrect, or the encrypted file has changed. Try again.'); }
  } catch (error) { showError(error instanceof Error ? error.message : 'Unable to unlock this prototype.'); }
  finally { if (!unlocked) { opening = false; button.disabled = false; status.textContent = ''; } }
});
async function purgeDecrypted() {
  try { await Promise.all((await caches.keys()).filter(key => key.startsWith('encrypted-prototype:')).map(key => caches.delete(key))); } catch {}
}
// The shell hides the form when this tab looks already unlocked. Show it if resuming fails or stalls.
function showForm() {
  if (!document.documentElement.classList.contains('encrypted-resuming')) { input.focus(); return; }
  document.documentElement.classList.remove('encrypted-resuming');
  input.focus();
}
setTimeout(showForm, 10000);
input.disabled = false; button.disabled = false; button.removeAttribute('aria-disabled');
// Only the generic shell is visible while a remembered key is checked.
(async () => {
  try {
    const data = await envelope();
    let cached: {salt:string;key:string} | undefined;
    try { cached = JSON.parse(sessionStorage.getItem(sessionKey(data.base)) || 'null'); } catch {}
    if (cached?.salt === data.salt) {
      if (await openWithKey(data,cached.key)) return;
      forget(data.base);
    } else if (cached) forget(data.base);
    // No usable session in this tab: clear any decrypted pages left by an earlier session.
    await purgeDecrypted();
  } catch { /* The form provides a focused, accessible error on explicit entry. */ }
  showForm();
})();
