import { test, expect } from '@playwright/test';
const base=process.env.BASE_PATH || '/';
for (const route of ['start','name','check-answers']) {
 test(`visual regression: ${route}`,async({page})=>{
  test.skip(process.env.VISUAL_TESTS !== 'true','Opt-in screenshot comparison');
  await page.goto(base+`example/${route}/`);
  await page.evaluate(()=>document.fonts.ready);
  await expect(page).toHaveScreenshot(`${route}.png`,{fullPage:true,maxDiffPixelRatio:0.02});
 });
}
