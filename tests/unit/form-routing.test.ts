import { describe, it, expect } from 'vitest';
import { parse } from 'parse5';
import { compileFormRouting, normalizeFormTarget } from '../../tooling/form-routing.mjs';
import { resolveFormDestination } from '../../tooling/rules.mjs';
const routes=['/question/','/next/','/other/','/done/'];
const options={route:'/question/',base:'/',routes};
function nodes(node:any):any[] {return [node,...(node.childNodes || []).flatMap(nodes)];}
function compiled(html:string,extra={}) {
 const output=compileFormRouting(html,{...options,...extra});const all=nodes(parse(output));
 const forms=all.filter(n=>n.tagName==='form');
 const plan=JSON.parse(forms[0].attrs.find((a:any)=>a.name==='data-prototype-routing')?.value || 'null');
 return {output,all,forms,plan};
}
const radios=(attributes='')=>`<input type="radio" name="answer" value="yes" data-next="/next/" ${attributes}><input type="radio" name="answer" value="no" data-next="/other/">`;
const yaml={example:{steps:[{path:'/question/',next:'/next/'}]}};
describe('page-authored form routing',()=>{
 it('enhances standard actions without data-journey or a YAML step',()=>{
  const {plan,output}=compiled('<form action="/next/"><input name="name"><button>Continue</button></form>');
  expect(plan).toEqual({mode:'action',next:'/next/'});expect(output).toContain('data-errors');expect(output).not.toContain('novalidate');
  expect(resolveFormDestination(plan,{name:'Robin'},{name:'Robin'})).toBe('/next/');
 });
 it('uses browser-relative action semantics and prefixes repository paths once',()=>{
  expect(normalizeFormTarget('../next/?edit=yes#question',{...options,base:'/sample.repo/',rendered:true})).toBe('/next/?edit=yes#question');
  const {plan,output}=compiled('<form action="/sample.repo/next/"></form>',{base:'/sample.repo/'});
  expect(plan.next).toBe('/next/');expect(output).toContain('action="/sample.repo/next/"');expect(output).not.toContain('/sample.repo/sample.repo/');
 });
 it('compiles redirect navigation options and validates an unanswered group',()=>{
  const {plan,output}=compiled('<form><input type="radio" name="redirect" value="/next/"><input type="radio" name="redirect" value="/other/"></form>');
  expect(plan.navigationOnly).toBe(true);expect(output).toContain('data-required="Select an option"');expect(output).toContain('id="prototype-question-1"');
  expect(resolveFormDestination(plan,{redirect:'/other/'},{})).toBe('/other/');
  expect(resolveFormDestination(plan,{redirect:'https://elsewhere.invalid/'},{})).toBeUndefined();
  expect(resolveFormDestination(plan,{}, {redirect:'/next/'})).toBeUndefined();
 });
 it('keeps answer values independent from destinations and supports action fallbacks',()=>{
  const {plan}=compiled(`<form action="/other/"><input type="radio" name="answer" value="yes" data-next="/next/"><input type="radio" name="answer" value="no"></form>`);
  expect(plan.navigationOnly).toBe(false);expect(plan.choices).toEqual([{value:'yes',next:'/next/'},{value:'no',next:'/other/'}]);
  expect(resolveFormDestination(plan,{answer:'yes'},{answer:'yes'})).toBe('/next/');
  expect(resolveFormDestination(plan,{answer:'no'},{answer:'no'})).toBe('/other/');
 });
 it('preserves existing YAML branches and accepts their matching fallback action',()=>{
  const next=[{when:{field:'answer',equals:'yes'},path:'/next/'},{otherwise:'/other/'}];
  const {plan}=compiled('<form data-journey action="/next/"></form>',{journeys:{example:{steps:[{path:'/question/',next}]}}});
  expect(plan.mode).toBe('yaml');expect(resolveFormDestination(plan,{}, {answer:'no'})).toBe('/other/');
 });
 it('rejects conflicting routing sources with a page-specific error',()=>{
  expect(()=>compiled(`<form>${radios()}</form>`,{journeys:yaml})).toThrow('Routing on /question/, form 1: Inline radio routing conflicts');
  expect(()=>compiled('<form action="/other/"></form>',{journeys:yaml})).toThrow('action conflicts');
 });
 it.each([
  ['<form action="/missing/"></form>','Unknown routing destination'],
  ['<form data-journey></form>','Add a local form action'],
  ['<form><input type="radio" name="redirect" value="https://outside.invalid/"></form>','local page URLs'],
  ['<form><input type="radio" name="redirect" value="//outside.invalid/"></form>','local page URLs'],
  ['<form><input type="radio" name="answer" value="yes" data-next="/next/"><input type="radio" name="answer" value="no"></form>','needs data-next or a form action'],
  ['<form><input type="checkbox" name="answer" data-next="/next/"></form>','only on named radio'],
  ['<form><input type="radio" name="redirect" value="/next/" data-next="/other/"></form>','not both'],
  ['<form><input type="radio" name="one" value="a" data-next="/next/"><input type="radio" name="two" value="b" data-next="/other/"></form>','Only one radio group'],
  ['<form><input type="radio" name="redirect" value="/next/"><input type="radio" name="redirect" value="/next/"></form>','unique values'],
  ['<form action="/next/"><button formaction="/other/">Continue</button></form>','formaction overrides']
 ])('rejects ambiguous or invalid forms: %s',(html,message)=>{expect(()=>compiled(html)).toThrow(message);});
 it('does not change native/external forms or forms with their own submit logic',()=>{
  for(const html of ['<form data-native action="/not-a-prototype-endpoint/"></form>','<form action="https://outside.invalid/"></form>','<form id="gate-form"></form>']) expect(compiled(html).output).toBe(html);
 });
 it('retains custom required messages and uses unique generated control IDs',()=>{
  const {output}=compiled(`<div id="prototype-question-1"></div><form>${radios('data-required="Choose yes or no"')}</form>`);
  expect(output).toContain('data-required="Choose yes or no"');expect(output).toContain('id="prototype-question-1-2"');
 });
 it('supports independent forms but rejects ambiguous page-level YAML for multiple forms',()=>{
  const html='<form action="/next/"></form><form action="/next/"></form>';
  expect(compiled(html).forms.every(f=>f.attrs.some((a:any)=>a.name==='data-prototype-routing'))).toBe(true);
  expect(()=>compiled(html,{journeys:yaml})).toThrow('cannot control multiple forms');
 });
});
