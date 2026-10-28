import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const SCHEMA_VERSION = 'frontmatter-v1';

type FrontmatterValue = string | number | string[] | undefined;

export type MemoryMetadata = {
  id: string;
  scope: string;
  paths: string[];
  tags: string[];
  owners: string[];
  last_reviewed: string;
  review_after_days: number;
  confidence: 'verified' | 'draft' | 'deprecated';
};

export function repoRoot(cwd = process.cwd()): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return cwd;
  }
}

export function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep).replace(/^\.\//, '');
}

export function readText(root: string, relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

export function listFiles(
  root: string,
  start: string,
  predicate: (file: string) => boolean,
): string[] {
  const absoluteStart = path.join(root, start);
  if (!existsSync(absoluteStart)) {
    return [];
  }

  const output: string[] = [];
  const walk = (absoluteDir: string) => {
    for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
      const absoluteEntry = path.join(absoluteDir, entry.name);
      const relativeEntry = normalizePath(path.relative(root, absoluteEntry));

      if (entry.isDirectory()) {
        if (!['.git', 'node_modules'].includes(relativeEntry)) {
          walk(absoluteEntry);
        }
        continue;
      }

      if (entry.isFile() && predicate(relativeEntry)) {
        output.push(relativeEntry);
      }
    }
  };

  walk(absoluteStart);
  return output.sort();
}

export function parseFrontmatter(content: string): {
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
} {
  const lines = content.split(/\r?\n/);
  if (lines[0] !== '---') {
    return { frontmatter: {}, body: content };
  }

  const end = lines.findIndex((line, index) => index > 0 && line === '---');
  if (end === -1) {
    return { frontmatter: {}, body: content };
  }

  const frontmatter: Record<string, FrontmatterValue> = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) {
      frontmatter[match[1]] = parseFrontmatterValue(match[2].trim());
    }
  }

  return { frontmatter, body: lines.slice(end + 1).join('\n') };
}

function parseFrontmatterValue(raw: string): FrontmatterValue {
  if (raw.startsWith('[') && raw.endsWith(']')) {
    const inner = raw.slice(1, -1).trim();
    return inner
      ? inner
          .split(',')
          .map((value) => stripQuotes(value.trim()))
          .filter(Boolean)
      : [];
  }
  return /^-?\d+$/.test(raw) ? Number(raw) : stripQuotes(raw);
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, '');
}

function fallbackId(relativePath: string): string {
  return normalizePath(relativePath)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function normalizeMetadata(
  relativePath: string,
  frontmatter: Record<string, FrontmatterValue>,
): MemoryMetadata {
  const isMemoryDoc = relativePath.startsWith('docs/agent-memory/');
  const arrayValue = (key: string, fallback: string[]) => {
    const value = frontmatter[key];
    return Array.isArray(value) ? value.map(String) : fallback;
  };
  const confidence =
    frontmatter.confidence === 'draft' ||
    frontmatter.confidence === 'deprecated'
      ? frontmatter.confidence
      : 'verified';

  return {
    id:
      typeof frontmatter.id === 'string'
        ? frontmatter.id
        : fallbackId(relativePath),
    scope:
      typeof frontmatter.scope === 'string'
        ? frontmatter.scope
        : isMemoryDoc
          ? 'memory'
          : 'instruction',
    paths: arrayValue('paths', ['**']),
    tags: arrayValue('tags', isMemoryDoc ? ['agent-memory'] : ['instruction']),
    owners: arrayValue('owners', []),
    last_reviewed:
      typeof frontmatter.last_reviewed === 'string'
        ? frontmatter.last_reviewed
        : '1970-01-01',
    review_after_days:
      typeof frontmatter.review_after_days === 'number'
        ? frontmatter.review_after_days
        : 1,
    confidence,
  };
}

export function isExpired(metadata: MemoryMetadata, now = new Date()): boolean {
  if (metadata.confidence !== 'verified' || metadata.scope === 'instruction') {
    return false;
  }
  const reviewed = Date.parse(`${metadata.last_reviewed}T00:00:00Z`);
  return (
    Number.isNaN(reviewed) ||
    reviewed + metadata.review_after_days * 24 * 60 * 60 * 1000 < now.getTime()
  );
}

export function lintMemory(root: string): {
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Map<string, string>();
  const entries: MemoryEntry[] = [];
  const docs = listFiles(root, MEMORY_DIR, (candidate) =>
    candidate.endsWith('.md'),
  );

  if (docs.length === 0) {
    errors.push('docs/agent-memory must contain at least one Markdown file.');
  }

  for (const relativePath of docs) {
    const parsed = parseFrontmatter(readText(root, relativePath));
    const frontmatter = parsed.frontmatter;
    if (Object.keys(frontmatter).length === 0) {
      errors.push(`${relativePath}: missing frontmatter.`);
      continue;
    }
    entries.push({ relativePath, frontmatter, body: parsed.body });
    for (const key of [
      'id',
      'scope',
      'paths',
      'tags',
      'last_reviewed',
      'review_after_days',
      'confidence',
    ]) {
      if (frontmatter[key] === undefined) {
        errors.push(`${relativePath}: missing frontmatter field "${key}".`);
      }
    }
    if (typeof frontmatter.id === 'string') {
      if (!/^[a-z0-9][a-z0-9-]*$/.test(frontmatter.id)) {
        errors.push(`${relativePath}: id must match ^[a-z0-9][a-z0-9-]*$.`);
      }
      const previous = ids.get(frontmatter.id);
      if (previous) {
        errors.push(
          `${relativePath}: duplicate id "${frontmatter.id}" already used by ${previous}.`,
        );
      }
      ids.set(frontmatter.id, relativePath);
    }
    if (!Array.isArray(frontmatter.paths) || frontmatter.paths.length === 0) {
      errors.push(`${relativePath}: paths must be a non-empty array.`);
    }
    if (!Array.isArray(frontmatter.tags)) {
      errors.push(`${relativePath}: tags must be an array.`);
    }
    if (
      typeof frontmatter.last_reviewed !== 'string' ||
      Number.isNaN(Date.parse(`${frontmatter.last_reviewed}T00:00:00Z`))
    ) {
      errors.push(`${relativePath}: last_reviewed must be an ISO date.`);
    }
    if (
      typeof frontmatter.review_after_days !== 'number' ||
      frontmatter.review_after_days < 1
    ) {
      errors.push(
        `${relativePath}: review_after_days must be a positive integer.`,
      );
    }
    if (
      !['verified', 'draft', 'deprecated'].includes(
        String(frontmatter.confidence),
      )
    ) {
      errors.push(
        `${relativePath}: confidence must be verified, draft, or deprecated.`,
      );
    }
    const metadata = normalizeMetadata(relativePath, frontmatter);
    if (isExpired(metadata)) {
      warnings.push(
        `${relativePath}: verified memory is past review_after_days and should be re-reviewed before it is trusted as firm guidance.`,
      );
    }
  }

  lintWiki(root, entries, errors, warnings);

  return { errors, warnings };
}

const MEMORY_DIR = 'docs/agent-memory';

type MemoryEntry = {
  relativePath: string;
  frontmatter: Record<string, FrontmatterValue>;
  body: string;
};

const MARKDOWN_LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

// A glob covering the whole repository or a whole top-level directory (`**`,
// `src/**`) marks an overview file: it never triggers an impact report and is
// never reported as dead. Give a memory file narrower globs to have changes to
// those files point back at it.
export function isBroadGlob(glob: string): boolean {
  return glob === '**' || glob === '**/*' || /^[^/*]+\/\*\*$/.test(glob);
}

export function globToRegExp(glob: string): RegExp {
  let source = '';
  for (let index = 0; index < glob.length; index += 1) {
    const char = glob[index];
    if (char === '*') {
      if (glob[index + 1] !== '*') {
        source += '[^/]*';
      } else if (glob[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`);
}

function gitList(root: string, args: string[]): string[] {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .split('\0')
    .filter(Boolean)
    .map(normalizePath);
}

function mentions(text: string, relativePath: string): boolean {
  const escaped = relativePath.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\w/.-])${escaped}`).test(text);
}

// Wiki lint, the mechanical half: the README is the catalogue agents read
// first, so every memory file must be listed there; links must resolve; a
// `paths` glob that matches nothing means the file it tracks was renamed or
// deleted and the entry is probably stale. Contradictions and gaps need a
// reader — that half is in runbooks/agent-memory.md.
function lintWiki(
  root: string,
  entries: MemoryEntry[],
  errors: string[],
  warnings: string[],
) {
  const readme = entries.find(
    (entry) => entry.relativePath === `${MEMORY_DIR}/README.md`,
  );
  const tracked = trackedFiles(root);

  for (const entry of entries) {
    for (const target of brokenLinks(root, entry)) {
      errors.push(`${entry.relativePath}: broken link "${target}".`);
    }
    const inner = entry.relativePath.slice(MEMORY_DIR.length + 1);
    if (readme && entry !== readme && !mentions(readme.body, inner)) {
      errors.push(
        `${entry.relativePath}: not listed in ${MEMORY_DIR}/README.md — add a one-line entry to the catalogue.`,
      );
    }
    for (const glob of tracked ? deadGlobs(entry, tracked) : []) {
      warnings.push(
        `${entry.relativePath}: paths glob "${glob}" matches no file — renamed or deleted? Update the entry.`,
      );
    }
  }
}

function trackedFiles(root: string): string[] | undefined {
  try {
    return gitList(root, [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
    ]);
  } catch {
    return undefined;
  }
}

function brokenLinks(root: string, entry: MemoryEntry): string[] {
  const prose = entry.body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '');
  const directory = path.posix.dirname(entry.relativePath);
  const targets = [...prose.matchAll(MARKDOWN_LINK)]
    .map((match) => match[1].split('#')[0])
    .filter((target) => target && !/^[a-z][a-z0-9+.-]*:/i.test(target));
  return targets.filter(
    (target) =>
      !existsSync(
        path.join(
          root,
          path.posix.normalize(path.posix.join(directory, target)),
        ),
      ),
  );
}

function deadGlobs(entry: MemoryEntry, tracked: string[]): string[] {
  const globs = entry.frontmatter.paths;
  if (entry.frontmatter.confidence === 'deprecated' || !Array.isArray(globs)) {
    return [];
  }
  return globs.map(String).filter((glob) => {
    const pattern = globToRegExp(glob);
    return !isBroadGlob(glob) && !tracked.some((file) => pattern.test(file));
  });
}

export type ChangeSet = 'staged' | 'worktree' | 'branch';

export type MemoryImpact = { file: string; matched: string[] };

export type ImpactReport = {
  sources: string[];
  updated: MemoryImpact[];
  stale: MemoryImpact[];
  uncovered: string[];
  unreadable: string[];
};

const NOISE = new Set(['pnpm-lock.yaml']);

export function defaultBase(root: string): string {
  try {
    return execFileSync(
      'git',
      ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
  } catch {
    return 'origin/main';
  }
}

export function changedFiles(
  root: string,
  set: ChangeSet,
  base = defaultBase(root),
): string[] {
  const files =
    set === 'staged'
      ? gitList(root, ['diff', '--cached', '--name-only', '--no-renames', '-z'])
      : set === 'worktree'
        ? [
            ...gitList(root, [
              'diff',
              'HEAD',
              '--name-only',
              '--no-renames',
              '-z',
            ]),
            ...gitList(root, [
              'ls-files',
              '--others',
              '--exclude-standard',
              '-z',
            ]),
          ]
        : gitList(root, [
            'diff',
            '--name-only',
            '--no-renames',
            '-z',
            `${base}...HEAD`,
          ]);
  return [...new Set(files)].sort();
}

// Which memory files claim (through `paths`) the files this change touches,
// and did the change update them? `stale` is the actionable list.
export function memoryImpact(root: string, changed: string[]): ImpactReport {
  const sources = changed.filter(
    (file) => !file.startsWith(`${MEMORY_DIR}/`) && !NOISE.has(file),
  );
  const covering: MemoryImpact[] = [];
  const covered = new Set<string>();
  const unreadable: string[] = [];

  for (const file of listFiles(root, MEMORY_DIR, (candidate) =>
    candidate.endsWith('.md'),
  )) {
    const { frontmatter } = parseFrontmatter(readText(root, file));
    // No frontmatter means no `paths`, so the file claims nothing and would
    // drop out of the report unnoticed — the same condition lintMemory
    // reports as "missing frontmatter".
    if (Object.keys(frontmatter).length === 0) {
      unreadable.push(file);
      continue;
    }
    if (frontmatter.confidence === 'deprecated') {
      continue;
    }
    const patterns = (
      Array.isArray(frontmatter.paths) ? frontmatter.paths.map(String) : []
    )
      .filter((glob) => !isBroadGlob(glob))
      .map(globToRegExp);
    const matched = sources.filter((source) =>
      patterns.some((pattern) => pattern.test(source)),
    );
    if (matched.length > 0) {
      matched.forEach((source) => covered.add(source));
      covering.push({ file, matched });
    }
  }

  return {
    sources,
    updated: covering.filter((item) => changed.includes(item.file)),
    stale: covering.filter((item) => !changed.includes(item.file)),
    uncovered: sources.filter((source) => !covered.has(source)),
    unreadable,
  };
}

function summarize(files: string[], limit: number): string {
  const shown = files.slice(0, limit).join(', ');
  return files.length > limit
    ? `${shown}, +${files.length - limit} more`
    : shown;
}

export function formatImpact(report: ImpactReport): string {
  const lines: string[] = [];
  if (report.stale.length > 0) {
    lines.push(
      'agent-memory: these memory files cover files you changed and were not updated:',
    );
    for (const item of report.stale) {
      lines.push(`  - ${item.file}  (${summarize(item.matched, 2)})`);
    }
    lines.push(
      '  Read each one. Update it (and bump last_reviewed) in this same change, or be ready to say why it still holds.',
    );
  }
  if (report.uncovered.length > 0) {
    lines.push(
      `agent-memory: no memory file covers ${summarize(report.uncovered, 6)}.`,
      '  If this area has a durable rule, decision, pitfall or command, add a memory file (or a paths entry) and list it in docs/agent-memory/README.md.',
    );
  }
  if (report.sources.length > 0 && lines.length === 0) {
    lines.push(
      'agent-memory: every memory file covering your changes was updated too.',
    );
  }
  if (report.unreadable.length > 0) {
    lines.push(
      `agent-memory: ${summarize(report.unreadable, 3)} has no readable frontmatter, so it covers nothing here.`,
      '  Run `node tools/agent-memory/check.ts` and fix it, or this memory file silently stops being reported.',
    );
  }
  return lines.join('\n');
}
