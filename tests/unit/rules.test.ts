import { describe, it, expect } from 'vitest';
import { matches, destination, validateJourneys, url, pageRoute } from '../../tooling/rules.mjs';
import { createStore } from '../../src/assets/scripts/storage';
describe('journey rules', () => {
 it('evaluates every supported operator without executable expressions', () => {
 const a = {name:'Robin', eligible:'yes', empty:[]};
 for (const r of [{field:'eligible',equals:'yes'},{field:'eligible',notEquals:'no'},{field:'eligible',in:['yes']},{field:'name',exists:true},{field:'empty',exists:false},{all:[{field:'name',exists:true},{any:[{field:'eligible',equals:'yes'}]}]}]) expect(matches(r,a)).toBe(true);
 expect(matches({field:'eligible',equals:'no'},a)).toBe(false);
 });
 it('branches and falls back', () => { const step={next:[{when:{field:'eligible',equals:'yes'},path:'/yes/'},{otherwise:'/no/'}]}; expect(destination(step,{eligible:'yes'})).toBe('/yes/'); expect(destination(step,{})).toBe('/no/'); });
 it('rejects malformed routes', () => {
 const check=(steps:any[])=>validateJourneys({a:{steps}},['/a/','/b/']);
 expect(()=>check([{path:'/a/',next:'/unknown/'}])).toThrow('Unknown destination');
 expect(()=>check([{path:'/a/'},{path:'/a/'}])).toThrow('Duplicate');
 expect(()=>check([{path:'/a/',next:[{when:{field:'x',equals:'y'},path:'/b/'}]}])).toThrow('default');
 expect(()=>check([{path:'/a/',next:[{when:{field:'x',execute:'evil'},path:'/b/'},{otherwise:'/b/'}]}])).toThrow('Unsupported');
 });
 it('prefixes root and repository URLs',()=>{expect(url('/a/','/')).toBe('/a/');expect(url('/a/','/sample-repo/')).toBe('/sample-repo/a/');});
});
it('retains answers and handles unavailable or corrupt storage',()=>{let raw='broken';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;},removeItem:()=>{raw='{}';}} as Storage;const s=createStore(storage,'test');expect(s.read()).toEqual({});s.write({name:'Robin'});expect(createStore(storage,'test').read()).toEqual({name:'Robin'});s.clear();expect(s.read()).toEqual({});const fallback=createStore({} as Storage,'x');fallback.write({name:'A'});expect(fallback.read()).toEqual({name:'A'});});

describe('page routes', () => {
 it('reads directory permalinks and rejects anything else', () => {
  expect(pageRoute({permalink:'/example/name/'},'name.njk')).toBe('/example/name/');
  for (const permalink of [undefined,'/example/name','example/name/','/a b/']) expect(()=>pageRoute({permalink},'bad.njk')).toThrow('Page bad.njk needs an absolute directory permalink');
  expect(()=>pageRoute(null,'none.njk')).toThrow('needs an absolute directory permalink');
 });
 it('skips paginated templates, whose permalinks are computed per item', () => {
  expect(pageRoute({pagination:{data:'services',size:1,alias:'service'},permalink:'/services/{{ service.id }}/'},'service.njk')).toBeNull();
 });
});
