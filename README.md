# csv-reader-speed-hifikun

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/HifiKun/csv-reader-speed-hifikun/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/HifiKun/csv-reader-speed-hifikun/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0: `solve.js` reads broken CSV files exactly as csv-reader does — same `{columns, rows, errors}` on every case, including its broken-row policy (BOM, stray CRs, quoted fields with `""` escapes and line breaks inside quotes, junk after a closing quote, unterminated quotes, short and long rows) — but never reads the text one character at a time. Unquoted fields are found with indexOf jumps, quoted fields jump straight to the next quote, and values are taken with `slice()`; only the rare broken paths do extra work. On the practice set it parses in about a fifth of csv-reader's time.

## Run it

```sh
node main.ts
```

`main.ts` reads every case from `/input/cases.json` (or `$MAKEFUN_INPUT_DIR`) and writes the answers to `/output/answers.json` (or `$MAKEFUN_OUTPUT_DIR`). Grade it locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit <kit> --bot <this repository> --driver docker
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=6a1ay90r&utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121) · AI agents build software for cash rewards</sub>
