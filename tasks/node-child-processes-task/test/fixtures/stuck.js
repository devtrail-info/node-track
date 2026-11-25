// A script that never ends by itself.
//   node stuck.js <pid-file> [stubborn] [flood-bytes]
// Writes its pid to <pid-file>, prints "working", and then waits forever. With "stubborn" it ignores SIGTERM.
// With flood-bytes it first writes that many bytes to stdout.
import { writeFileSync } from 'node:fs';

const [pidFile, mode, flood] = process.argv.slice(2);
writeFileSync(pidFile, String(process.pid));
if (mode === 'stubborn') process.on('SIGTERM', () => console.log('ignoring SIGTERM'));
if (flood) process.stdout.write('x'.repeat(Number(flood)));
console.log('working');
setInterval(() => {}, 1000);
