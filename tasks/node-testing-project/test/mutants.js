// Grader file: versions of the invoice module with one planted bug each, made from the reference in reference-source.js by
// replacing `from` with `to`. Your invoice.test.js must fail on every one of them. Do not read on: spoilers.
// The code changes are stored base64-encoded so that reading this file does not hand you the answers.
const decode = (text) => Buffer.from(text, 'base64').toString('utf8');

export const mutants = [
  { name: "pad", says: "a version whose formatCents does not pad the cents (1205 gives 12.5)", from: decode('U3RyaW5nKE1hdGguYWJzKGNlbnRzKSkucGFkU3RhcnQoMywgJzAnKQ=='), to: decode('U3RyaW5nKE1hdGguYWJzKGNlbnRzKSk=') },
  { name: "negative", says: "a version whose formatCents loses the minus sign of amounts below one unit (-50 gives 0.50)", from: decode('YCR7Y2VudHMgPCAwID8gJy0nIDogJyd9'), to: decode('YCR7Y2VudHMgPD0gLTEwMCA/ICctJyA6ICcnfQ==') },
  { name: "no-discount", says: "a version whose lineTotal ignores discountPct", from: decode('TWF0aC5yb3VuZCgodW5pdENlbnRzICogcXR5ICogKDEwMCAtIGRpc2NvdW50UGN0KSkgLyAxMDAp'), to: decode('TWF0aC5yb3VuZCgodW5pdENlbnRzICogcXR5ICogKDEwMCAtIGRpc2NvdW50UGN0ICogMCkpIC8gMTAwKQ==') },
  { name: "floor-line", says: "a version whose lineTotal rounds down instead of to the nearest cent", from: decode('TWF0aC5yb3VuZCgodW5pdENlbnRzICogcXR5ICogKDEwMCAtIGRpc2NvdW50UGN0KSkgLyAxMDAp'), to: decode('TWF0aC5mbG9vcigodW5pdENlbnRzICogcXR5ICogKDEwMCAtIGRpc2NvdW50UGN0KSkgLyAxMDAp') },
  { name: "qty-zero", says: "a version that accepts a quantity of 0", from: decode('cXR5IDwgMSk='), to: decode('cXR5IDwgMCk=') },
  { name: "qty-fraction", says: "a version that accepts a quantity such as 1.5", from: decode('IU51bWJlci5pc0ludGVnZXIocXR5KSB8fCBxdHkgPCAx'), to: decode('dHlwZW9mIHF0eSAhPT0gIm51bWJlciIgfHwgcXR5IDwgMQ==') },
  { name: "no-lines", says: "a version that accepts an invoice with no lines", from: decode('aWYgKCFBcnJheS5pc0FycmF5KGxpbmVzKSB8fCBsaW5lcy5sZW5ndGggPT09IDApIHRocm93IG5ldyBJbnZvaWNlRXJyb3IoJ05PX0xJTkVTJywgYGludm9pY2UgJHtpZH0gaGFzIG5vIGxpbmVzYCk7'), to: decode('aWYgKCFBcnJheS5pc0FycmF5KGxpbmVzKSkgdGhyb3cgbmV3IEludm9pY2VFcnJvcignTk9fTElORVMnLCBgaW52b2ljZSAke2lkfSBoYXMgbm8gbGluZXNgKTs=') },
  { name: "no-duplicates", says: "a version that does not reject duplicate SKUs", from: decode('aWYgKHNrdXMubGVuZ3RoKSB0aHJvdw=='), to: decode('aWYgKHNrdXMubGVuZ3RoID4gOTkpIHRocm93') },
  { name: "duplicate-twice", says: "a version that lists a SKU that appears three times twice in details.skus", from: decode('cmV0dXJuIFsuLi5zZWVuXS5maWx0ZXIoKHNrdSkgPT4gcmVwZWF0ZWQuaGFzKHNrdSkpOw=='), to: decode('Y29uc3QgYWxsID0gW107IGNvbnN0IG9uY2UgPSBuZXcgU2V0KCk7IGZvciAoY29uc3QgeyBza3UgfSBvZiBsaW5lcykgeyBpZiAob25jZS5oYXMoc2t1KSkgYWxsLnB1c2goc2t1KTsgb25jZS5hZGQoc2t1KTsgfSByZXR1cm4gYWxsOw==') },
  { name: "tax-list-price", says: "a version that charges tax on the list price before discounts", from: decode('Y29uc3QgdGF4Q2VudHMgPSBNYXRoLnJvdW5kKHN1YnRvdGFsQ2VudHMgKiB0YXhSYXRlKTs='), to: decode('Y29uc3QgdGF4Q2VudHMgPSBNYXRoLnJvdW5kKGxpbmVzLnJlZHVjZSgoc3VtLCBsKSA9PiBzdW0gKyBsLnVuaXRDZW50cyAqIGwucXR5LCAwKSAqIHRheFJhdGUpOw==') },
  { name: "tax-floor", says: "a version that rounds the tax down instead of to the nearest cent", from: decode('Y29uc3QgdGF4Q2VudHMgPSBNYXRoLnJvdW5kKHN1YnRvdGFsQ2VudHMgKiB0YXhSYXRlKTs='), to: decode('Y29uc3QgdGF4Q2VudHMgPSBNYXRoLmZsb29yKHN1YnRvdGFsQ2VudHMgKiB0YXhSYXRlKTs=') },
];
