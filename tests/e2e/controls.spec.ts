import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
test('serializes and restores native controls, clearing unchecked groups',async({page})=>{
 test.skip(process.env.TEST_DEMO_GATE === 'true');
 const bundle=await build({entryPoints:['src/assets/scripts/forms.ts'],bundle:true,write:false,format:'iife',globalName:'FormHelpers'});
 await page.setContent(`<form><input name="text" value=" Fictional "><textarea name="notes">A note</textarea><select name="single"><option>one</option><option selected>two</option></select><select name="multiple" multiple><option selected>a</option><option selected>b</option></select><input type="radio" name="radio" value="yes"><input type="radio" name="radio" value="no" checked><input type="checkbox" name="boxes" value="a" checked><input type="checkbox" name="boxes" value="b"><input name="repeated" value="first"><input name="repeated" value="second"><input name="disabled" value="ignored" disabled><input type="password" name="secret" value="ignored"></form>`);
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const serialized=await page.evaluate(()=> (window as any).FormHelpers.serialize(document.querySelector('form')));
 expect(serialized).toEqual({text:'Fictional',notes:'A note',single:'two',multiple:['a','b'],radio:'no',boxes:['a'],repeated:['first','second']});
 await page.evaluate(()=>{(window as any).FormHelpers.restore(document.querySelector('form'),{text:'Restored',radio:'yes',boxes:[],multiple:['b']});});
 await expect(page.locator('[name="text"]')).toHaveValue('Restored');await expect(page.locator('[name="radio"][value="yes"]')).toBeChecked();await expect(page.locator('[name="boxes"][value="a"]')).not.toBeChecked();
 const cleared=await page.evaluate(()=> (window as any).FormHelpers.serialize(document.querySelector('form')));expect(cleared.boxes).toEqual([]);expect(cleared.multiple).toEqual(['b']);
});
