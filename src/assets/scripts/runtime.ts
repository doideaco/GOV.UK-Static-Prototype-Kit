import { initAll } from 'govuk-frontend';
import { createStore } from './storage';
import { serialize, restore } from './forms';
// @ts-expect-error Shared, tested build/browser rule evaluator.
import { resolveFormDestination, matches, url } from '../../../tooling/rules.mjs';
const config = JSON.parse(document.querySelector('#prototype-config')!.textContent!);
const { site, base, scenarios } = config;
const key = `govuk-static-kit:${site.prototypeId}:v${site.schemaVersion}`;
let storage: Storage;
try { storage = site.storage === 'local' ? localStorage : sessionStorage; } catch { storage = {} as Storage; }
const store = createStore(storage, key);
const session = { get(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k: string, v: string) { try { sessionStorage.setItem(k,v); } catch {} }, remove(k: string) { try { sessionStorage.removeItem(k); } catch {} } };
const params = new URLSearchParams(location.search);
const route = '/' + location.pathname.slice(base.length).replace(/^\//, '');
function start() {
 if (site.resetOnStart && route === '/example/start/' && !params.has('scenario')) store.clear();
 const scenarioId = params.get('scenario');
 if (scenarioId && Object.hasOwn(scenarios, scenarioId)) {
  store.write(scenarios[scenarioId].answers); session.set(key + ':scenario', scenarioId);
  location.replace(url(scenarios[scenarioId].start, base)); return;
 }
 const active = session.get(key + ':scenario');
 if (active && config.development) { const notice = document.querySelector<HTMLElement>('#scenario-notice')!; notice.hidden = false; notice.textContent = `Fictional scenario active: ${active}. Clear prototype answers to reset.`; }
 const answers = store.read();
 document.querySelectorAll<HTMLElement>('[data-answer]').forEach(el => { const value = answers[el.dataset.answer!]; el.textContent = Array.isArray(value) ? value.join(', ') || 'Not provided' : value || 'Not provided'; });
 document.querySelectorAll<HTMLElement>('[data-show-when]').forEach(el => { try { el.hidden = !matches(JSON.parse(el.dataset.showWhen!), answers); } catch { el.hidden = true; } });
 document.querySelectorAll<HTMLFormElement>('form[data-prototype-routing]').forEach(form => {
  const plan = JSON.parse(form.dataset.prototypeRouting!);
  const restored = {...answers};
  if (plan.navigationOnly) delete restored[plan.field];
  restore(form, restored);
  form.addEventListener('submit', event => {
   event.preventDefault();
   const values = serialize(form), errors: { id: string; message: string }[] = [];
   form.querySelectorAll('[data-validation-error]').forEach(e => e.remove());
   form.querySelectorAll('.govuk-form-group--error').forEach(e => e.classList.remove('govuk-form-group--error'));
   form.querySelectorAll('[aria-invalid]').forEach(e => { e.removeAttribute('aria-invalid'); const ids = (e.getAttribute('aria-describedby') || '').split(' ').filter(x => !x.endsWith('-validation-error')); if (ids.length) e.setAttribute('aria-describedby', ids.join(' ')); else e.removeAttribute('aria-describedby'); });
   form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-required]').forEach(el => {
    if (el.disabled) return;
    if (!values[el.name] || Array.isArray(values[el.name]) && !values[el.name].length) {
     const message = el.dataset.required!, id = el.id + '-validation-error'; errors.push({ id: el.id, message });
     el.closest('.govuk-form-group')?.classList.add('govuk-form-group--error');
     const error = document.createElement('p'); error.id = id; error.dataset.validationError = ''; error.className = 'govuk-error-message'; error.textContent = message; el.before(error);
     const controls = Array.from(form.elements).filter((e): e is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => (e instanceof HTMLInputElement || e instanceof HTMLSelectElement || e instanceof HTMLTextAreaElement) && e.name === el.name);
     controls.forEach(e => { e.setAttribute('aria-invalid','true'); e.setAttribute('aria-describedby', ((e.getAttribute('aria-describedby') || '') + ' ' + id).trim()); });
    }
   });
   const container = form.querySelector('[data-errors]'); container?.replaceChildren();
   if (errors.length && container) {
    const summary = document.createElement('div'); summary.className = 'govuk-error-summary'; summary.tabIndex = -1; summary.setAttribute('role','alert');
    const title = document.createElement('h2'); title.className = 'govuk-error-summary__title'; title.textContent = 'There is a problem'; summary.append(title);
    const list = document.createElement('ul'); list.className = 'govuk-list govuk-error-summary__list';
    errors.forEach(error => { const li = document.createElement('li'), link = document.createElement('a'); link.href = '#' + error.id; link.textContent = error.message; link.onclick = () => document.getElementById(error.id)?.focus(); li.append(link); list.append(li); });
    summary.append(list); container.append(summary); summary.focus(); return;
   }
   const merged = { ...store.read(), ...values };
   if (plan.navigationOnly) delete merged[plan.field];
   const next = resolveFormDestination(plan, values, merged);
   if (!next) return;
   store.write(merged);
   // Return destinations are an allowlist, never arbitrary URL input. Recheck eligibility after edits.
   const target = params.get('return') === 'check-answers' && merged.eligible === 'yes' ? '/example/check-answers/' : next;
   if (target) location.assign(url(target, base));
  });
 });
}
document.querySelectorAll<HTMLAnchorElement>('[data-reset]').forEach(a => a.addEventListener('click', () => { store.clear(); session.remove(key + ':scenario'); }));
document.querySelectorAll<HTMLAnchorElement>('[data-signout]').forEach(a => a.addEventListener('click', () => session.remove(key + ':gate')));
initAll();
if (site.publicDemoGate.enabled && session.get(key + ':gate') !== site.publicDemoGate.passphrase) {
 const input = document.querySelector<HTMLInputElement>('#gate-passphrase')!; input.focus();
 document.querySelector('#gate-form')!.addEventListener('submit', event => { event.preventDefault(); if (input.value === site.publicDemoGate.passphrase) { session.set(key + ':gate', input.value); location.reload(); } else { document.querySelector<HTMLElement>('#gate-error')!.hidden = false; input.setAttribute('aria-invalid','true'); input.focus(); } });
} else { document.querySelector('#demo-gate')?.remove(); document.querySelector<HTMLElement>('#prototype')!.style.display = 'block'; start(); }
