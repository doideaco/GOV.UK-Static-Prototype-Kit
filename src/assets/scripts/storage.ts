export type Answers = Record<string, string | string[]>;
export function createStore(storage: Storage, key: string) {
 let memory: Answers = {};
 return {
  read(): Answers { try { const v = JSON.parse(storage.getItem(key) || '{}'); if (v && typeof v === 'object' && !Array.isArray(v)) { memory = Object.fromEntries(Object.entries(v).filter(([,x]) => typeof x === 'string' || Array.isArray(x) && x.every(i => typeof i === 'string'))) as Answers; } } catch {} return memory; },
  write(value: Answers) { memory = value; try { storage.setItem(key, JSON.stringify(value)); } catch {} },
  clear() { memory = {}; try { storage.removeItem(key); } catch {} }
 };
}
