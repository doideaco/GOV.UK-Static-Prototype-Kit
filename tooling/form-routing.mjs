import { parse, parseFragment, serialize } from 'parse5';
import { url } from './rules.mjs';
const has = (node,name) => node.attrs?.some(attr => attr.name === name);
const get = (node,name) => node.attrs?.find(attr => attr.name === name)?.value;
function set(node,name,value) {
  const attr = node.attrs.find(attr => attr.name === name);
  if (attr) attr.value = value;
  else node.attrs.push({name,value});
}
function descendants(node) {
  return (node.childNodes || []).flatMap(child => [child,...descendants(child)]);
}
export function normalizeFormTarget(value,{base='/',route='/',routes,rendered=false}) {
  if (typeof value !== 'string' || !value || value !== value.trim() || /[\\\u0000-\u0020]/.test(value) || value.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(value)) {
    throw Error(`Routing destinations must be local page URLs: ${value}`);
  }
  const reference = new URL(url(route,base),'https://prototype.invalid');
  const target = new URL(value,reference);
  let pathname = target.pathname;
  // Inline option URLs are logical routes; rendered form actions usually passed through | url.
  if (!rendered && value.startsWith('/') && routes.includes(pathname)) return pathname+target.search+target.hash;
  if (base !== '/' && pathname.startsWith(base)) pathname = '/'+pathname.slice(base.length);
  if (!routes.includes(pathname)) throw Error(`Unknown routing destination: ${value}`);
  return pathname+target.search+target.hash;
}
export function compileFormRouting(html,{base='/',route='/',routes,journeys={}}) {
  const doc = parse(html);
  const nodes = descendants(doc);
  const forms = nodes.filter(node => node.tagName === 'form');
  const ids = new Set(nodes.map(node => get(node,'id')).filter(Boolean));
  const step = Object.values(journeys).flatMap(journey => journey.steps).find(item => item.path === route);
  const yaml = step?.next !== undefined;
  let enhanced = 0;
  for (const [index,form] of forms.entries()) {
    if (has(form,'data-native')) continue;
    const controls = descendants(form).filter(node => ['input','select','textarea','button'].includes(node.tagName));
    const inline = controls.filter(node => has(node,'data-next') || get(node,'name') === 'redirect');
    const actionValue = get(form,'action');
    const marked = has(form,'data-journey');
    const external = actionValue && (/^[a-z][a-z\d+.-]*:/i.test(actionValue) || actionValue.startsWith('//'));
    if (!inline.length && !marked && (!actionValue || external)) continue;
    const fail = message => { throw Error(`Routing on ${route}, form ${index+1}: ${message}`); };
    let action;
    try { if (actionValue) action = normalizeFormTarget(actionValue,{base,route,routes,rendered:true}); }
    catch (error) { fail(error.message); }
    if (controls.some(node => has(node,'formaction'))) fail('formaction overrides are not supported. Use a separate form or data-native.');
    let plan;
    if (inline.length) {
      if (yaml) fail('Inline radio routing conflicts with this page’s YAML next rule. Choose one routing source.');
      if (inline.some(node => node.tagName !== 'input' || get(node,'type')?.toLowerCase() !== 'radio' || !get(node,'name'))) fail('Use data-next or name="redirect" only on named radio inputs.');
      const field = get(inline[0],'name');
      if (inline.some(node => get(node,'name') !== field)) fail('Only one radio group can control a form’s next page. Use YAML for combined conditions.');
      const group = controls.filter(node => node.tagName === 'input' && get(node,'type')?.toLowerCase() === 'radio' && get(node,'name') === field);
      if (field === 'redirect' && group.some(node => has(node,'data-next'))) fail('Use either redirect values or data-next, not both on the same group.');
      if (!group.some(node => !has(node,'disabled'))) fail('A routing group needs an enabled option.');
      const values = new Set();
      const choices = group.map(node => {
        const value = get(node,'value');
        if (!value || values.has(value)) fail('Routing options need nonempty, unique values.');
        values.add(value);
        const nextValue = field === 'redirect' ? value : get(node,'data-next');
        if (nextValue === undefined && !action) fail(`Option "${value}" needs data-next or a form action as its fallback.`);
        let next = action;
        try { if (nextValue !== undefined) next = normalizeFormTarget(nextValue,{base,route,routes}); }
        catch (error) { fail(error.message); }
        return {value,next};
      });
      // A navigation question cannot continue without selecting an option. Existing authored
      // required messages are retained; otherwise supply a usable error without extra markup.
      if (!group.some(node => has(node,'data-required'))) set(group.find(node => !has(node,'disabled')),'data-required','Select an option');
      plan = {mode:'inline',field,navigationOnly:field === 'redirect',choices};
    } else if (yaml) {
      const destinations = typeof step.next === 'string' ? [step.next] : step.next.map(branch => branch.path || branch.otherwise);
      if (action && !destinations.includes(action)) fail('The form action conflicts with the YAML destinations. Use a matching fallback action or change the YAML rule.');
      plan = {mode:'yaml',next:step.next};
    } else {
      if (!action) fail('Add a local form action, inline radio destinations or a YAML next rule.');
      plan = {mode:'action',next:action};
    }
    if (action) set(form,'action',url(action,base));
    // Make required controls and summary focus work for ordinary forms as well as data-journey.
    controls.filter(node => has(node,'data-required')).forEach(node => {
      if (!get(node,'id')) {
        let id = `prototype-question-${index+1}`;
        for (let suffix=2;ids.has(id);suffix++) id = `prototype-question-${index+1}-${suffix}`;
        set(node,'id',id); ids.add(id);
      }
    });
    if (!descendants(form).some(node => has(node,'data-errors'))) {
      const container = parseFragment('<div data-errors></div>').childNodes[0];
      container.parentNode = form; form.childNodes.unshift(container);
    }
    set(form,'data-prototype-routing',JSON.stringify(plan));
    enhanced++;
  }
  if (yaml && enhanced > 1) throw Error(`Routing on ${route}: a page-level YAML next rule cannot control multiple forms. Use per-form actions or inline routes.`);
  return enhanced ? serialize(doc) : html;
}
