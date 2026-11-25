// Grader file: versions of reminders.js with one planted bug each, made by replacing `from` with `to`.
// The grader runs YOUR reminders.test.js against each one: a good test file fails on every one of them.
// The code changes are stored base64-encoded so that reading this file does not hand you the answers.
const decode = (text) => Buffer.from(text, 'base64').toString('utf8');

export const mutants = [
  { name: "paid", says: "a version that also emails invoices that are already paid", from: decode('aWYgKGludm9pY2UucGFpZCB8fCAhKGludm9pY2UuZHVlQXQgPCBub3cpKSBjb250aW51ZTs='), to: decode('aWYgKCEoaW52b2ljZS5kdWVBdCA8IG5vdykpIGNvbnRpbnVlOw==') },
  { name: "due-now", says: "a version that treats an invoice due exactly now as overdue", from: decode('aWYgKGludm9pY2UucGFpZCB8fCAhKGludm9pY2UuZHVlQXQgPCBub3cpKSBjb250aW51ZTs='), to: decode('aWYgKGludm9pY2UucGFpZCB8fCAhKGludm9pY2UuZHVlQXQgPD0gbm93KSkgY29udGludWU7') },
  { name: "subject", says: "a version that sends the wrong subject line", from: decode('Y29uc3Qgc3ViamVjdCA9IGBJbnZvaWNlICR7aW52b2ljZS5pZH0gaXMgb3ZlcmR1ZWA7'), to: decode('Y29uc3Qgc3ViamVjdCA9IGBJbnZvaWNlICR7aW52b2ljZS5pZH0gb3ZlcmR1ZWA7') },
  { name: "no-retry", says: "a version that never retries a failed send", from: decode('aWYgKGF0dGVtcHQgPj0gcmV0cmllcykgdGhyb3cgZXJyOw=='), to: decode('aWYgKGF0dGVtcHQgPj0gMCkgdGhyb3cgZXJyOw==') },
  { name: "extra-retry", says: "a version that makes one retry too many", from: decode('aWYgKGF0dGVtcHQgPj0gcmV0cmllcykgdGhyb3cgZXJyOw=='), to: decode('aWYgKGF0dGVtcHQgPiByZXRyaWVzKSB0aHJvdyBlcnI7') },
  { name: "no-wait", says: "a version that retries without waiting", from: decode('YXdhaXQgd2FpdChyYW5kb20oKSAqIGJhc2VNcyAqIDIgKiogYXR0ZW1wdCk7'), to: decode('YXdhaXQgd2FpdCgwKTs=') },
  { name: "no-growth", says: "a version whose wait does not double between retries", from: decode('YXdhaXQgd2FpdChyYW5kb20oKSAqIGJhc2VNcyAqIDIgKiogYXR0ZW1wdCk7'), to: decode('YXdhaXQgd2FpdChyYW5kb20oKSAqIGJhc2VNcyk7') },
  { name: "no-random", says: "a version that ignores random()", from: decode('YXdhaXQgd2FpdChyYW5kb20oKSAqIGJhc2VNcyAqIDIgKiogYXR0ZW1wdCk7'), to: decode('YXdhaXQgd2FpdChiYXNlTXMgKiAyICoqIGF0dGVtcHQpOw==') },
  { name: "no-log", says: "a version that does not log a failed invoice", from: decode('bG9nLmVycm9yKGByZW1pbmRlciBmYWlsZWQgZm9yICR7aW52b2ljZS5pZH06ICR7ZXJyLm1lc3NhZ2V9YCk7'), to: decode('') },
  { name: "stop-at-failure", says: "a version that skips the remaining invoices after one fails", from: decode('ZmFpbGVkLnB1c2goaW52b2ljZS5pZCk7'), to: decode('ZmFpbGVkLnB1c2goaW52b2ljZS5pZCk7IGxvZy5lcnJvcihgcmVtaW5kZXIgZmFpbGVkIGZvciAke2ludm9pY2UuaWR9OiAke2Vyci5tZXNzYWdlfWApOyBicmVhazs=') },
  { name: "run-at-once", says: "a version whose start() also runs once right away", from: decode('Y29uc3QgdGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7'), to: decode('cmVtaW5kT3ZlcmR1ZSgpLmNhdGNoKCgpID0+IHt9KTsKICAgIGNvbnN0IHRpbWVyID0gc2V0SW50ZXJ2YWwoKCkgPT4gew==') },
  { name: "no-stop", says: "a version whose stop() does not stop the timer", from: decode('cmV0dXJuICgpID0+IGNsZWFySW50ZXJ2YWwodGltZXIpOw=='), to: decode('cmV0dXJuICgpID0+IHt9Ow==') },
];
