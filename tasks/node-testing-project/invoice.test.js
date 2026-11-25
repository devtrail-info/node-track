// Write your tests for invoice.js here, one or more for each case in README.md.
// Run them with: npm run task -- node-testing-project
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createInvoice, formatCents, lineTotal, findDuplicateSkus, InvoiceError } from './invoice.js';
