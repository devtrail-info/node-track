// The invoice reminder service. It works: do not change this file.
// Your job is to write the tests for it in reminders.test.js.

/**
 * createReminderService({ store, mailer, log, retries, baseMs, random })
 *
 *   store.list()                    -> array of invoices { id, email, dueAt (ms timestamp), paid }
 *   mailer.send(to, subject)        -> promise; rejects when the mail server fails
 *   log.error(line)                 -> called once for each invoice that could not be sent
 *   retries = 2                     -> extra attempts after the first failed send
 *   baseMs = 1000                   -> wait before retry n (1, 2, ...) is random() * baseMs * 2 ** (n - 1)
 *   random = Math.random            -> pass () => 1 in tests for exact waits
 *
 * Returns { remindOverdue, start }:
 *   remindOverdue() -> promise of { sent: [ids], failed: [ids] }, both in store order.
 *     An invoice is overdue when it is not paid and dueAt < Date.now().
 *     Subject: 'Invoice <id> is overdue'. Invoices are handled one after the other.
 *   start(intervalMs = 60000) -> runs remindOverdue() every intervalMs (the first run after intervalMs),
 *     and returns stop(), which cancels the timer.
 */
export function createReminderService({ store, mailer, log = console, retries = 2, baseMs = 1000, random = Math.random }) {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function sendWithRetry(invoice) {
    const subject = `Invoice ${invoice.id} is overdue`;
    for (let attempt = 0; ; attempt++) {
      try {
        await mailer.send(invoice.email, subject);
        return;
      } catch (err) {
        if (attempt >= retries) throw err;
        await wait(random() * baseMs * 2 ** attempt);
      }
    }
  }

  async function remindOverdue() {
    const now = Date.now();
    const sent = [];
    const failed = [];
    for (const invoice of store.list()) {
      if (invoice.paid || !(invoice.dueAt < now)) continue;
      try {
        await sendWithRetry(invoice);
        sent.push(invoice.id);
      } catch (err) {
        failed.push(invoice.id);
        log.error(`reminder failed for ${invoice.id}: ${err.message}`);
      }
    }
    return { sent, failed };
  }

  function start(intervalMs = 60_000) {
    const timer = setInterval(() => {
      remindOverdue().catch((err) => log.error(`reminder run failed: ${err.message}`));
    }, intervalMs);
    return () => clearInterval(timer);
  }

  return { remindOverdue, start };
}
