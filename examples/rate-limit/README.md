# Example: a rate limiter that has to prove it works

A five-minute walkthrough. Everything here runs with plain Node 18+, no install.

```bash
git clone https://github.com/cachly-dev/proof-gate
cd proof-gate/examples/rate-limit
node ../../proof-gate.mjs rate-limit
```

```
TASK: rate-limit
GATE: 0 (2/2)
RECEIPT: .proof-gate/receipts/rate-limit.json
NOTE: -
```

Green: the acceptance test passed, and the control (the same test with the limit
switched off) failed, the way it must. The acceptance file is pinned in
`.proof-gate/locks.json`, which is committed.

## Now try the three things agents do

These are the outputs you get. Undo each change afterwards (`git checkout .`).

### 1. The code is broken

Replace `return entry.count <= limit;` in `src/rate-limit.mjs` with `return true;`.

```
TASK: rate-limit
GATE: 1 (1/2)
NOTE: check failed (exit 1): acceptance
```

The ordinary case. Every test runner catches this.

### 2. The test can't fail

Point the task at a test that only checks that `createLimiter` exists, pin it, run again.

```
TASK: rate-limit
GATE: 1 (1/2)
NOTE: control passed, so the check cannot say no: says no to the version without the limit
```

The test passes, but it also passes with the limit switched off. So it proves
nothing, and the gate says so. A normal test run would have shown green.

### 3. The agent edits the test that judges it

Change the last assertion in `test/rate-limit.test.mjs` to `assert.ok(true);`.

```
TASK: rate-limit
GATE: 1 (0/2)
NOTE: locked file changed: test/rate-limit.test.mjs
```

The cheapest way to turn red into green is to fix the test instead of the code.
The hash in `locks.json` makes that visible, whatever the edited test now says.

## Use it in your own repo

Copy `proof-gate.mjs` next to your project, write a `proof-gate.json` like the one
here, run `node proof-gate.mjs lock <task>` once, commit the lock file, and put the
block from the main README into `CLAUDE.md` or `AGENTS.md`.
