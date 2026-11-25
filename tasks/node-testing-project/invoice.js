// The invoice module. It has three bugs and one slow function. README.md lists the rules it must follow.

export class InvoiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'InvoiceError';
    this.code = code;
    this.details = details;
  }
}

/** 1205 -> '12.05', -50 -> '-0.50', 0 -> '0.00' */
export function formatCents(cents) {
  const whole = Math.trunc(cents / 100);
  const rest = cents % 100;
  return whole + '.' + rest;
}

/** unitCents * qty, minus discountPct percent, rounded to a whole cent. */
export function lineTotal({ unitCents, qty, discountPct = 0 }) {
  return Math.round((unitCents * qty * (100 - discountPct)) / 100);
}

/** The SKUs that appear more than once, each listed once, in the order they first appear. */
export function findDuplicateSkus(lines) {
  const duplicates = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[i].sku === lines[j].sku && !duplicates.includes(lines[i].sku)) {
        duplicates.push(lines[i].sku);
      }
    }
  }
  return duplicates;
}

function checkLine(line) {
  const { sku, unitCents, qty, discountPct = 0 } = line;
  if (!Number.isInteger(qty) || qty < 0) {
    throw new InvoiceError('INVALID_LINE', `line ${sku}: qty must be a whole number from 1 up`);
  }
  if (!Number.isInteger(unitCents) || unitCents < 0) {
    throw new InvoiceError('INVALID_LINE', `line ${sku}: unitCents must be a whole number from 0 up`);
  }
  if (typeof discountPct !== 'number' || discountPct < 0 || discountPct > 100) {
    throw new InvoiceError('INVALID_LINE', `line ${sku}: discountPct must be from 0 to 100`);
  }
}

/** Builds an invoice from its lines. Throws InvoiceError for bad input. */
export function createInvoice({ id, lines, taxRate }) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new InvoiceError('NO_LINES', `invoice ${id} has no lines`);
  }
  lines.forEach(checkLine);
  const duplicates = findDuplicateSkus(lines);
  if (duplicates.length > 0) {
    throw new InvoiceError('DUPLICATE_SKU', `invoice ${id}: duplicate SKUs ${duplicates.join(', ')}`, { skus: duplicates });
  }

  const outLines = lines.map((line) => ({ sku: line.sku, qty: line.qty, totalCents: lineTotal(line) }));
  const subtotalCents = outLines.reduce((sum, line) => sum + line.totalCents, 0);
  const listPrice = lines.reduce((sum, line) => sum + line.unitCents * line.qty, 0);
  const taxCents = Math.round(listPrice * taxRate);
  return { id, lines: outLines, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}
