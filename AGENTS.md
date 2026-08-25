# Nodics Installer Agent Contract

`nodics.installer` is the standalone first-machine bootstrap repository for
Nodics local setup.

It follows the standard Nodics module-shaped package contract while remaining
non-runtime tooling. Keep `package.json.nodics.runtimeModule` and
`package.json.nodics.loadableByNodicsModuleLoader` set to `false`.

Use this repository when a user does not yet have `nodics.ai`,
`nodics.axis`, or a named customer application project locally. The installer asks beginner
questions, creates a safe setup plan, downloads or reuses repositories, delegates
Nodics-aware work to framework/project tooling after those repositories exist,
and writes local setup evidence.

## AI tool entry path

A user working inside Codex, Claude Code, GitHub Copilot, or another
repository-aware AI coding tool can start by giving the AI tool a Nodics GitHub
repository URL. That path does not need downloading this installer first.

Use this installer only when the user's goal is to create, repair, preflight,
start, initialize, accept, or inspect a local customer workspace. If the user is
asking for architecture, code analysis, source changes, reviews, or module
documentation inside an existing Nodics repository, follow that repository's
root `AGENTS.md` and nearest module guidance instead.

When the installer is used from an AI tool, confirm the target workspace before
mutating actions and keep generated customer-local output out of source
repository commits unless the user explicitly asks otherwise.

AI tools should inspect in this order before changing a generated workspace:

1. `--action=inventory`
2. `--action=diff-review`
3. `--action=status`
4. `.nodics-workspace.json` when present

Use `--action=workspace-manifest --yes` or `--action=repair --yes` to refresh
local installer metadata. Use `--action=update-vendors --yes` only for clean
`nodics.ai` and `nodics.axis` checkouts. Never place customer-specific fixes in
vendor-owned repositories as a shortcut.

## npm and npx change governance

`npx` and npm package identity are governed bootstrap contracts.
Any change that affects `npx`, npm package identity, `package.json.bin`,
`publishConfig`, release tags, publish scripts, or bootstrap commands must be
called out to the user before implementation and reflected in the active plan.
Do not silently change whether beginners should run
`npx github:Nodics/nodics.installer` or `npx @nodics/installer`.
Adding review-only smoke tests for the current GitHub bootstrap path is allowed
when the active plan calls it out and no package identity, `bin`, publish
configuration, release tag, or bootstrap command is changed.

For partner and customer workspaces, treat `nodics.ai` and `nodics.axis` as
vendor-owned read-only customization boundaries. Read them, run documented
scripts, and sync approved releases, but do not place customer customizations
inside them. Customer work belongs in the named backend project, named sites,
customer modules, and customer environments so upgrades and migrations remain
manageable.

## Ownership

- Own beginner bootstrap questions, setup-plan creation, repository
  download/reuse orchestration, setup evidence, and first-run summaries.
- Do not own framework runtime behavior, module loading, schemas, APIs, data
  import, frontend source, or accelerator business logic.
- Delegate framework-aware validation, topology, Docker Local, guided
  initialization, Application Builder, qualification, and upgrade contracts to
  `nodics.ai` / `nTooling`.
- Delegate customer runtime composition, local environments, project data packs,
  and acceptance aliases to the named customer backend project.
- Delegate BackOffice behavior to `nodics.axis`.

## Safety Rules

- Default to dry-run planning before execution.
- Never run destructive Git commands.
- Never reset, overwrite, or delete a dirty existing checkout automatically.
- Never add partner/customer customizations under `nodics.ai` or `nodics.axis`.
- Never print secret values into normal logs or setup summaries.
- Roll back only paths created by the current installer operation.
- Keep beginner text plain; hide raw Nodics module names until evidence or
  advanced sections require them.
- Prefer `data-readiness`, `publishing-check`, `health`, `logs --explain`, and
  `support-bundle --yes` before guessing at runtime or data failures.
- Treat production certification, penetration testing, managed-provider
  resilience, and external accessibility review as separate evidence.
