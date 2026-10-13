/* eslint-disable no-console -- command-line gate: console output is its interface */
// Blocking dependency gate: fails on any high/critical advisory that is not a reviewed,
// unexpired entry in audit-exceptions.json. Fails closed if the audit cannot be obtained.
// Why not plain `npm audit --omit=dev`: Expo/Metro/React Native build tooling is classed as a
// production dependency, so that check cannot reach zero today (docs/13 section 14).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BLOCKING = new Set(['high', 'critical']);
const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
});

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error('audit-gate: could not parse npm audit output; treating as FAILURE.');
  console.error(run.stderr || run.stdout);
  process.exit(2);
}
if (report.error || !report.vulnerabilities) {
  console.error('audit-gate: audit service unavailable or errored; treating as FAILURE.');
  console.error(JSON.stringify(report.error ?? report, null, 2));
  process.exit(2);
}

const { exceptions } = JSON.parse(
  readFileSync(new URL('../audit-exceptions.json', import.meta.url), 'utf8'),
);
const today = new Date().toISOString().slice(0, 10);
const byId = new Map(exceptions.map((e) => [e.advisory, e]));

const problems = [];
const accepted = new Set();
for (const [name, vuln] of Object.entries(report.vulnerabilities)) {
  for (const via of vuln.via) {
    if (typeof via !== 'object' || !BLOCKING.has(via.severity)) continue; // propagated entries are not advisories
    const id = via.url?.split('/').pop();
    const exception = byId.get(id);
    if (!exception)
      problems.push(`${name}: ${via.severity} ${id} (${via.title}) is NOT an accepted exception`);
    else if (exception.reviewBy < today)
      problems.push(`${name}: exception for ${id} expired on ${exception.reviewBy}`);
    else accepted.add(id);
  }
}

for (const id of accepted) console.log(`audit-gate: accepted (reviewed) ${id}`);
if (problems.length) {
  console.error(problems.map((p) => `audit-gate: ${p}`).join('\n'));
  process.exit(1);
}
console.log('audit-gate: no unreviewed high/critical advisories in production dependencies.');
