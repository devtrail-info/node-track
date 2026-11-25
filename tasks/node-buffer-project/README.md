# Task: node-buffer-project

Build an **order record codec**: functions that turn an order into a small fixed binary layout and back. Services
use formats like this to send many records quickly between a shop's checkout and its warehouse, to store them in a
compact log file, or to put them on a message queue, where JSON would be bigger and slower to parse.

```text
tasks/node-buffer-project/
  index.js        <- encodeOrder, decodeOrder, encodeOrders, decodeOrders (you write them)
  index.test.js   <- the tests (do not change)
```

## The layout

All numbers are **unsigned and big-endian** (network byte order). Money is in **paise** (1 rupee = 100 paise), a
whole number, so it is exact.

| Bytes | Size | Field | Type |
|---|---|---|---|
| 0-3 | 4 | `id` | uint32 BE (0 to 4294967295) |
| 4-5 | 2 | `qty` | uint16 BE (0 to 65535) |
| 6-9 | 4 | `pricePaise` | uint32 BE (0 to 4294967295) |
| 10-11 | 2 | name length `n`, in **bytes** | uint16 BE (0 to 65535) |
| 12 to 12+n-1 | n | `name` | UTF-8 |

So a record is always `12 + n` bytes. For example
`{ id: 2041, qty: 3, pricePaise: 49900, name: 'Chai ₹' }` is 20 bytes:

```text
00 00 07 f9 | 00 03 | 00 00 c2 ec | 00 08 | 43 68 61 69 20 e2 82 b9
id 2041       qty 3   49900 paise   n = 8   'Chai ₹' (the ₹ is 3 bytes)
```

## What to do

Open `index.js`.

1. Export `encodeOrder(order)`. It returns a **Buffer** with the layout above.
   ```js
   encodeOrder({ id: 2041, qty: 3, pricePaise: 49900, name: 'Chai ₹' }).toString('hex');
   // '000007f900030000c2ec00084368616920e282b9'
   ```
   - If `id`, `qty` or `pricePaise` is not a whole number in its range (for example `-1`, `2.5`, `70000` for `qty`,
     `NaN` or the string `'7'`), throw a `RangeError`.
   - If `name` is not a string, throw a `TypeError`. If its UTF-8 form is longer than 65535 bytes, throw a
     `RangeError`.
2. Export `decodeOrder(bytes)`. It takes a `Buffer` **or a plain `Uint8Array`** holding exactly one record and
   returns `{ id, qty, pricePaise, name }`.
   ```js
   decodeOrder(encodeOrder({ id: 7, qty: 1, pricePaise: 2000, name: 'मसाला चाय' }));
   // { id: 7, qty: 1, pricePaise: 2000, name: 'मसाला चाय' }
   ```
   - Anything that is not a `Uint8Array` (a string, an array, `null`) throws a `TypeError`.
   - Malformed input throws an `Error` whose `code` property is `'ERR_BAD_RECORD'`: fewer than 12 bytes, a name
     length that goes past the end, extra bytes after the record, or a name that is not valid UTF-8.
3. Export `encodeOrders(orders)`: the records of all orders, one after the other, in one Buffer.
   `encodeOrders([])` is an empty Buffer.
4. Export `decodeOrders(bytes)`: the opposite, an array of orders. The records are self-delimiting (the name length
   says where each one ends). An empty input gives `[]`; a record cut off at the end throws the same
   `ERR_BAD_RECORD` error.
5. When the file is run directly (`node tasks/node-buffer-project/index.js`), print the hex of
   `encodeOrder({ id: 2041, qty: 3, pricePaise: 49900, name: 'Chai ₹' })` on the first line and the decoded order as
   JSON on the second:
   ```text
   000007f900030000c2ec00084368616920e282b9
   {"id":2041,"qty":3,"pricePaise":49900,"name":"Chai ₹"}
   ```

## Rules

- Only `node:` built-ins. No npm packages.
- Use Buffer's read and write methods (or a `DataView`), not string tricks, for the numbers.
- Do not trust the input in `decodeOrder`: check every length before you read.
- A plain `Uint8Array` can be a view into a bigger `ArrayBuffer` (its `byteOffset` is not always 0).

## Check your work

```
npm run task -- node-buffer-project
```

When all tests pass, commit and push your branch `task/node-buffer-project`.
