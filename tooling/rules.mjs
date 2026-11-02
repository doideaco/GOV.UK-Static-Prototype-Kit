export function matches(rule, answers) {
  if ('all' in rule) return rule.all.every(r => matches(r, answers));
  if ('any' in rule) return rule.any.some(r => matches(r, answers));
  const value = answers[rule.field];
  if ('equals' in rule) return value === rule.equals;
  if ('notEquals' in rule) return value !== rule.notEquals;
  if ('in' in rule) return rule.in.includes(value);
  if ('exists' in rule) return (value !== undefined && value !== '' && (!Array.isArray(value) || value.length > 0)) === rule.exists;
  return false;
}
export function destination(step, answers) {
  if (typeof step?.next === 'string') return step.next;
  return step?.next?.find(r => r.otherwise || matches(r.when, answers))?.path || step?.next?.find(r => r.otherwise)?.otherwise;
}
export function validateJourneys(journeys, routes) {
  const seen = new Set();
  function condition(r) {
    if (!r || typeof r !== 'object') throw Error('Missing condition');
    const ops = Object.keys(r).filter(k => k !== 'field');
    if (ops.length !== 1 || !['equals','notEquals','in','exists','all','any'].includes(ops[0])) throw Error('Unsupported operator');
    const op = ops[0];
    if (['all','any'].includes(op)) { if (!Array.isArray(r[op]) || !r[op].length) throw Error('Empty condition group'); r[op].forEach(condition); }
    else if (typeof r.field !== 'string' || (op === 'in' && !Array.isArray(r.in)) || (op === 'exists' && typeof r.exists !== 'boolean')) throw Error('Invalid condition');
  }
  const check = p => { if (!routes.includes(p)) throw Error(`Unknown destination: ${p}`); };
  for (const journey of Object.values(journeys)) for (const step of journey.steps) {
    if (seen.has(step.path)) throw Error(`Duplicate route: ${step.path}`);
    seen.add(step.path); check(step.path);
    if (typeof step.next === 'string') check(step.next);
    else if (step.next) {
      if (!Array.isArray(step.next) || step.next.filter(r => r.otherwise).length !== 1 || !step.next.at(-1).otherwise) throw Error('Branches need a final default');
      step.next.forEach(r => { if (!r.otherwise) condition(r.when); check(r.otherwise || r.path); });
    }
  }
}
export function url(path, base = '/') { return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`; }

export function resolveFormDestination(plan, submitted, answers) {
  if (plan.mode === 'inline') return plan.choices.find(choice => choice.value === submitted[plan.field])?.next;
  return destination({next:plan.next}, answers);
}
