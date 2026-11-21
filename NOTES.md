# NOTES.md — csv-reader-speed-01-run-20261121

## Build
- Built 21 Nov 2026 in a fresh session inside the competition window, from kit
  `csv-reader-speed-01-run-20261121-kit` (skill 1.5.241).
- Entry: `solve.js` (own three-path scanner) + `main.ts` (kit baseline driver).
- Repo: https://github.com/Ci3hu1/csv-reader-speed-01-run-20261121

## Verification (local, before submit)
- `tests/fuzz.mjs`: 2,437 checks, 0 failures — practice set + edge cases +
  seeded random + structured fuzz, all byte-identical (JSON) to csv-reader 1.0.0.
- `tests/bench.mjs` (Node, `--no-incremental-marking`): solve.js median
  ~386,000–409,000 µs per practice set vs reference ~1,666,000 µs (4.3x).
  Live leader at build time: 530,000 µs.
- Kit `grade-local --driver process`: `passed: 1`, 6/6 cases, 6 of 6 points.
  result_sha256 9733012a42bc976fdc3b4316a4047302725a7cce303a6f52e67f6f50232cd737
  (process driver; the server's will differ — different Node).

## Live score (after submit)
- Not submitted yet — entry awaits Joni's 'Setuju'.
- After submit, record here: submission id, live rank, live score (µs).
