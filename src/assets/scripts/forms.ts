import type { Answers } from './storage';
export function serialize(form: HTMLFormElement): Answers {
 const result: Answers = {};
 const controls = Array.from(form.elements).filter((e): e is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement => e instanceof HTMLInputElement || e instanceof HTMLSelectElement || e instanceof HTMLTextAreaElement).filter(e => e.name && !e.disabled && !['submit','button','reset','file','password'].includes(e.type));
 for (const name of new Set(controls.map(e => e.name))) {
  const group = controls.filter(e => e.name === name);
  const values = group.flatMap(e => e instanceof HTMLInputElement && ['checkbox','radio'].includes(e.type) ? e.checked ? [e.value] : [] : e instanceof HTMLSelectElement && e.multiple ? Array.from(e.selectedOptions, o => o.value) : [e.value.trim()]);
  result[name] = group.some(e => e.type === 'checkbox' || e instanceof HTMLSelectElement && e.multiple) || group.length > 1 && !group.some(e => e.type === 'radio') ? values : values[0] || '';
 }
 return result;
}
export function restore(form: HTMLFormElement, answers: Answers) {
 const positions: Record<string, number> = {};
 for (const el of Array.from(form.elements)) {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) || !(el.name in answers)) continue;
  const value = answers[el.name];
  if (el instanceof HTMLInputElement && ['radio','checkbox'].includes(el.type)) el.checked = Array.isArray(value) ? value.includes(el.value) : value === el.value;
  else if (el instanceof HTMLSelectElement && el.multiple) for (const option of el.options) option.selected = Array.isArray(value) && value.includes(option.value);
  else { const index = positions[el.name] || 0; el.value = Array.isArray(value) ? value[index] || '' : value; positions[el.name] = index + 1; }
 }
}
