import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const base=process.env.BASE_PATH || '/';
test.skip(process.env.TEST_DEMO_GATE === 'true','Separate gate suite');
async function answers(page:Page) {return page.evaluate(()=>JSON.parse(sessionStorage.getItem('govuk-static-kit:countryside-visit:v1') || '{}'));}
test('standard form actions save, validate and restore without YAML or data-journey',async({page})=>{
 await page.goto(base+'routing/standard/');
 await page.getByRole('button',{name:'Continue'}).click();await expect(page.locator('.govuk-error-summary')).toBeFocused();
 await page.getByLabel('What should we call you?').fill('Standard Example');
 await page.getByRole('button',{name:'Continue'}).click();await expect(page).toHaveURL(new RegExp(base+'routing/yes/'));
 await expect(page.locator('[data-answer="routing-example-name"]')).toHaveText('Standard Example');
 await page.goto(base+'routing/standard/');await expect(page.getByLabel('What should we call you?')).toHaveValue('Standard Example');
});
test('navigation radios require selection, wait for Continue and do not persist redirect URLs',async({page})=>{
 await page.goto(base+'routing/navigation/');
 await page.getByRole('button',{name:'Continue'}).click();await expect(page.locator('.govuk-error-summary')).toBeFocused();
 await page.getByRole('link',{name:'Select an option',exact:true}).click();await expect(page.getByLabel('The yes route')).toBeFocused();
 await page.getByLabel('The no route').check();await expect(page).toHaveURL(new RegExp(base+'routing/navigation/'));
 await page.getByRole('button',{name:'Continue'}).click();await expect(page.getByRole('heading',{name:'You reached the no route'})).toBeVisible();
 expect(await answers(page)).not.toHaveProperty('redirect');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
test('data-next saves clean answers and restores selection on reload and Back',async({page})=>{
 await page.goto(base+'routing/answer/');await page.getByLabel('Yes',{exact:true}).check();
 await expect(page).toHaveURL(new RegExp(base+'routing/answer/'));
 await page.getByRole('button',{name:'Continue'}).click();await expect(page.locator('[data-answer="routing-example-answer"]')).toHaveText('yes');
 expect((await answers(page))['routing-example-answer']).toBe('yes');
 await page.goBack();await expect(page.getByLabel('Yes',{exact:true})).toBeChecked();await page.reload();await expect(page.getByLabel('Yes',{exact:true})).toBeChecked();
 await page.getByLabel('No',{exact:true}).check();await page.getByRole('button',{name:'Continue'}).click();await expect(page.getByRole('heading',{name:'You reached the no route'})).toBeVisible();
 await expect(page.locator('[data-answer="routing-example-answer"]')).toHaveText('no');
});

test('standard actions preserve native HTML constraints unless novalidate is authored',async({page})=>{
 await page.goto(base+'routing/standard/');
 await page.getByLabel('What should we call you?').evaluate(el=>{
  const input=el as HTMLInputElement;input.removeAttribute('data-required');input.required=true;input.pattern='[A-Z]{3}';
 });
 await page.getByRole('button',{name:'Continue'}).click();await expect(page).toHaveURL(new RegExp(base+'routing/standard/'));
 await page.getByLabel('What should we call you?').fill('invalid');await page.getByRole('button',{name:'Continue'}).click();await expect(page).toHaveURL(new RegExp(base+'routing/standard/'));
 await page.getByLabel('What should we call you?').fill('ABC');await page.getByRole('button',{name:'Continue'}).click();await expect(page.getByRole('heading',{name:'You reached the yes route'})).toBeVisible();
});
