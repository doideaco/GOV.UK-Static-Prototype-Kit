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
 expect(await entry.text()).not.toContain('What is your name?');
 expect(await entry.text()).not.toContain('Robin Example');
 const payload=await (await request.get(base+'__encrypted/payload.json')).text();
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
 await page.route('**/__encrypted/payload.json',async route=>{const response=await route.fetch();const data=await response.json();const last=data.payload.at(-1);data.payload=data.payload.slice(0,-1)+(last==='0'?'1':'0');await route.fulfill({json:data});});
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


test('unlocked navigation keeps the document and works without network requests',async({page})=>{
 await page.goto(base+'example/name/');await unlock(page);
 await expect(page.getByLabel('What is your name?')).toBeVisible();
 await page.evaluate(()=>{(window as any).navigationSentinel='same document';});
 const requests:string[]=[];
 await page.route('**/*',route=>{requests.push(route.request().url());return route.abort();});
 await page.getByLabel('What is your name?').fill('Offline Example');
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await page.getByLabel('Yes',{exact:true}).check();await page.getByLabel('Walking',{exact:true}).check();
 await page.getByRole('button',{name:'Continue',exact:true}).click();
 await expect(page.locator('[data-answer="full-name"]')).toHaveText('Offline Example');
 await page.getByRole('link',{name:'Change Name',exact:true}).click();
 await expect(page.getByLabel('What is your name?')).toHaveValue('Offline Example');
 await page.goBack();await expect(page.getByRole('heading',{name:'Check your answers'})).toBeFocused();
 await page.goForward();await expect(page.getByLabel('What is your name?')).toHaveValue('Offline Example');
 expect(await page.evaluate(()=>(window as any).navigationSentinel)).toBe('same document');
 expect(requests).toEqual([]);
 await page.unroute('**/*');
 await page.getByRole('button',{name:'Lock prototype',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
 await page.goBack();await expect(page.getByRole('heading',{name:'Unlock this prototype'})).toBeVisible();
});
