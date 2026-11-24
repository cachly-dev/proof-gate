import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'proof-gate.mjs');
const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';

function project(task, files = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'proof-gate-'));
  writeFileSync(join(dir, 'proof-gate.json'), JSON.stringify({ tasks: { t: task } }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}

function gate(dir, ...args) {
  const r = spawnSync(process.execPath, [GATE, ...args], { cwd: dir, encoding: 'utf8' });
  return { code: r.status, out: r.stdout };
}

const healthy = {
  locked: ['test/acceptance.txt'],
  checks: [{ name: 'acceptance', run: PASS }],
  controls: [{ name: 'says no to the broken version', run: FAIL }],
};

test('green: check passes, control fails, lock matches', () => {
  const dir = project(healthy, { 'test/acceptance.txt': 'rate limit is 10\n' });
  assert.equal(gate(dir, 'lock', 't').code, 0);
  const r = gate(dir, 't');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /GATE: 0 \(2\/2\)/);
  const receipt = JSON.parse(readFileSync(join(dir, '.proof-gate/receipts/t.json'), 'utf8'));
  assert.equal(receipt.verdict, 'green');
  assert.equal(receipt.checks[0].exit, 0);
});

test('red: a failing check makes the gate say no', () => {
  const dir = project({ ...healthy, checks: [{ name: 'acceptance', run: FAIL }] }, { 'test/acceptance.txt': 'x' });
  gate(dir, 'lock', 't');
  const r = gate(dir, 't');
  assert.equal(r.code, 1);
  assert.match(r.out, /check failed \(exit 1\): acceptance/);
});

test('red: a control that passes means the check cannot say no', () => {
  const dir = project({ ...healthy, controls: [{ name: 'should fail', run: PASS }] }, { 'test/acceptance.txt': 'x' });
  gate(dir, 'lock', 't');
  const r = gate(dir, 't');
  assert.equal(r.code, 1);
  assert.match(r.out, /control passed, so the check cannot say no/);
});

test('red: editing a locked acceptance file after the lock', () => {
  const dir = project(healthy, { 'test/acceptance.txt': 'rate limit is 10\n' });
  gate(dir, 'lock', 't');
  writeFileSync(join(dir, 'test/acceptance.txt'), 'rate limit is 10000\n');
  const r = gate(dir, 't');
  assert.equal(r.code, 1);
  assert.match(r.out, /locked file changed: test\/acceptance.txt/);
});

test('line endings alone do not count as a change', () => {
  const dir = project(healthy, { 'test/acceptance.txt': 'a\nb\n' });
  gate(dir, 'lock', 't');
  writeFileSync(join(dir, 'test/acceptance.txt'), 'a\r\nb\r\n');
  assert.equal(gate(dir, 't').code, 0);
});

test('refused: no controls, nothing judged', () => {
  const dir = project({ checks: [{ run: PASS }] });
  const r = gate(dir, 't');
  assert.equal(r.code, 2);
  assert.match(r.out, /no controls/);
});

test('refused: locked files not pinned yet', () => {
  const dir = project(healthy, { 'test/acceptance.txt': 'x' });
  const r = gate(dir, 't');
  assert.equal(r.code, 2);
  assert.match(r.out, /not pinned yet/);
});

test('refused: unknown task', () => {
  const dir = project(healthy);
  assert.equal(gate(dir, 'nope').code, 2);
});
