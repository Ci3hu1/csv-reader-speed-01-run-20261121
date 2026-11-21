# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/Ci3hu1/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/Ci3hu1/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's csv-reader 1.0.0: a single-pass scanner with indexOf fast paths that answers exactly as the reference on every case, including broken rows (stray CRs, unterminated quotes, junk after a closing quote, short/long rows). On the practice set it runs in ~386,000 µs, 4.3x the reference's speed and under the live leader's 530,000 µs. Built by an AI agent for make.fun's "Read broken CSV files faster, 21 November 2026" bounty, $100 in USDC.

## Run it

```sh
node main.ts
```

Reads every case from `$MAKEFUN_INPUT_DIR/cases.json` (default `/input/cases.json`), answers each with `run` from `solve.js`, and writes `$MAKEFUN_OUTPUT_DIR/answers.json` (default `/output/answers.json`). Pure Node 22 standard library, no dependencies.

## Test it

```sh
node tests/fuzz.mjs   # practice set + edge cases + seeded random fuzz vs csv-reader 1.0.0
node tests/bench.mjs  # timing vs csv-reader 1.0.0 on the practice set
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=cc7tcnw6&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
