# Task: node-net-project

Build a TCP chat server with `node:net`: people connect with `nc`, pick a nickname and talk. It is small, but it
has every problem a real socket server has: framing, many clients at once, broadcasting, clients that vanish,
clients that never stop typing, clients that say nothing, and a clean shutdown.

```text
tasks/node-net-project/
  index.js               <- createChatServer (you write it)
  test/helpers.js        <- test clients (do not change)
  test/chat.test.js      <- the tests (do not change)
  test/lifecycle.test.js
```

## The protocol

Every message, in both directions, is one line of UTF-8 text ending with `\n`. A line from a client may end with
`\r\n`; the `\r` is not part of the message.

```text
$ nc localhost 4000
WELCOME send your nickname
asha
OK asha
* ravi joined
ravi: chai at 4?
/who
USERS asha, ravi
/quit
BYE
```

## What to do

Open `index.js` and write `createChatServer({ idleMs = 300000 } = {})`. It returns a `net.Server` that is **not
listening yet** (the tests call `listen(0)`), with one extra method, `stop()`.

1. **Welcome.** As soon as a client connects, send `WELCOME send your nickname`.
2. **Join.** The first lines from a client are nickname attempts:
   - a nickname is 1 to 20 characters from `A-Z`, `a-z`, `0-9`, `_` and `-`; anything else gets
     `ERR invalid nickname`
   - a nickname already used by a joined client, in any letter case, gets `ERR nickname taken`
   - otherwise send `OK <nick>` to the client and `* <nick> joined` to every **other** joined client.
   The client may try again after an error. Clients that have not joined receive no chat lines and no announcements.
3. **Chat.** After joining:
   - an empty line is ignored
   - `/who` gets `USERS <names>`: every joined nickname, sorted alphabetically ignoring case, joined with `', '`
     (`USERS asha, Ravi, zoe`)
   - `/quit` gets `BYE`, then the server ends the connection
   - any other line starting with `/` gets `ERR unknown command`
   - any other line goes to every **other** joined client as `<nick>: <text>`.
4. **Framing.** Bytes arrive in any chunks: several lines in one chunk, one line over many chunks, a character split
   between chunks. Lines must come out whole and correct.
5. **Limits.** A line longer than 1024 bytes (counted without the `\n`, even if its `\n` has not arrived yet) gets
   `ERR line too long`, and the server ends the connection. Nothing of that line is broadcast.
6. **Leaving.** However a joined client leaves (`/quit`, closing its side, a reset connection, a timeout), the others
   get `* <nick> left` **once**, and the nickname is free again. A client that never joined is not announced. A client
   error must never crash the server.
7. **Idle clients.** A connection with no activity (nothing sent or received) for `idleMs` gets `BYE idle`, and the
   server ends it.
8. **Stop.** `server.stop()` sends `BYE server shutting down` to every connected client, ends their connections,
   closes the server, and returns a promise that resolves when the server has closed.

When the server ends a connection, it sends the last line and a FIN (`socket.end(...)`), so the line is never lost.
If a client does not close its side within a second or so, destroy the socket.

## Rules

- Only `node:` built-ins.
- Keep partial lines as bytes and decode only whole lines.
- Clean up in `'close'`, which comes for every socket, not in `'end'`.

## Try it

```
node tasks/node-net-project/index.js
nc localhost 4000     # in two or three more terminals
```

## Check your work

```
npm run task -- node-net-project
```

When all tests pass, commit and push your branch `task/node-net-project`.
