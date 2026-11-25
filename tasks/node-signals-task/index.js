// Order meter: reads "<order id>,<amount>" lines from stdin and keeps a running total.
// Try it: printf 'A-1,12.50\nA-2,19.99\n' | node index.js
import readline from 'node:readline';

let count = 0;
let totalCents = 0;

function summary() {
  return `Processed ${count} orders, total ${(totalCents / 100).toFixed(2)} EUR`;
}

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
  if (line.trim() === '') return;
  const [id, amount] = line.split(',');
  count++;
  totalCents += Math.round(Number(amount) * 100);
  console.log(`order ${id}: ${Number(amount).toFixed(2)}`);
});

rl.on('close', () => {
  console.log(summary());
});
