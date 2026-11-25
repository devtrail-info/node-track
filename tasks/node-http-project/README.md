# Task: node-http-project

Build a **Bookmarks JSON API** on the raw `node:http` module: no framework. Save links with a title and tags, list
them, read one and delete one, with the status codes, headers and validation a real API needs. The data lives in a
JSON file, so it survives a restart.

```text
tasks/node-http-project/
  index.js     <- createBookmarksServer and a small CLI (you write them)
  test/        <- the tests (do not change)
```

## The API

| Request | Success | Errors |
|---|---|---|
| `GET /bookmarks` | `200`, an array of all bookmarks, oldest first. `?tag=node` keeps only bookmarks with that tag. | |
| `POST /bookmarks` | `201`, the new bookmark, and `Location: /bookmarks/<id>` | `415`, `413`, `400`, `422`, `409` |
| `GET /bookmarks/:id` | `200`, the bookmark | `404` |
| `DELETE /bookmarks/:id` | `204`, no body | `404` |

A bookmark looks like this:

```json
{ "id": 1, "url": "https://nodejs.org/docs", "title": "Node docs", "tags": ["node", "docs"], "createdAt": "2026-11-25T10:00:00.000Z" }
```

## What to do

Open `index.js` and export `createBookmarksServer({ file, limit = 10_000 })`. It returns an `http.Server` that is not
listening yet (the tests call `listen(0)`). `file` is the path of the JSON data file; `limit` is the maximum body size
in bytes.

1. **Routing.** Match `pathname` (use `new URL(req.url, 'http://localhost')`), never the raw `req.url`.
   - `HEAD` works wherever `GET` does.
   - A known path with another method: `405` with `Allow: GET, HEAD, POST` (for `/bookmarks`) or
     `Allow: GET, HEAD, DELETE` (for `/bookmarks/:id`).
   - An `:id` that is not a whole number from 1 up (`abc`, `0`, `07`, `1.5`), or that does not exist: `404`.
   - Any other path: `404`.
2. **Reading the body of `POST`.**
   - Not `application/json` (parameters and any case are fine): `415`.
   - Bigger than `limit` bytes, by `Content-Length` or while counting: `413` with `Connection: close`.
   - Empty or not valid JSON: `400`.
3. **Validation** (`422` when it fails):
   - The body is a JSON object.
   - `url` is a string that `new URL()` accepts, with the protocol `http:` or `https:`.
   - `title` is a string; after `trim()` it has 1 to 200 characters. Store the trimmed title.
   - `tags` is optional (default `[]`): an array of at most 10 strings, each non-empty (after trimming) and at most
     30 characters.
   - Other fields are ignored and not stored.
   - A bookmark with exactly the same `url` already exists: `409`.
4. **The new bookmark** gets the next `id` (1, 2, 3, ...; an id is **never reused**, even after a delete) and
   `createdAt` (`new Date().toISOString()`).
5. **Answers.** Every answer with a body is JSON with `Content-Type: application/json; charset=utf-8`. Every error is
   `{ "error": "<a message>" }`. An unexpected error in your code answers `500` and the server keeps running.
6. **Storage.** The file holds `{ "nextId": <number>, "bookmarks": [ ... ] }`.
   - A missing file means "no bookmarks yet". Do not create the file before the first change.
   - Save after every change, **atomically**: write a temporary file in the same folder, then `rename` it (from
     `node:fs/promises`) over the data file, as in the files module. Never leave a half-written data file, and
     remove the temporary file if something fails.
   - Changes must not get lost when many requests arrive at once: twenty `POST`s at the same time give twenty
     bookmarks, all saved.
   - A data file that is not valid JSON is a server problem: answer `500`, and **never overwrite** that file.
   - Data written by one server is there for the next server that uses the same file.
7. **The CLI.** `node tasks/node-http-project/index.js` starts the server on `PORT` (default `3000`) with the data
   file `BOOKMARKS_FILE` (default `bookmarks.json` in the current folder).

## Rules

- Only `node:` built-ins. No npm packages, no frameworks.
- No `*Sync` file functions in request handling.

## Try it

```
node tasks/node-http-project/index.js
curl -i -X POST localhost:3000/bookmarks -H 'Content-Type: application/json' \
  -d '{"url":"https://nodejs.org/docs","title":"Node docs","tags":["node"]}'
curl -i 'localhost:3000/bookmarks?tag=node'
curl -i -X DELETE localhost:3000/bookmarks/1
```

## Check your work

```
npm run task -- node-http-project
```

When all tests pass, commit and push your branch `task/node-http-project`.
