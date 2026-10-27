# Repository memory protocol

**Forestar layout.** Each code repository owns its wiki under its own
`docs/agent-memory/` and versions it in Git; this guide is installed in each repository.
The workspace root only holds an index of redirections
(`docs/agent-memory/README.md`). Hindsight and Claude Code memory notes are local
complements, never the source of truth: Codex works here too. Before working in a
repository, read that repository's catalogue, not the root index.

The wiki captures verified decisions, rationale, operational commands and recurring
pitfalls that source code and instruction files do not explain. Keep one topic per
file, catalogue it in `docs/agent-memory/README.md`, and link related entries.

Before nontrivial work, read the catalogue and search relevant paths. Apply verified
entries only while current according to `last_reviewed + review_after_days`. Drafts
are context to verify; deprecated entries preserve history and point to successors.

Before finishing, update relevant knowledge when a durable decision, workflow or
pitfall changes. Update an existing entry before creating a new one. Record source,
confidence, rationale and rejected alternatives where relevant. Do not copy source
code, secrets, task logs or instruction rules into the wiki. Use draft for useful
but unverified knowledge; do not label a guess verified.

Use the selected runtime's impact command to identify affected entries and review
each one, updating it or explaining why it still holds. Run its check when there is
no PR gate covering it, or read that gate's result. Catalogue new entries. Replaced
entries become deprecated with a successor link; Git history provides the change log.

During import choose one runtime, merge command aliases into existing configuration,
and adapt CI only if authorized. The Python variant requires PyYAML; the Node variant
uses Node's TypeScript stripping and no external parser. Their parsers have different
YAML capabilities: use unquoted ISO dates and simple inline arrays supported by both,
or test the actual representation.

Commands (Node 22.18+, run from the repository root): `node tools/agent-memory/check.ts` / `impact.ts`, or `pnpm|npm run memory:check` / `memory:impact` where `package.json` defines them. The Python variant is not used. Impact supports working tree,
staged and branch modes; use the actual base ref. It is advisory unless explicitly
configured otherwise. Broad overview globs intentionally do not trigger reminders.
Optional stop/session hooks must match the actual host and are not a security boundary.
