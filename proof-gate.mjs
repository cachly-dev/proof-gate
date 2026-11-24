#!/usr/bin/env node
// proof-gate — a task is done when this exits 0, not when the AI says "done".
//
//   proof-gate lock <task>   pin the acceptance files (a human runs this, then commits)
//   proof-gate <task>        run checks + controls, write a receipt, print 4 lines
//
// Exit codes: 0 = green, 1 = red, 2 = refused (setup is incomplete, nothing was judged).
// MIT License. No dependencies. Node 18+.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CONFIG = 'proof-gate.json';
const DIR = '.proof-gate';
const LOCKS = join(DIR, 'locks.json');
const TAIL_LINES = 20;

function print(task, code, detail, receipt, note) {
  console.log(`TASK: ${task ?? '-'}`);
  console.log(`GATE: ${code} (${detail})`);
  console.log(`RECEIPT: ${receipt ?? '-'}`);
  console.log(`NOTE: ${note || '-'}`);
  process.exit(code);
}

function refuse(task, why) {
  print(task, 2, 'refused', null, why);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

// Line endings are normalised, so a Windows checkout does not "change" a locked file.
function hashFile(path) {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
  return createHash('sha256').update(text).digest('hex');
}

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function run(step) {
  const started = Date.now();
  const r = spawnSync(step.run, {
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, ...(step.env || {}) },
    timeout: (step.timeoutSeconds ?? 600) * 1000,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd().split('\n').slice(-TAIL_LINES).join('\n');
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status === null && r.signal);
  return {
    name: step.name ?? step.run,
    run: step.run,
    exit: timedOut ? null : r.status,
    timedOut: Boolean(timedOut),
    seconds: Math.round((Date.now() - started) / 100) / 10,
    tail: output,
  };
}

const [first, second] = process.argv.slice(2);
const isLock = first === 'lock';
const taskId = isLock ? second : first;

if (!taskId) {
  console.log('usage: proof-gate <task> | proof-gate lock <task>');
  process.exit(2);
}

const config = readJson(CONFIG);
if (!config?.tasks) refuse(taskId, `${CONFIG} missing or has no "tasks"`);
const task = config.tasks[taskId];
if (!task) refuse(taskId, `unknown task "${taskId}" in ${CONFIG}`);

const locked = task.locked ?? [];

if (isLock) {
  const missing = locked.filter((f) => !existsSync(f));
  if (missing.length) refuse(taskId, `cannot lock, file missing: ${missing.join(', ')}`);
  const locks = readJson(LOCKS) ?? {};
  locks[taskId] = Object.fromEntries(locked.map((f) => [f, hashFile(f)]));
  mkdirSync(DIR, { recursive: true });
  writeFileSync(LOCKS, `${JSON.stringify(locks, null, 2)}\n`);
  print(taskId, 0, `${locked.length} file(s) locked`, LOCKS, 'commit .proof-gate/locks.json');
}

const checks = task.checks ?? [];
const controls = task.controls ?? [];
if (!checks.length) refuse(taskId, 'no checks: nothing would be proven');
if (!controls.length) {
  refuse(taskId, 'no controls: a check nobody has seen fail is not a check yet (add one that must fail)');
}

const pinned = readJson(LOCKS)?.[taskId];
if (locked.length && !pinned) refuse(taskId, `locked files are not pinned yet: run "proof-gate lock ${taskId}"`);

const problems = [];
for (const f of locked) {
  if (!existsSync(f)) problems.push(`locked file missing: ${f}`);
  else if (pinned[f] !== hashFile(f)) problems.push(`locked file changed: ${f}`);
}

const checkResults = problems.length ? [] : checks.map(run);
const controlResults = problems.length ? [] : controls.map(run);

for (const c of checkResults) {
  if (c.timedOut) problems.push(`check timed out: ${c.name}`);
  else if (c.exit !== 0) problems.push(`check failed (exit ${c.exit}): ${c.name}`);
}
for (const c of controlResults) {
  if (c.timedOut) problems.push(`control timed out: ${c.name}`);
  else if (c.exit === 0) problems.push(`control passed, so the check cannot say no: ${c.name}`);
}

const green = checkResults.filter((c) => c.exit === 0).length
  + controlResults.filter((c) => c.exit !== 0 && !c.timedOut).length;
const total = checks.length + controls.length;
const code = problems.length ? 1 : 0;

const receipt = {
  task: taskId,
  verdict: code === 0 ? 'green' : 'red',
  at: new Date().toISOString(),
  commit: git(['rev-parse', 'HEAD']),
  dirty: git(['status', '--porcelain']) ? true : false,
  node: process.version,
  problems,
  checks: checkResults,
  controls: controlResults,
};
mkdirSync(join(DIR, 'receipts'), { recursive: true });
const receiptPath = join(DIR, 'receipts', `${taskId}.json`);
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

print(taskId, code, `${green}/${total}`, receiptPath.replace(/\\/g, '/'), problems[0] ?? '');
