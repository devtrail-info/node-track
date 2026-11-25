import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateFromName } from '../index.js';

test('dateFromName reads YYYYMMDD from phone photo names', () => {
  assert.deepEqual(dateFromName('IMG_20240517_101500.jpg'), { year: '2024', month: '05' });
  assert.deepEqual(dateFromName('PXL_20231231_235959123.jpg'), { year: '2023', month: '12' });
  assert.deepEqual(dateFromName('19991105.png'), { year: '1999', month: '11' });
});

test('dateFromName reads YYYY-MM-DD from screenshot names', () => {
  assert.deepEqual(dateFromName('Screenshot 2024-05-02 at 09.12.00.png'), { year: '2024', month: '05' });
  assert.deepEqual(dateFromName('scan-2021-01-09.pdf'), { year: '2021', month: '01' });
});

test('dateFromName returns null when there is no date', () => {
  assert.equal(dateFromName('notes.txt'), null);
  assert.equal(dateFromName('holiday.jpg'), null);
  assert.equal(dateFromName('IMG_2024.jpg'), null);
});

test('dateFromName ignores digits that are part of a longer number', () => {
  assert.equal(dateFromName('IMG_123420240517.jpg'), null);
  assert.equal(dateFromName('order-202405170.pdf'), null);
});

test('dateFromName only accepts real calendar dates from 1900 to 2099', () => {
  assert.equal(dateFromName('2024-13-01 party.jpg'), null);
  assert.equal(dateFromName('IMG_20240230_120000.jpg'), null);
  assert.equal(dateFromName('IMG_20240001_120000.jpg'), null);
  assert.equal(dateFromName('IMG_20240500_120000.jpg'), null);
  assert.equal(dateFromName('20230229.jpg'), null);
  assert.deepEqual(dateFromName('20240229.jpg'), { year: '2024', month: '02' });
  assert.equal(dateFromName('IMG_18991231.jpg'), null);
  assert.equal(dateFromName('IMG_21000101.jpg'), null);
});

test('dateFromName uses the first real date in the name', () => {
  assert.deepEqual(dateFromName('copy 20241399 of 20240601.jpg'), { year: '2024', month: '06' });
  assert.deepEqual(dateFromName('2023-02-01 edit 2024-03-01.jpg'), { year: '2023', month: '02' });
});
