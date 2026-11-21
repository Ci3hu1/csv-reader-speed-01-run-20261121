// tests/bench.mjs — time our run() against csv-reader 1.0.0 (tests/oracle.mjs)
// on the practice set. Run: node --no-incremental-marking tests/bench.mjs
import { readFileSync } from 'node:fs';
import { run } from '../solve.js';
import { readCsv } from './oracle.mjs';

const practicePath = new URL(
  '../../csv-reader-speed-01-run-20261121-kit/practice/input/cases.json',
  import.meta.url,
);
const cases = JSON.parse(readFileSync(practicePath, 'utf8'));
const totalChars = cases.reduce((n, c) => n + c.input.text.length, 0);
console.log(`cases=${cases.length} totalChars=${totalChars}`);

function time(fn, label, iters) {
  // Warm-up (lets V8 optimise), then timed runs.
  fn();
  const times = [];
  for (let i = 0; i < iters; i++) {
    const t0 = process.hrtime.bigint();
    fn();
    const t1 = process.hrtime.bigint();
    times.push(Number(t1 - t0) / 1000);
  }
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)];
  console.log(`${label}: median ${Math.round(med).toLocaleString()} µs over ${iters} runs [${times.map((t) => Math.round(t).toLocaleString()).join(', ')}]`);
  return med;
}

const ref = time(() => {
  for (const c of cases) readCsv(c.input);
}, 'reference csv-reader', 3);
const mine = time(() => {
  for (const c of cases) run(c.input);
}, 'solve.js', 5);
console.log(`speedup: ${(ref / mine).toFixed(2)}x (leader board: 530,000 µs; mine ${Math.round(mine).toLocaleString()} µs)`);
