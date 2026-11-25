// A CommonJS helper. Old code (legacy-report.cjs) and new code (index.js) both use it.
// Your job: move this code into the ES module text-utils.js, then make this file a bridge to it.
const path = require('node:path');

function slugify(title) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function outputPath(title) {
  return path.join(__dirname, 'pages', `${slugify(title)}.html`);
}

module.exports = { slugify, outputPath };
