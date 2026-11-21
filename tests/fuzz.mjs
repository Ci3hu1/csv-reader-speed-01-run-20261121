// tests/fuzz.mjs — differential fuzz test: our run() must answer exactly as
// csv-reader 1.0.0 (tests/oracle.mjs, the kit's reference, vendored here as
// the test oracle only) on the practice set, on targeted edge cases, and on
// seeded random inputs. Run: node tests/fuzz.mjs [practice-cases.json]
import { readFileSync } from 'node:fs';
import { run } from '../solve.js';
import { readCsv } from './oracle.mjs';

const practicePath =
  process.argv[2] ??
  new URL('../../csv-reader-speed-01-run-20261121-kit/practice/input/cases.json', import.meta.url);

let checked = 0;
let failed = 0;
const failures = [];

function check(input, label) {
  checked += 1;
  let a;
  let b;
  try {
    a = JSON.stringify(run(input));
  } catch (e) {
    a = `THREW ${e.message}`;
  }
  try {
    b = JSON.stringify(readCsv(input));
  } catch (e) {
    b = `THREW ${e.message}`;
  }
  if (a !== b) {
    failed += 1;
    if (failures.length < 5) failures.push({ label, input, mine: a.slice(0, 600), ref: b.slice(0, 600) });
  }
}

// 1. The practice set.
const cases = JSON.parse(readFileSync(practicePath, 'utf8'));
for (const c of cases) check(c.input, `practice ${c.id}`);

// 2. Targeted edge cases.
const edgeTexts = [
  '',
  '\uFEFF',
  '\uFEFF\n',
  '\n',
  '\r\n',
  '\r',
  '\r\r\n',
  '\r\ra,b',
  'a,b',
  'a,b\n',
  'a,b\r\n',
  'a,b\r',
  'a,',
  ',',
  ',,',
  'a\n\nb',
  'a\r\n\r\nb',
  '"a"',
  '"a',
  '"a\nb"',
  '"a\r\nb"',
  '"a\rb"',
  '"a""b"',
  '"""',
  '""',
  '"',
  '""x',
  '"a"x',
  '"a"x"y"',
  '"a"\r\rb',
  '"a"\r',
  '"a"\r\n',
  'a"b',
  'a"b"c',
  '"a",b',
  '"a\nb",c\nd,e',
  '"a\r\rb",c',
  '"unterminated\nmore,text',
  'a,"b\nc",d',
  'h1,h2\n1,2\n3',
  'h1,h2\n1,2,3\n4,5',
  'h1\n1,2\n3',
  'a,b\n"c\nd",e\nf,g',
  '\uFEFFa,b\nc,d',
  'a,\uFEFFb',
  'x\ry\nz',
  '"a" ,b',
  '"a"  ,b',
  '"a"b,c',
  '"a""",b',
  '"a""',
  '"a""b',
  'a,"b"c"d",e',
  '"\n"',
  '"\r"',
  '"\r\n"',
  'a,b\n\n',
  'a,b\n\r\nc,d',
  'a,b\r\rc,d',
  '"multi\nline\nfield",x\ny,z',
  'a,"unterminated',
  '"a",',
  ',"a"',
  'a,"b\n\nc",d',
];
for (const t of edgeTexts) for (const h of [true, false]) check({ text: t, header: h }, `edge ${JSON.stringify(t)} h=${h}`);

// 3. Seeded random fuzz: small texts from a hostile alphabet, plus structured records.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const alphabet = ['a', 'b', 'x', ' ', ',', '"', '\n', '\r', '\uFEFF', 'é', '1', '.', '_'];
const rng = mulberry32(20261121);
function randText(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(rng() * alphabet.length)];
  return s;
}
for (let i = 0; i < 1500; i++) {
  const n = Math.floor(rng() * 60);
  check({ text: randText(n), header: rng() < 0.5 }, `random#${i}`);
}
// Structured: random records of random fields, some quoted, some broken.
const words = ['alpha', 'bravo', 'x,y', 'say "hi"', 'multi\nline', 'cr\rhere', 'crlf\r\nin', '', '  ', 'O\u2019Brien'];
function randField() {
  const w = words[Math.floor(rng() * words.length)];
  const r = rng();
  if (r < 0.55) return w;
  if (r < 0.8) return `"${w.replaceAll('"', '""')}"`;
  if (r < 0.88) return `"${w.replaceAll('"', '""')}"${['kg', 'x', '!', 'x"y', ' (est.)'][Math.floor(rng() * 5)]}`;
  if (r < 0.94) return `"${w}`; // unterminated
  return w;
}
for (let i = 0; i < 800; i++) {
  const nrec = 1 + Math.floor(rng() * 12);
  const eol = rng() < 0.5 ? '\n' : '\r\n';
  let text = rng() < 0.3 ? '\uFEFF' : '';
  for (let r = 0; r < nrec; r++) {
    if (rng() < 0.05) text += eol; // blank line
    const nfields = 1 + Math.floor(rng() * 6);
    const fields = [];
    for (let f = 0; f < nfields; f++) fields.push(randField());
    text += fields.join(',');
    if (rng() < 0.9) text += eol;
  }
  check({ text, header: rng() < 0.5 }, `structured#${i}`);
}
// Long-field stress: one huge quoted field, one huge unquoted field.
check({ text: `"${'x'.repeat(200000)}",b\nc,d`, header: true }, 'huge-quoted');
check({ text: `${'y'.repeat(200000)},b\nc,d`, header: true }, 'huge-unquoted');
check({ text: `"${'a"b\n'.repeat(20000)}",b\nc,d`, header: false }, 'many-escapes');

console.log(`checked=${checked} failed=${failed}`);
for (const f of failures) {
  console.log('FAIL', f.label);
  console.log('  input:', JSON.stringify(f.input).slice(0, 300));
  console.log('  mine :', f.mine);
  console.log('  ref  :', f.ref);
}
process.exit(failed === 0 ? 0 : 1);
