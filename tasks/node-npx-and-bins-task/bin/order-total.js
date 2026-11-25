import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { summarize } from '../lib/summary.js';

const USAGE = 'Usage: order-total <orders.json>';

// Runs the command with the arguments after the script name. Returns the exit code.
export function main(args) {
  if (args.includes('--help')) {
    console.log(USAGE);
    return 0;
  }
  // TODO (requirement 4): --version prints the version from package.json.
  const file = args.find((arg) => !arg.startsWith('--'));
  if (!file) {
    console.error(USAGE);
    return 1;
  }
  const orders = JSON.parse(readFileSync(file, 'utf8'));
  console.log(summarize(orders));
  return 0;
}

// Start only when this file is the program that was run (not when another file imports it).
// TODO (requirement 3): this check works for `node bin/order-total.js`, but not for every way a bin is started.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
