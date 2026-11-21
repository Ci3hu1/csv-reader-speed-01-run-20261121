# STRATEGY.md — csv-reader-speed-01-run-20261121

## Measured edge

The task is a pure CPU race: answer exactly as csv-reader 1.0.0 on every case,
ranked by CPU time (trimmed mean, lower first). The reference is a
character-at-a-time reader that builds every field with `value += c`.

- Practice set: 6 cases, 10,193,953 characters total, ~77k lines, 8–18 columns.
- Reference on this machine (Node 24, `--no-incremental-marking`): ~1,666,875 µs
  for the set. Our entry: ~386,000–409,000 µs median — about 4.3x faster.
- Live leader at build time: 530,000 µs. Our practice-set median sits below it.
- Data mix (measured on the practice set): 75.8% of lines contain a quote, so
  the quoted-field path is the hot path, not a corner case; 2.2% of lines hold
  an interior CR; about half the files are CRLF. Broken kinds are each ≤1% of
  records, but short/long rows appear by the hundred per case.

## Design (our own recipe)

A single-pass scanner over the flat text, three paths chosen per span:

1. **Clean span** — when the rest of a record holds no quote before its line
   break, the whole span is split in one native `split(',')` call, and the
   split array becomes the record's fields outright when it starts one. A
   record's line-break position is found once per record and reused across
   its spans; a quoted field that spans lines clears it.
2. **Quoted field** — located with `indexOf('"')`; `""` escapes are folded by
   slicing the segments around them; line breaks inside are counted once and
   CR/CRLF are folded to LF. The terminator after the closing quote is
   checked directly (comma / LF / CRLF / junk / end of text).
3. **Broken span** — a stray CR, a quote that never closes, junk after a
   closing quote: a per-field reader driven by one native `/[,\r\n]/g` scan,
   which reproduces the reference's errors in their order.

Errors (`stray_cr`, `unterminated_quote`, `quote_junk`, `short_row`,
`long_row`) are reported with the same line (the record's start line) and row
as the reference. `columns`/`rows`/`errors` are built exactly as the
reference builds them, including the stray-CR-only line that is no record and
the header that sets the width.

## Verification

- `tests/fuzz.mjs`: 2,437 checks, 0 failures — the practice set, ~60 targeted
  edge cases (BOM, empty lines, CRLF, lone CRs, unterminated quotes,
  junk-after-quote, huge fields) in both header modes, 1,500 seeded random
  texts, and 800 seeded structured records, all compared byte-for-byte
  (JSON) against the reference.
- `tests/bench.mjs`: timing vs the reference on the practice set.
- The kit's `grade-local` (see NOTES.md) is the final gate before submit.

## Tried and dropped

- **Character-at-a-time loop** — that is the reference itself; 4.3x slower.
- **Three `indexOf` calls per unquoted field** (one each for `,`, `\n`, `\r`) —
  replaced by one `/[,\r\n]/g` scan per field: the `\r` scan ran far past the
  field in LF files. The regex path is only used for broken spans; clean spans
  never reach it.
- **Splitting the whole text into lines first** — rejected: quoted fields can
  span lines, so line boundaries are not record boundaries, and the merge
  logic would cost back the `indexOf('\n')` it saved.
- **Per-field `indexOf` + `slice` for clean spans** — replaced by one
  `split(',')` per span: the native split is faster than a JS loop of
  `indexOf`/`slice`/`push`, and assigning the split array as the record's
  fields avoids a copy loop.
- **A single regex scan for quote-or-LF** (`/["\n]/g`) in place of the two
  `indexOf` calls — tried as a variant; the A/B run on this VM was too slow
  and noisy to distinguish it from `indexOf` (run-to-run variance ±20%),
  so the `indexOf` version was kept.

## Risks

- The scored set is a fresh draw: if it holds far more quoted or multi-line
  fields than the practice set, the quoted path dominates even more. The
  quoted path is already the fast path (indexOf + slice, no per-char loop).
- Timing is machine-dependent; the local margin over the 530,000 µs leader
  is about 20–25% on this VM, and run-to-run variance here is ±20%.
- The entry must stay under the 1 MiB repository cap (it is ~30 KB).
