# Nodics Installer Agent Contract

`nodics.installer` is the standalone first-machine bootstrap repository for
Nodics local setup.

It follows the standard Nodics module-shaped package contract while remaining
non-runtime tooling. Keep `package.json.nodics.runtimeModule` and
`package.json.nodics.loadableByNodicsModuleLoader` set to `false`.

Use this repository when a user does not yet have `nodics.ai`,
`nodics.kickoff`, or `nodics.exp` locally. The installer asks beginner
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

## Ownership

- Own beginner bootstrap questions, setup-plan creation, repository
  download/reuse orchestration, setup evidence, and first-run summaries.
- Do not own framework runtime behavior, module loading, schemas, APIs, data
  import, frontend source, or accelerator business logic.
- Delegate framework-aware validation, topology, Docker Local, guided
  initialization, Application Builder, qualification, and upgrade contracts to
  `nodics.ai` / `nTooling`.
- Delegate reference runtime composition, local environments, project data packs,
  and acceptance aliases to `nodics.kickoff`.
- Delegate frontend app catalogue and app fetch/status/verify behavior to
  `nodics.exp`.

## Safety Rules

- Default to dry-run planning before execution.
- Never run destructive Git commands.
- Never reset, overwrite, or delete a dirty existing checkout automatically.
- Never print secret values into normal logs or setup summaries.
- Roll back only paths created by the current installer operation.
- Keep beginner text plain; hide raw Nodics module names until evidence or
  advanced sections require them.
- Treat production certification, penetration testing, managed-provider
  resilience, and external accessibility review as separate evidence.
