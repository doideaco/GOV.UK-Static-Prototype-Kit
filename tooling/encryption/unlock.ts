// @ts-expect-error StatiCrypt wrapper is shared between the Node exporter and browser.
import { deriveKey, decryptWithKey } from './crypto.mjs';

type FileEntry = {data: string; type: string};
type Archive = {files: Record<string, FileEntry>};
type Envelope = {format: number; salt: string; payload: string; base: string};
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
  return envelopePromise ||= fetch(payloadUrl, {cache:'no-store'}).then(async response => {
    if (!response.ok) throw Error('Unable to load the encrypted prototype. Reload the page and try again.');
    const value = await response.json();
    if (value.format !== 1 || typeof value.salt !== 'string' || typeof value.payload !== 'string' || typeof value.base !== 'string') throw Error('Unsupported encrypted prototype format.');
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
  return Uint8Array.from(atob(file.data), char => char.charCodeAt(0));
}
const blobCache = new Map<string,string>();
let renderVersion = 0;
async function render(archive: Archive, data: Envelope) {
  const version = ++renderVersion;
  const root = new URL(data.base, location.origin);
  const sourceUrl = (file: string) => new URL(file.slice(1), root);
  const findFile = (value: string, relativeTo: URL): string | undefined => {
    if (/^(?:data:|blob:|#|mailto:|tel:)/i.test(value)) return;
    const resolved = new URL(value, relativeTo);
    if (resolved.origin !== root.origin || !resolved.pathname.startsWith(root.pathname)) return;
    const file = '/' + decodeURIComponent(resolved.pathname.slice(root.pathname.length));
    return Object.hasOwn(archive.files,file) ? file : undefined;
  };
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
  const settings = {base:data.base,site:prototypeConfig?.site,blobUrls:urls};
  // Keep the current page painted until the next page's styles are ready.
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) {
    if (Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).some(current => current.href === link.href)) continue;
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet'; stylesheet.href = link.href;
    await new Promise<void>((resolve,reject) => {
      stylesheet.onload = () => resolve();
      stylesheet.onerror = () => reject(Error('Unable to load prototype styles. Reload and try again.'));
      document.head.append(stylesheet);
    });
  }
  if (version !== renderVersion) return;
  const scripts = Array.from(doc.body.querySelectorAll('script')).filter(script => !script.type || script.type === 'text/javascript' || script.type === 'module');
  scripts.forEach(script => script.remove());
  document.title = doc.title;
  document.documentElement.className = doc.documentElement.className;
  document.body.replaceWith(document.importNode(doc.body,true));
  installLock(settings);
  for (const original of scripts) {
    if (version !== renderVersion) return;
    const script = document.createElement('script');
    for (const attribute of original.attributes) script.setAttribute(attribute.name,attribute.value);
    script.textContent = original.textContent;
    if (script.src) {
      await new Promise<void>((resolve,reject) => {
        script.onload = () => resolve(); script.onerror = () => reject(Error('Unable to start prototype page. Reload and try again.'));
        document.body.append(script);
      });
    } else document.body.append(script);
  }
  if (version !== renderVersion) return;
  window.scrollTo(0,0);
  const heading = document.querySelector<HTMLElement>('main h1');
  if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
}
// Installed by the new document's parser, rather than on the document being replaced.
function installLock(settings: {base:string;site:any;blobUrls:string[]}) {
  const credential = 'govuk-static-kit:encrypted:' + settings.base;
  document.querySelector('[data-encrypted-lock]')!.addEventListener('click', () => {
    try { sessionStorage.removeItem(credential); } catch {}
    const site = settings.site;
    if (site) {
      const key = `govuk-static-kit:${site.prototypeId}:v${site.schemaVersion}`;
      try { (site.storage === 'local' ? localStorage : sessionStorage).removeItem(key); } catch {}
      try { sessionStorage.removeItem(key+':scenario'); sessionStorage.removeItem(key+':gate'); } catch {}
    }
    settings.blobUrls.forEach(url => URL.revokeObjectURL(url));
    location.replace(location.pathname);
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      try { if (!sessionStorage.getItem(credential)) location.reload(); } catch { location.reload(); }
    }
  });
}

function installNavigation(archive: Archive, data: Envelope) {
  const root = new URL(data.base, location.origin);
  function included(target: URL) {
    if (target.origin !== root.origin || !target.pathname.startsWith(root.pathname)) return false;
    const path = '/' + decodeURIComponent(target.pathname.slice(root.pathname.length));
    return !!archive.files[path.endsWith('/') ? path + 'index.html' : path];
  }
  async function navigate(destination: string, replace = false, pop = false) {
    const target = new URL(destination,location.href);
    if (!included(target)) { location.assign(target.href); return; }
    // Locking still invalidates the in-memory journey, including history traversal.
    try { if (!sessionStorage.getItem(sessionKey(data.base))) { location.assign(target.href); return; } } catch { location.assign(target.href); return; }
    if (!pop) history[replace ? 'replaceState' : 'pushState'](null,'',target.href);
    try { await render(archive,data); } catch { location.reload(); }
  }
  (window as any).encryptedPrototypeNavigate = navigate;
  document.addEventListener('click',event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!link || link.hasAttribute('download') || link.hasAttribute('data-native') || (link.target && link.target !== '_self')) return;
    const target = new URL(link.href,location.href);
    if (!included(target) || (target.pathname === location.pathname && target.search === location.search && target.hash)) return;
    event.preventDefault();
    void navigate(target.href);
  });
  window.addEventListener('popstate',()=>{void navigate(location.href,false,true);});
}

async function openWithKey(data: Envelope, key: string) {
  const result = await decryptWithKey(data.payload,key,data.salt);
  if (!result.success) return false;
  const archive = JSON.parse(result.decoded) as Archive;
  if (!archive.files || !Object.hasOwn(archive.files,'/index.html')) throw Error('The encrypted prototype is incomplete.');
  // Cache only a successful decryption key. It is a credential, not a harmless hash.
  remember(data,key);
  installNavigation(archive,data);
  await render(archive,data);
  return true;
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (opening) return;
  opening = true; button.disabled = true; summary.hidden = true; status.textContent = 'Unlocking prototype…';
  try {
    if (!globalThis.crypto?.subtle) throw Error('Open this prototype over HTTPS or localhost to use browser decryption.');
    const data = await envelope();
    const passphrase = input.value; input.value = '';
    const key = await deriveKey(passphrase,data.salt);
    if (!await openWithKey(data,key)) { forget(data.base); showError('The passphrase is incorrect, or the encrypted file has changed. Try again.'); }
  } catch (error) { showError(error instanceof Error ? error.message : 'Unable to unlock this prototype.'); }
  finally { opening = false; button.disabled = false; status.textContent = ''; }
});
input.disabled = false; button.disabled = false; button.removeAttribute('aria-disabled');
// Keep the passphrase screen hidden while checking a remembered key.
(async () => {
  try {
    const data = await envelope();
    let cached: {salt:string;key:string} | undefined;
    try { cached = JSON.parse(sessionStorage.getItem(sessionKey(data.base)) || 'null'); } catch {}
    if (cached?.salt === data.salt) {
      if (await openWithKey(data,cached.key)) return;
      forget(data.base);
    } else if (cached) forget(data.base);
  } catch { /* The form provides a focused, accessible error on explicit entry. */ }
  document.documentElement.classList.remove('encrypted-opening');
  input.focus();
})();
