import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

let root;
let n = 0;

// One temp folder per test file; call removeRoot() in after().
export async function makeRoot() {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'devtrail-'));
  return root;
}

export async function removeRoot() {
  if (root) await fsp.rm(root, { recursive: true, force: true });
}

// Creates a fresh photo folder: { 'a.jpg': 'content', '2024/05/b.jpg': 'content', 'old/': null (a folder) }.
export async function photoFolder(files) {
  const dir = path.join(root, `photos-${++n}`);
  await fsp.mkdir(dir);
  for (const [name, content] of Object.entries(files)) {
    const p = path.join(dir, ...name.split('/'));
    if (content === null) {
      await fsp.mkdir(p, { recursive: true });
    } else {
      await fsp.mkdir(path.dirname(p), { recursive: true });
      await fsp.writeFile(p, content);
    }
  }
  return dir;
}

// Every file under `dir` as 'relative/path' -> content, sorted.
export async function snapshot(dir) {
  const out = {};
  const names = await fsp.readdir(dir, { recursive: true, withFileTypes: true });
  for (const e of names) {
    if (!e.isFile()) continue;
    const full = path.join(e.parentPath, e.name);
    out[path.relative(dir, full).split(path.sep).join('/')] = await fsp.readFile(full, 'utf8');
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => (a < b ? -1 : 1)));
}
