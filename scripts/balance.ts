/**
 * The balance tool's runner: the real `Line` played by the careful hand at four reactions, for light, middle and heavy
 * fish and each gear, over fixed seeds, and the table held to the baseline both ways.
 *
 *   npm run balance                       held to scripts/balance-baseline.json
 *   npm run balance -- --update           the baseline written again, after a change meant to move it
 *   npm run balance -- --print            the table only, held to nothing
 *   npm run balance -- --fights N         N fights a cell (the baseline is for the default, so this prints only)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FIGHTS, compareTables, formatTable, playTable, type Table } from './balancing';

const BASELINE = 'scripts/balance-baseline.json';

function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf('--fights');
  const fights = at >= 0 ? Number(args[at + 1]) : FIGHTS;
  if (!Number.isInteger(fights) || fights < 1) {
    console.error('--fights wants a whole number of one or more');
    process.exitCode = 1;
    return;
  }
  const started = performance.now();
  const table = playTable(fights);
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(formatTable(table));
  console.log(`${Object.keys(table).length} cells of ${fights} fights (${seconds} s)`);
  if (args.includes('--print') || fights !== FIGHTS) return;

  if (args.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify({ fights, table }, null, 2)}\n`);
    console.log('balance baseline written');
    return;
  }
  let baseline: { fights: number; table: Table };
  try {
    baseline = JSON.parse(readFileSync(BASELINE, 'utf8')) as { fights: number; table: Table };
  } catch {
    console.error('no baseline: run npm run balance -- --update first');
    process.exitCode = 1;
    return;
  }
  const moved = compareTables(baseline.table, table);
  if (!moved.length) {
    console.log(`balance: ${Object.keys(table).length} cells, none moved`);
    return;
  }
  console.error(`\nbalance: ${moved.length} cell(s) moved:`);
  for (const line of moved) console.error(`  ${line}`);
  console.error('\nif that was meant, npm run balance -- --update through /gate-moved, and say why');
  process.exitCode = 1;
}

main();
