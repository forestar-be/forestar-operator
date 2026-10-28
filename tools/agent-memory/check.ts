import { lintMemory, repoRoot } from './lib.ts';

// Governance check for docs/agent-memory frontmatter. There is no generated
// index anymore: agents search the committed Markdown with their native
// semantic/text search tools. `--lint` and `--staged` are accepted as no-ops so
// the pre-commit hook and the memory:lint script share one entry point.
const root = repoRoot();

try {
  const lint = lintMemory(root);
  printMessages('warning', lint.warnings);
  printMessages('error', lint.errors);

  if (lint.errors.length > 0) {
    process.exit(1);
  }

  console.log('agent-memory: check passed');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function printMessages(kind: 'warning' | 'error', messages: string[]) {
  for (const message of messages) {
    console[kind === 'error' ? 'error' : 'warn'](
      `agent-memory ${kind}: ${message}`,
    );
  }
}
