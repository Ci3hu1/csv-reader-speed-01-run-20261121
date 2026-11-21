// solve.js — a faster drop-in for make.fun's csv-reader 1.0.0.
//
// Design (our own recipe): a single-pass scanner with three paths, chosen per span.
//   1. Clean span: when the rest of a record holds no quote before its line
//      break, the whole span is split in one native split(',') call, and the
//      split array becomes the record's fields outright when it starts one.
//   2. Quoted field: located with indexOf('"'), "" escapes folded by
//      slicing, line breaks inside counted once and CR/CRLF folded to LF.
//   3. Broken span (a stray CR, a quote that never closes, junk after a
//      closing quote): a per-field reader driven by one native /[,\r\n]/g
//      scan, reproducing the reference's errors in their order.
// A record's line-break position is found once and reused across its spans
// (a quoted field that spans lines clears it). Every error the reference
// reports (stray_cr, unterminated_quote, quote_junk, short_row, long_row)
// is reported with the same line and row, and every answer is identical to
// csv-reader 1.0.0's.
//
// Dependency-free ES module, standard library only; nothing is installed
// before the program runs.

const COMMA = 0; // a field ended at a comma: the record goes on
const BREAK = 1; // a field ended at a line break: the record ends
const END = 2; // a field ended at the end of the text: the record ends

const TERM = /[,\r\n]/g; // the next terminator of an unquoted field

/** csv-reader 1.0.0's answer for one case's input: {columns, rows, errors}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const len = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0;
  let line = 1;
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and its index in rows (null: the header).
  let recordLine = 1;
  let recordRow = null;
  // The next LF from the record's start (-1: none left, or unknown after a quoted field spanned lines).
  let recEnd = -1;

  // The field just read (its value) and, for an unquoted read, how many characters it kept.
  let fv = '';
  let fa = 0;
  // Whether the quoted field just read held a line break inside it.
  let qbr = false;

  function err(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `init` up to the next comma or line break: a CR not followed by LF is
  // dropped (stray_cr). Sets fv/fa and returns COMMA, BREAK or END.
  function readUnquoted(init) {
    let value = init;
    let added = 0;
    for (;;) {
      TERM.lastIndex = pos;
      const m = TERM.exec(text);
      if (m === null) {
        if (pos < len) {
          value += text.slice(pos);
          added += len - pos;
          pos = len;
        }
        fv = value;
        fa = added;
        return END;
      }
      const t = m.index;
      const c = text.charCodeAt(t);
      if (c === 44) {
        value += text.slice(pos, t);
        added += t - pos;
        pos = t + 1;
        fv = value;
        fa = added;
        return COMMA;
      }
      if (c === 10) {
        value += text.slice(pos, t);
        added += t - pos;
        pos = t + 1;
        line += 1;
        fv = value;
        fa = added;
        return BREAK;
      }
      if (text.charCodeAt(t + 1) === 10) {
        value += text.slice(pos, t);
        added += t - pos;
        pos = t + 2;
        line += 1;
        fv = value;
        fa = added;
        return BREAK;
      }
      value += text.slice(pos, t);
      added += t - pos;
      err('stray_cr');
      pos = t + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fv and qbr, returns COMMA, BREAK or END.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    qbr = false;
    let p = pos + 1;
    let segStart = pos + 1;
    let parts = null;
    let q = -1;
    for (;;) {
      q = text.indexOf('"', p);
      if (q === -1) {
        // The quote never closes: it is a literal, and the text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        err('unterminated_quote');
        return readUnquoted('"');
      }
      if (text.charCodeAt(q + 1) === 34) {
        if (parts === null) parts = [text.slice(segStart, q)];
        else parts.push(text.slice(segStart, q));
        parts.push('"');
        p = q + 2;
        segStart = q + 2;
        continue;
      }
      break;
    }
    let value;
    if (parts === null) value = text.slice(segStart, q);
    else {
      parts.push(text.slice(segStart, q));
      value = parts.join('');
    }
    // Line breaks inside the quotes: each CRLF or lone CR is one LF, and the line counts each one.
    const hasLF = value.indexOf('\n') !== -1;
    const hasCR = value.indexOf('\r') !== -1;
    if (hasLF || hasCR) {
      let n = 0;
      if (hasCR) {
        let out = '';
        let s = 0;
        for (let i = 0; i < value.length; i++) {
          const ch = value.charCodeAt(i);
          if (ch === 13) {
            n += 1;
            out += value.slice(s, i) + '\n';
            s = value.charCodeAt(i + 1) === 10 ? i + 2 : i + 1;
            i = s - 1;
          } else if (ch === 10) {
            n += 1;
          }
        }
        if (s > 0) {
          if (s < value.length) out += value.slice(s);
          value = out;
        }
      } else {
        let at = -1;
        while ((at = value.indexOf('\n', at + 1)) !== -1) n += 1;
      }
      line += n;
      qbr = true;
    }
    const after = q + 1;
    if (after >= len) {
      pos = after;
      fv = value;
      return END;
    }
    const c = text.charCodeAt(after);
    if (c === 44) {
      pos = after + 1;
      fv = value;
      return COMMA;
    }
    if (c === 10) {
      pos = after + 1;
      line += 1;
      fv = value;
      return BREAK;
    }
    if (c === 13 && text.charCodeAt(after + 1) === 10) {
      pos = after + 2;
      line += 1;
      fv = value;
      return BREAK;
    }
    // What follows the closing quote is appended as it stands, up to the next comma or line break.
    pos = after;
    const ended = readUnquoted(value);
    if (fa > 0) err('quote_junk');
    return ended;
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else break;
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    recEnd = text.indexOf('\n', pos);
    let fields = [];
    let ended;
    let quoted = false;
    for (;;) {
      if (text.charCodeAt(pos) === 34) {
        quoted = true;
        ended = readQuoted();
        if (qbr) recEnd = -1;
        fields.push(fv);
      } else {
        quoted = false;
        if (recEnd === -1) recEnd = text.indexOf('\n', pos);
        const iQ = text.indexOf('"', pos);
        if (iQ === -1 || (recEnd !== -1 && iQ > recEnd)) {
          // The rest of the record holds no quote: split it in one call.
          const end = recEnd === -1 ? len : recEnd;
          const seg = text.slice(pos, end);
          const rAt = seg.indexOf('\r');
          if (rAt === -1) {
            const parts = seg.split(',');
            if (fields.length === 0) fields = parts;
            else for (let k = 0; k < parts.length; k++) fields.push(parts[k]);
            if (recEnd === -1) {
              pos = len;
              ended = END;
            } else {
              pos = end + 1;
              line += 1;
              ended = BREAK;
            }
          } else if (rAt === seg.length - 1 && recEnd !== -1) {
            // CRLF ending: the CR is the record's own.
            const parts = seg.slice(0, -1).split(',');
            if (fields.length === 0) fields = parts;
            else for (let k = 0; k < parts.length; k++) fields.push(parts[k]);
            pos = end + 1;
            line += 1;
            ended = BREAK;
          } else {
            // A stray CR inside: one field at a time.
            ended = readUnquoted('');
            fields.push(fv);
          }
        } else {
          // A quote lies ahead in this record.
          const seg = text.slice(pos, iQ);
          if (seg.indexOf('\r') !== -1) {
            ended = readUnquoted('');
            fields.push(fv);
          } else if (text.charCodeAt(iQ - 1) === 44) {
            // The quote opens a field right after a comma: split the unquoted fields before it.
            const parts = seg.split(',');
            if (fields.length === 0) {
              parts.length -= 1;
              fields = parts;
            } else for (let k = 0; k < parts.length - 1; k++) fields.push(parts[k]);
            pos = iQ;
            continue;
          } else {
            // The quote sits inside an unquoted field: it is a literal.
            ended = readUnquoted('');
            fields.push(fv);
          }
        }
      }
      if (ended !== COMMA) break;
    }

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
