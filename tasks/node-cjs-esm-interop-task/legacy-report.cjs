// Old CommonJS code. Do not change this file: it must keep working.
const path = require('node:path');
const { slugify, outputPath } = require('./text-utils.cjs');

const title = 'Summer Sale 2026!';
console.log(slugify(title));
console.log(path.relative(__dirname, outputPath(title)).split(path.sep).join('/'));
