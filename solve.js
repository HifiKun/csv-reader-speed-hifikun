// Fast drop-in for csv-reader 1.0.0 (make.fun's own reference CSV reader).
//
// Returns exactly csv-reader's answer {columns, rows, errors} for every input
// {text, header}, following its written broken-row policy (RULES.txt):
//   - a U+FEFF at the very start of the text is dropped;
//   - a record ends at LF or CRLF, and a line left with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (error stray_cr);
//   - a field that opens with a quote runs to the next quote that is not doubled,
//     "" inside it is one quote, and each CRLF or lone CR inside it is read as LF;
//     what follows its closing quote, up to the next comma or line break, is
//     appended as it stands (error quote_junk, when the field ends);
//   - a quote that never closes is a literal character, and the text after it is
//     read again as unquoted (error unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it (every record when header is false), each padded with ""
//     (short_row, with fields: its field count) or cut (long_row, with extra:
//     the cut fields) to the first record's width;
//   - each error is {code, line, row}, in the order met; line is the 1-based line
//     its record starts on, counting every LF, CRLF and lone CR inside quotes,
//     and row is its record's index in rows, null for the header.
//
// Speed comes from never reading the text one character at a time. An unquoted
// field is found with two indexOf jumps (next comma, next LF); the sliced value
// is itself checked for a stray CR, and only the rare field that holds one falls
// back to a careful re-scan. A quoted field jumps straight to the next quote
// with indexOf, its value is taken with slice() ("" unescaped, CRs turned to LF
// only when one is present), and the line breaks inside it are counted from the
// built value's own LFs. Only the rare paths do extra work.

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (n > 0 && text.charCodeAt(0) === 0xFEFF) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Results of the last parseUnquoted call: the field, how it ended
  // (0 comma, 1 line break, 2 end of text), and how many characters it appended.
  let uVal = '';
  let uEnded = 0;
  let uAdded = 0;

  // Reads unquoted characters onto `init` up to the next comma or line break: a CR not
  // followed by LF is dropped (stray_cr). Sets uVal, uEnded and uAdded.
  // Fast path: two indexOf calls find the field end; the sliced value itself is
  // checked for stray CRs (rare), falling back to the careful loop then.
  function parseUnquoted(init) {
    const iC = text.indexOf(',', pos);
    const iN = text.indexOf('\n', pos);
    let end;
    let kind; // 0 comma, 1 LF, 2 end
    if (iC !== -1 && (iN === -1 || iC < iN)) { end = iC; kind = 0; }
    else if (iN !== -1) { end = iN; kind = 1; }
    else { end = n; kind = 2; }
    let vEnd = end;
    if (kind === 1 && end > pos && text.charCodeAt(end - 1) === 13) vEnd = end - 1; // CRLF
    const v = text.slice(pos, vEnd);
    if (v.indexOf('\r') === -1) {
      uVal = init === '' ? v : init + v;
      uAdded = v.length;
      if (kind === 0) { pos = end + 1; uEnded = 0; }
      else if (kind === 1) { pos = end + 1; line += 1; uEnded = 1; }
      else { pos = n; uEnded = 2; }
      return;
    }
    // Slow path: a stray CR sits inside the field.
    let val = init;
    let added = 0;
    let start = pos;
    for (;;) {
      const jC = text.indexOf(',', pos);
      const jN = text.indexOf('\n', pos);
      const jR = text.indexOf('\r', pos);
      let t = -1;
      let k = 0;
      if (jC !== -1) { t = jC; k = 0; }
      if (jN !== -1 && (t === -1 || jN < t)) { t = jN; k = 1; }
      if (jR !== -1 && (t === -1 || jR < t)) { t = jR; k = 2; }
      if (t === -1) {
        if (n > start) { val += text.slice(start, n); added += n - start; }
        pos = n;
        uVal = val; uEnded = 2; uAdded = added;
        return;
      }
      if (k === 0) {
        if (t > start) { val += text.slice(start, t); added += t - start; }
        pos = t + 1;
        uVal = val; uEnded = 0; uAdded = added;
        return;
      }
      if (k === 1) {
        if (t > start) { val += text.slice(start, t); added += t - start; }
        pos = t + 1;
        line += 1;
        uVal = val; uEnded = 1; uAdded = added;
        return;
      }
      if (t + 1 < n && text.charCodeAt(t + 1) === 10) {
        if (t > start) { val += text.slice(start, t); added += t - start; }
        pos = t + 2;
        line += 1;
        uVal = val; uEnded = 1; uAdded = added;
        return;
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      if (t > start) { val += text.slice(start, t); added += t - start; }
      pos = t + 1;
      start = pos;
    }
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = 0;
    let lastQuoted = false;
    do {
      if (text.charCodeAt(pos) === 34) {
        lastQuoted = true;
        const open = pos;
        const openLine = line;
        // Find the closing quote, collecting the "" escape segments before it.
        let p = pos + 1;
        let segStart = pos + 1;
        let esc = null;
        let q = -1;
        for (;;) {
          q = text.indexOf('"', p);
          if (q === -1) break;
          if (q + 1 < n && text.charCodeAt(q + 1) === 34) {
            if (esc === null) esc = [];
            esc.push(segStart, q);
            p = q + 2;
            segStart = q + 2;
            continue;
          }
          break;
        }
        if (q === -1) {
          // The quote never closes: it is a literal character, and the text after
          // it is read again as unquoted.
          pos = open + 1;
          line = openLine;
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          parseUnquoted('"');
          fields.push(uVal);
          ended = uEnded;
          continue;
        }
        // Build the value from [open + 1, q): "" is one quote, CRLF and lone CR are LF.
        // The line breaks inside are exactly the LFs of the built value.
        let value;
        if (esc === null) {
          const raw = text.slice(open + 1, q);
          value = raw.indexOf('\r') === -1 ? raw : raw.replace(/\r\n?/g, '\n');
        } else {
          let out = '';
          for (let i = 0; i < esc.length; i += 2) {
            const raw = text.slice(esc[i], esc[i + 1]);
            out += raw.indexOf('\r') === -1 ? raw : raw.replace(/\r\n?/g, '\n');
            out += '"';
          }
          const raw = text.slice(segStart, q);
          out += raw.indexOf('\r') === -1 ? raw : raw.replace(/\r\n?/g, '\n');
          value = out;
        }
        let cnt = 0;
        let iN = value.indexOf('\n');
        while (iN !== -1) { cnt += 1; iN = value.indexOf('\n', iN + 1); }
        line += cnt;
        // What follows the closing quote.
        if (q + 1 >= n) {
          pos = n;
          fields.push(value);
          ended = 2;
        } else {
          const c2 = text.charCodeAt(q + 1);
          if (c2 === 44) {
            pos = q + 2;
            fields.push(value);
            ended = 0;
          } else if (c2 === 10) {
            pos = q + 2;
            line += 1;
            fields.push(value);
            ended = 1;
          } else if (c2 === 13 && q + 2 < n && text.charCodeAt(q + 2) === 10) {
            pos = q + 3;
            line += 1;
            fields.push(value);
            ended = 1;
          } else {
            // What follows the closing quote is appended as it stands, up to the
            // next comma or line break.
            pos = q + 1;
            parseUnquoted(value);
            if (uAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
            fields.push(uVal);
            ended = uEnded;
          }
        }
      } else {
        lastQuoted = false;
        parseUnquoted('');
        fields.push(uVal);
        ended = uEnded;
      }
    } while (ended === 0);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

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
