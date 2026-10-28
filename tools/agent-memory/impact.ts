import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  changedFiles,
  formatImpact,
  memoryImpact,
  repoRoot,
  type ChangeSet,
} from './lib.ts';

// Which docs/agent-memory files cover the files a change touches, and were
// they updated? Non-blocking by default (it only reports).
//
//   node tools/agent-memory/impact.ts [--worktree | --staged | --branch [--base <ref>]]
//     --worktree  staged + unstaged + untracked vs HEAD (default)
//     --staged    what the pre-commit hook is about to commit
//     --branch    HEAD vs the merge base with --base (default: origin/HEAD)
//     --strict    exit 1 when a covering memory file was not updated
//     --stop-hook agent Stop hook: reads the hook JSON on stdin and exits 2
//                 with a reason, once per set of stale files per session and
//                 per repository, so the agent updates the memory first.
const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const set: ChangeSet = args.includes('--staged')
  ? 'staged'
  : args.includes('--branch')
    ? 'branch'
    : 'worktree';

try {
  const root = repoRoot();
  const report = memoryImpact(root, changedFiles(root, set, option('--base')));

  if (args.includes('--stop-hook')) {
    stopHook(
      root,
      formatImpact(report),
      report.stale.map((item) => item.file),
    );
  } else {
    const text = formatImpact(report);
    if (text) {
      console.log(text);
    }
    if (args.includes('--strict') && report.stale.length > 0) {
      process.exit(1);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(args.includes('--stop-hook') ? 0 : 1);
}

// Reads the hook's JSON from stdin. An interactive terminal would make
// readFileSync(0) wait for EOF, so it counts as "no payload", like unusable or
// malformed input.
function hookPayload(): { session_id?: string; stop_hook_active?: boolean } {
  try {
    if (process.stdin.isTTY) {
      return {};
    }
    const parsed: unknown = JSON.parse(readFileSync(0, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// Blocks the agent's stop once per (repository, session, set of stale files):
// the agent either updates the files or says why they still hold; the same set
// never blocks twice, so a considered "nothing to update" is not nagged again.
function stopHook(root: string, text: string, stale: string[]) {
  const input = hookPayload();
  if (input.stop_hook_active || stale.length === 0) {
    return;
  }

  const signature = stale.join('|');
  const session = (input.session_id ?? 'default').replace(/[^\w-]/g, '');
  // The marker lives in a shared temp dir, so it carries the repository it
  // belongs to: two worktrees (or two repositories) sharing a session id must
  // not acknowledge each other's stale files.
  const scope = createHash('sha256').update(root).digest('hex').slice(0, 12);
  const acknowledged = path.join(
    os.tmpdir(),
    `agent-memory-stop-${scope}-${session}`,
  );
  if (
    existsSync(acknowledged) &&
    readFileSync(acknowledged, 'utf8') === signature
  ) {
    return;
  }
  writeFileSync(acknowledged, signature);

  console.error(
    `${text}\nBefore you stop: update those memory files, or state in one line why each still holds. Also record any durable rule, decision, pitfall or command you learned this session (docs/agent-memory/runbooks/agent-memory.md).`,
  );
  process.exit(2);
}
