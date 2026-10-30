import { test, expect } from '@playwright/test';
const base=process.env.BASE_PATH || '/';
test('demo gate covers deep links and refresh, signs out, and is explicitly bypassable',async({page})=>{
 test.skip(process.env.TEST_DEMO_GATE !== 'true','Only in gated build');
 await page.goto(base+'example/name/');
 await expect(page.locator('#prototype')).toBeHidden();
 await page.getByLabel('Demo passphrase').fill('incorrect');await page.getByRole('button',{name:'Continue'}).click();
 await expect(page.locator('#gate-error')).toBeVisible();
 await expect(page.getByLabel('Demo passphrase')).toBeFocused();
 await page.getByLabel('Demo passphrase').fill('fictional-demo');await page.getByRole('button',{name:'Continue'}).click();
 await expect(page.getByLabel('What is your name?')).toBeVisible();await page.reload();await expect(page.locator('#prototype')).toBeVisible();
 await page.getByRole('link',{name:'Leave prototype'}).click();await expect(page.locator('#prototype')).toBeHidden();
 // The public manifest contains the verifier: no confidentiality is claimed.
 const passphrase=await page.locator('#prototype-config').evaluate(el=>JSON.parse(el.textContent!).site.publicDemoGate.passphrase);
 expect(passphrase).toBe('fictional-demo');
 await page.locator('#prototype').evaluate(el=>(el as HTMLElement).style.display='block');
 await expect(page.getByRole('heading',{name:'GOV.UK Static Prototype Kit'})).toBeVisible();
});
