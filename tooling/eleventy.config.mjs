import fs from 'node:fs';
import { createRequire } from 'node:module';
import YAML from 'yaml';
import { validateJourneys, url } from './rules.mjs';
// Use Eleventy's engine instance so imported macros share its SafeString type.
const require = createRequire(import.meta.url);
const nunjucks = require(require.resolve('nunjucks', { paths: [require.resolve('@11ty/eleventy')] }));
const read = name => YAML.parse(fs.readFileSync(`src/data/${name}.yaml`, 'utf8'));
function configuration(base) {
  const site = read('site'), { journeys } = read('journeys'), scenarios = read('scenarios');
  if (!['session','local'].includes(site.storage) || !/^[a-z0-9-]+$/.test(site.prototypeId) || !Number.isInteger(site.schemaVersion)) throw Error('Invalid site storage, prototypeId or schemaVersion');
  if (process.env.PUBLIC_DEMO_GATE_ENABLED === 'true') site.publicDemoGate.enabled = true;
  if (site.publicDemoGate.enabled && !site.publicDemoGate.passphrase) throw Error('Enabled public demo gate needs a fictional passphrase');
  const files = fs.readdirSync('src/pages', {recursive:true}).filter(f => f.endsWith('.njk'));
  const routes = files.map(f => {
    const source = fs.readFileSync(`src/pages/${f}`, 'utf8');
    const front = source.match(/^---\n([\s\S]*?)\n---/);
    const route = front && YAML.parse(front[1]).permalink;
    if (typeof route !== 'string' || !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(route)) throw Error(`Page ${f} needs an absolute directory permalink`);
    return route;
  });
  if (new Set(routes).size !== routes.length) throw Error('Duplicate page permalinks');
  validateJourneys(journeys, routes);
  for (const scenario of Object.values(scenarios)) if (!routes.includes(scenario.start)) throw Error('Unknown scenario start');
  return { site, journeys, scenarios, base, development: process.env.NODE_ENV !== 'production' };
}
export default function(eleventy) {
  const base = process.env.BASE_PATH || '/';
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)) throw Error('BASE_PATH must be / or /repository/');
  let manifest = configuration(base);
  eleventy.on('eleventy.before', () => { manifest = configuration(base); });
  eleventy.addGlobalData('site', () => manifest.site);
  eleventy.addGlobalData('manifest', () => manifest);
  const json = v => JSON.stringify(v).replace(/</g, '\\u003c');
  eleventy.addFilter('url', p => url(p, base));
  eleventy.addFilter('json', json);
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(['src/_includes', 'node_modules/govuk-frontend/dist']), { autoescape: true });
  env.addFilter('url', p => url(p, base));
  env.addFilter('json', json);
  eleventy.setLibrary('njk', env);
  eleventy.addPassthroughCopy({ 'node_modules/govuk-frontend/dist/govuk/assets': 'assets', 'build': 'assets' });
  eleventy.addWatchTarget('src/data');
  return { dir: { input: 'src/pages', includes: '../_includes', output: '_site' }, htmlTemplateEngine: 'njk' };
}
