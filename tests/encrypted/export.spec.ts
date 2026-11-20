import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
const base = process.env.BASE_PATH || '/sample.repo/';
async function unlock(page: any) {
 await page.getByLabel('Passphrase',{exact:true}).fill(process.env.ENCRYPTION_TEST_PASSPHRASE!);
 await page.getByRole('button',{name:'Unlock prototype',exact:true}).click();
}
test('export contains ciphertext, generic shells and official assets only',async({request})=>{
 const entry=await request.get(base+'example/name/');
 // Unlock assets are referenced by content hash, so a new deploy never mixes old and new.
 const shell=await entry.text();expect(shell).toMatch(/unlock\.css\?v=[a-f0-9]{12}"/);expect(shell).toMatch(/unlock\.js\?v=[a-f0-9]{12}"/);
 expect(await entry.text()).not.toContain('What is your name?');
 expect(await entry.text()).not.toContain('Robin Example');
 const payload=await (await request.get(base+'__encrypted/payload.json')).text();
 // Compressed before encryption, with text kept as text inside the archive.
 const envelope=JSON.parse(payload);expect(envelope).toMatchObject({format:2,compression:'gzip'});
 expect(payload).not.toContain('Robin Example');expect(payload).not.toContain('countryside');
 expect(payload).not.toContain(process.env.ENCRYPTION_TEST_PASSPHRASE!);
 expect((await request.get(base+'assets/runtime.js')).status()).toBe(404);
 expect((await request.get(base+'assets/main.css')).status()).toBe(404);
 const files=await fs.readdir('_encrypted',{recursive:true});
 expect(files).not.toContain('assets/runtime.js');expect(files).not.toContain('assets/main.css');
 for (const file of files) {
  const target=path.join('_encrypted',file);if ((await fs.stat(target)).isDirectory()) continue;
  const text=await fs.readFile(target,'utf8');
  expect(text.includes(process.env.ENCRYPTION_TEST_PASSPHRASE!)).toBe(false);
 }
});
test('unlock errors, full journey, editing, reload, lock and browser Back',async({page})=>{
 const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'example/name/');
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await page.screenshot({path:`test-results/encrypted-unlock-${test.info().project.name}.png`,fullPage:true});
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.getByLabel('Passphrase',{exact:true}).fill('wrong passphrase');await page.getByRole('button',{name:'Unlock prototype',exact:true}).click();
 await expect(page.locator('#unlock-error')).toBeFocused();
 await unlock(page);
 await expect(page.getByLabel('What is your name?')).toBeVisible();
 await expect(page.locator('label[for="full-name"]')).toHaveCSS('font-family',/GDS Transport/);
 expect(await page.evaluate(async()=>{await document.fonts.ready;return document.fonts.check('19px "GDS Transport"');})).toBe(true);
 await page.getByRole('button',{name:'Continue',exact:true}).click();await expect(page.locator('.govuk-error-summary')).toBeFocused();
 await page.getByLabel('What is your name?').fill('Encrypted Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Yes',{exact:true}).check();await page.getByLabel('Walking',{exact:true}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('[data-answer="full-name"]')).toHaveText('Encrypted Example');await page.reload();
 await expect(page.locator('[data-answer="interests"]')).toHaveText('walking');
 await page.getByRole('link',{name:'Change Name',exact:true}).click();await expect(page.getByLabel('What is your name?')).toHaveValue('Encrypted Example');
 await page.getByLabel('What is your name?').fill('Edited Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('[data-answer="full-name"]')).toHaveText('Edited Example');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.getByRole('button',{name:'Accept and send'}).click();await expect(page.getByRole('heading',{name:'Request complete'})).toBeVisible();
 expect(errors).toEqual([]);await page.getByRole('button',{name:'Lock prototype',exact:true}).click();expect(errors).toEqual([]);await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await unlock(page);await expect(page.getByRole('heading',{name:'Check your answers'})).toBeVisible();await page.goto(base+'example/name/');await expect(page.getByLabel('What is your name?')).toHaveValue('');
 expect(errors).toEqual([]);
});
test('scenario deep links and ciphertext corruption',async({page})=>{
 await page.goto(base+'example/start/?scenario=ineligible-applicant');await unlock(page);
 await expect(page.getByRole('heading',{name:'You cannot use this service'})).toBeVisible();await page.reload();await expect(page.getByRole('heading',{name:'You cannot use this service'})).toBeVisible();
 await page.getByRole('button',{name:'Lock prototype',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await page.evaluate(async()=>{for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();});
 await page.route('**/__encrypted/payload.json*',async route=>{const response=await route.fetch();const data=await response.json();const last=data.payload.at(-1);data.payload=data.payload.slice(0,-1)+(last==='0'?'1':'0');await route.fulfill({json:data});});
 await page.reload();await unlock(page);await expect(page.locator('#unlock-error')).toBeVisible();await expect(page.getByRole('heading',{name:'You cannot use this service'})).toHaveCount(0);
});
test('without JavaScript the prototype remains ciphertext',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto(String(test.info().project.use.baseURL)+base+'example/name/');
 await expect(page.getByText('JavaScript is required to decrypt this prototype.',{exact:false})).toBeVisible();await expect(page.getByLabel('Passphrase',{exact:true})).toBeDisabled();await expect(page.getByRole('heading',{name:'What is your name?'})).toHaveCount(0);await context.close();
});

test('optional form and radio routing works after decryption at a repository subpath',async({page})=>{
 await page.goto(base+'routing/standard/');await unlock(page);
 await page.getByLabel('What should we call you?').fill('Encrypted routing example');await page.getByRole('button',{name:'Continue'}).click();
 await expect(page.locator('[data-answer="routing-example-name"]')).toHaveText('Encrypted routing example');
 await page.goto(base+'routing/navigation/');await page.getByRole('button',{name:'Continue'}).click();await expect(page.locator('.govuk-error-summary')).toBeFocused();
 await page.getByLabel('The no route').check();await page.getByRole('button',{name:'Continue'}).click();await expect(page.getByRole('heading',{name:'You reached the no route'})).toBeVisible();
 expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('govuk-static-kit:countryside-visit:v1') || '{}'))).not.toHaveProperty('redirect');
 await page.goto(base+'routing/answer/');await page.getByLabel('Yes',{exact:true}).check();await page.getByRole('button',{name:'Continue'}).click();
 await expect(page.locator('[data-answer="routing-example-answer"]')).toHaveText('yes');
 await page.goto(base+'routing/answer/');await expect(page.getByLabel('Yes',{exact:true})).toBeChecked();
});


const decryptedCaches=(page:any)=>page.evaluate(async()=>(await caches.keys()).filter((k:string)=>k.startsWith('encrypted-prototype:')).length);
const clearDecrypted=(page:any)=>page.evaluate(async()=>{for (const k of await caches.keys()) await caches.delete(k);});

test('decrypts once: pages come from the service worker without downloading the payload again',async({page})=>{
 const payloads:string[]=[];page.on('request',r=>{if(r.url().includes('payload.json'))payloads.push(r.url());});
 await page.goto(base+'example/name/');await unlock(page);
 await expect(page.getByLabel('What is your name?')).toBeVisible();
 expect(await page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
 expect(await decryptedCaches(page)).toBe(1);
 // Served pages are the real pages, with real asset URLs rather than blob URLs.
 await expect(page.locator('link[rel=stylesheet]')).toHaveAttribute('href',new RegExp('^'+base.replaceAll('.','\\.')+'assets/main.css'));
 await page.getByLabel('What is your name?').fill('Cached Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Yes',{exact:true}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('[data-answer="full-name"]')).toHaveText('Cached Example');
 await page.goBack();await expect(page.getByLabel('Yes',{exact:true})).toBeChecked();
 await page.goForward();await expect(page.locator('[data-answer="full-name"]')).toHaveText('Cached Example');
 expect(payloads).toHaveLength(1);
});
test('unlocked navigation works offline from the decrypted pages',async({page,context})=>{
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await context.setOffline(true);
 await page.getByLabel('What is your name?').fill('Offline Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Yes',{exact:true}).check();await page.getByLabel('Walking',{exact:true}).check();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('[data-answer="full-name"]')).toHaveText('Offline Example');
 await page.getByRole('link',{name:'Change Name',exact:true}).click();
 await expect(page.getByLabel('What is your name?')).toHaveValue('Offline Example');
 await context.setOffline(false);
});
test('locking clears the decrypted pages, and Back does not restore them',async({page})=>{
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.getByLabel('What is your name?').fill('Back Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.getByLabel('Yes',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Lock prototype',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 expect(await decryptedCaches(page)).toBe(0);
 // Back to the name page: it must load the unlock screen, not a decrypted copy.
 await page.goBack();await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await expect(page.getByLabel('What is your name?')).toHaveCount(0);
 await page.goto(base+'example/start/');await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
});
test('a tab without an unlocked session never shows decrypted pages, and clears them',async({context})=>{
 const unlocked=await context.newPage();
 await unlocked.goto(base+'example/name/');await unlock(unlocked);await expect(unlocked.getByLabel('What is your name?')).toBeVisible();
 // A new tab shares the service worker and its cache, but not the unlocked session.
 const other=await context.newPage();
 await other.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{if(document.querySelector('#prototype-config')&&getComputedStyle(document.documentElement).display!=='none')(window as any).__shown=true;});});
 await other.goto(base+'example/start/');
 await expect(other.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 expect(await other.evaluate(()=>!!(window as any).__shown)).toBe(false);
 expect(await decryptedCaches(other)).toBe(0);
});
test('after unlocking, moving between pages never shows the unlock form',async({page})=>{
 await page.addInitScript(()=>{
  const check=()=>{const form=document.querySelector('.encrypted-unlock');if(form&&getComputedStyle(form).display!=='none'&&sessionStorage.getItem('unlock-test-armed'))sessionStorage.setItem('unlock-test-flashed','yes');};
  new MutationObserver(check).observe(document,{childList:true,subtree:true});document.addEventListener('DOMContentLoaded',check);
 });
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.evaluate(()=>sessionStorage.setItem('unlock-test-armed','yes'));
 await page.goto(base+'example/start/');await expect(page.getByRole('heading',{level:1,name:'Apply for a countryside visit'})).toBeVisible();
 await page.goto(base+'example/name/');await expect(page.getByLabel('What is your name?')).toBeVisible();
 // Without decrypted pages, an unlocked tab goes through the shell: it must say "Opening prototype", not show the form.
 await clearDecrypted(page);await page.reload();await expect(page.getByLabel('What is your name?')).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('unlock-test-flashed'))).toBeNull();
});
test('a new deploy replaces the decrypted pages',async({page,context})=>{
 test.skip(test.info().project.name==='safari','Playwright can only intercept service worker requests in Chromium');
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.evaluate(()=>new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=resolve;navigator.serviceWorker.controller!.postMessage({type:'recheck'},[c.port2]);}));
 const payloads:string[]=[];page.on('request',r=>{if(r.url().includes('payload.json'))payloads.push(r.url());});
 let first=true;
 await context.route('**/__encrypted/version.txt',async route=>{if(first){first=false;await route.fulfill({body:'a-newer-deploy'});} else await route.continue();});
 await page.goto(base+'example/start/');
 await expect(page.getByRole('heading',{level:1,name:'Apply for a countryside visit'})).toBeVisible();
 expect(first).toBe(false);
 expect(payloads.length).toBeGreaterThanOrEqual(1);
 expect(await decryptedCaches(page)).toBe(1);
});
test('version.txt is the salt of the published payload',async({request})=>{
 const envelope=await (await request.get(base+'__encrypted/payload.json')).json();
 expect((await (await request.get(base+'__encrypted/version.txt')).text()).trim()).toBe(envelope.salt);
});
test('a tab sent back to the unlock screen repeatedly stops using the service worker and still opens',async({page})=>{
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 // Two installs in the last 30 seconds, as in a loop.
 await page.evaluate(b=>{sessionStorage.setItem('govuk-static-kit:encrypted:'+b+':installs',JSON.stringify([Date.now()-2000,Date.now()-1000]));},base);
 await clearDecrypted(page);
 let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 await page.reload();
 await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.waitForTimeout(1500);
 expect(navigations).toBeLessThanOrEqual(2);
 expect(await decryptedCaches(page)).toBe(0);
});
test('locking resets the loop breaker',async({page})=>{
 await page.goto(base+'example/name/');
 for (let i=0;i<3;i++) {
  await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
  expect(await decryptedCaches(page)).toBe(1);
  await page.getByRole('button',{name:'Lock prototype',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 }
});
test('a remembered key that no longer works shows the form again',async({page})=>{
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await clearDecrypted(page);
 await page.evaluate(b=>{const k='govuk-static-kit:encrypted:'+b;const v=JSON.parse(sessionStorage.getItem(k)!);v.key='0'.repeat(64);sessionStorage.setItem(k,JSON.stringify(v));},base);
 await page.reload();
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await expect(page.getByLabel('Passphrase',{exact:true})).toBeFocused();
});
test('the unlocking message stays until the page changes',async({page})=>{
 await page.goto(base+'example/name/');
 await page.evaluate(()=>{(window as any).__states=[];const status=document.querySelector('#unlock-status')!;const button=document.querySelector<HTMLButtonElement>('#unlock-form button')!;
  new MutationObserver(()=>(window as any).__states.push({status:status.textContent,disabled:button.disabled})).observe(document.querySelector('#unlock-form')!,{subtree:true,childList:true,characterData:true,attributes:true});});
 await page.getByLabel('Passphrase',{exact:true}).fill(process.env.ENCRYPTION_TEST_PASSPHRASE!);
 const states=await page.evaluate(()=>new Promise<any[]>(resolve=>{document.querySelector<HTMLButtonElement>('#unlock-form button')!.click();
  const check=()=>{const s=(window as any).__states;if(s.length&&s.at(-1).status==='Unlocking prototype'&&s.at(-1).disabled)setTimeout(()=>resolve(s),50);else requestAnimationFrame(check);};check();}));
 expect(states.every((s:any)=>s.status==='Unlocking prototype'&&s.disabled)).toBe(true);
 await expect(page.getByLabel('What is your name?')).toBeVisible();
});
test('if unlock.js never runs, an unlocked tab still gets the form instead of waiting forever',async({page})=>{
 await page.goto(base+'example/name/');await unlock(page);await expect(page.getByLabel('What is your name?')).toBeVisible();
 await clearDecrypted(page);
 // Remove the service worker so the browser requests unlock.js directly, where it can be replaced in every engine.
 await page.evaluate(async()=>{for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();});
 await page.route('**/__encrypted/unlock.js*',route=>route.fulfill({contentType:'application/javascript',body:'throw new Error("broken")'}));
 await page.reload();
 await expect(page.getByText('Opening prototype')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible({timeout:12000});
 await expect(page.getByText('Opening prototype')).toBeHidden();
});
test('without service workers, unlocking renders in place',async({browser})=>{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});const page=await context.newPage();
 await page.goto('http://localhost:'+(process.env.TEST_PORT||'8082')+base+'example/name/');await unlock(page);
 await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.getByLabel('What is your name?').fill('In Place Example');await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Yes',{exact:true}).check();await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('[data-answer="full-name"]')).toHaveText('In Place Example');
 await page.getByRole('button',{name:'Lock prototype',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await context.close();
});
