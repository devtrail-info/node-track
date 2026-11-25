// DevTrail pre-push check: runs the tests of the task you are pushing.
// Works with Node 22+ on macOS, Linux and Git Bash on Windows.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ZERO = /^0+$/;
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const STOP_MESSAGE = 'Push stopped: fix the failing tests, or push anyway with `git push --no-verify`.';

function defaultBranchBase(localSha, git) {
  for (const ref of ['origin/HEAD', 'origin/main', 'origin/master']) {
    try {
      const base = git(['merge-base', localSha, ref]).trim();
      if (base) return base;
    } catch {
      // try the next candidate
    }
  }
  return EMPTY_TREE;
}

/**
 * Task ids to test for a push. `refLines` are the lines git gives a pre-push hook:
 * "<local ref> <local sha> <remote ref> <remote sha>".
 */
export function tasksToTest(refLines, git) {
  const ids = new Set();
  for (const line of refLines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const [, localSha, remoteRef, remoteSha] = parts;
    if (ZERO.test(localSha)) continue; // deleting a branch: nothing to test

    const named = /^refs\/heads\/task\/(.+)$/.exec(remoteRef);
    if (named) ids.add(named[1]);

    const from = ZERO.test(remoteSha) ? defaultBranchBase(localSha, git) : remoteSha;
    let changed = '';
    try {
      changed = git(['diff', '--name-only', '-z', '--diff-filter=d', from, localSha]);
    } catch {
      changed = '';
    }
    for (const file of changed.split('\0')) {
      const m = /^tasks\/([^/]+)\//.exec(file.trim());
      if (m) ids.add(m[1]);
    }
  }
  return [...ids];
}

/** The command that pulls new tasks from the track's template repo (owner and track filled in on the task page). */
export const PULL_HINT = 'git pull --no-rebase --no-edit --allow-unrelated-histories -X theirs https://github.com/<owner>/<track> main';
export const MISSING_TASK_MESSAGE = (id) =>
  `This task isn't in your repo yet (no tasks/${id} folder). Get new tasks first: ${PULL_HINT} (see the task page for the exact command).`;

async function main() {
  const git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  let input = '';
  try {
    input = readFileSync(0, 'utf8');
  } catch {
    // On purpose: if we cannot read the hook input, let the push through.
    // A broken hook must never block a push.
    input = '';
  }
  const ids = tasksToTest(input.split('\n').filter(Boolean), git);
  if (ids.length === 0) return 0;

  const missing = ids.filter((id) => !existsSync(`tasks/${id}`));
  if (missing.length > 0) {
    for (const id of missing) console.error(MISSING_TASK_MESSAGE(id));
    console.error('Push stopped. You can still push with `git push --no-verify`.');
    return 1;
  }

  let runTaskTests;
  try {
    ({ runTaskTests } = await import(new URL('../scripts/test-task.mjs', import.meta.url).href));
  } catch {
    console.log('scripts/test-task.mjs is missing, so the tests were not run.');
    return 0;
  }

  const failed = [];
  for (const id of ids) {
    if (runTaskTests(id) === 0) console.log(`✔ ${id}`);
    else {
      console.log(`✖ ${id} (tests failed)`);
      failed.push(id);
    }
  }
  if (failed.length > 0) {
    console.error(STOP_MESSAGE);
    return 1;
  }
  return 0;
}

if (process.argv[1] && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])) {
  main().then((code) => process.exit(code));
}
