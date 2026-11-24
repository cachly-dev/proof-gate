# proof-gate

**A task is done when `proof-gate <task>` exits 0. Not when the AI writes "done".**

My AI once told me, with real confidence, that it had added a safety check.
It had. The check was green. It had been green since the day it was written,
and it would have stayed green if I had deleted the feature it was guarding.
A check that has never said no is a very polite decoration.

proof-gate is one file with no dependencies. It does three things:

1. **Runs your checks** (tests, build, lint, anything with an exit code).
2. **Runs your controls**, which must *fail*. A control is the same check pointed
   at something that is supposed to be wrong. If a control passes, the gate says
   red: your check cannot say no.
3. **Locks the acceptance tests.** You pin them with a hash. If the AI "fixes"
   the test instead of the code, the gate says red.

Then it writes a receipt: commit, time, every command and its exit code. Your AI
pastes the receipt instead of the word "done".

## Try it in two minutes

```bash
npx github:cachly-dev/proof-gate lock rate-limit     # you pin the acceptance files once, then commit
npx github:cachly-dev/proof-gate rate-limit          # anyone (human or AI) runs this
```

```
TASK: rate-limit
GATE: 0 (2/2)
RECEIPT: .proof-gate/receipts/rate-limit.json
NOTE: -
```

`proof-gate.json` in your project root:

```json
{
  "tasks": {
    "rate-limit": {
      "locked": ["test/rate-limit.test.mjs"],
      "checks": [
        { "name": "acceptance", "run": "node --test test/rate-limit.test.mjs" }
      ],
      "controls": [
        {
          "name": "says no to the version without the limit",
          "run": "node --test test/rate-limit.test.mjs",
          "env": { "RATE_LIMIT_DISABLED": "1" }
        }
      ]
    }
  }
}
```

Exit codes: `0` green, `1` red, `2` refused. Refused means the setup is incomplete
(no controls, files not pinned, unknown task) and nothing was judged. Refused is
never green.

## Put this in CLAUDE.md / AGENTS.md

```markdown
## Done means
- A task is done when `npx github:cachly-dev/proof-gate <task>` exits 0. Paste its four lines.
- Never edit files listed under "locked". If the test is wrong, stop and say so.
- If a control passes, fix the check, not the control.
- "It should work" is a plan, not a result. Run it.
```

## Why controls

Every guard we ever trusted and later regretted had the same history: nobody had
seen it fail. So the gate refuses to start without at least one control per task.
Writing one takes a minute: run the same test with the feature switched off, with
an old fixture, or against a file that is known to be broken.

## What it is not

- Not a test runner. It calls yours.
- Not an AI judge. Everything it decides comes from an exit code.
- Receipts contain the last 20 lines of each command's output. Keep secrets out of
  your test output, or keep `.proof-gate/receipts/` out of git.

## Where it comes from

A larger internal harness for delegating work to coding agents, where the rule
"done means the gate says 0" replaced long checklists in prompts. This is the
small, portable core of it.

## The full version

proof-gate is the light version. The full method adds acceptance tests written
before the work starts, task packs, a ladder from the smallest model upwards and
a ledger of every verdict. If you want to hear when it's published, watch this
repo (Watch → Custom → Releases), or leave your email at
[cachly.dev/forge](https://cachly.dev/forge?utm_source=github&utm_medium=readme&utm_campaign=proof-gate).
One mail when it's out, nothing else.

MIT. Made by Heinrich Neb (cachly.dev).
