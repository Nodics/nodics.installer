# Nodics Installer Enterprise Readiness

This document records the enterprise hardening checklist for first-machine
Nodics setup. It is written for beginners, customer developers, support
engineers, and release owners.

## AI Tool Entry

A user may start the Nodics journey from an AI coding tool such as Codex,
Claude Code, GitHub Copilot, or another repository-aware assistant by providing
the relevant Nodics GitHub repository URL. In that path the user does not need
to install or run `nodics.installer` first.

The AI tool must read the target repository's root `AGENTS.md`, then root
`README.md`, then the nearest module, environment, or application `AGENTS.md`
before making changes. Use the installer only when the goal is to create,
repair, preflight, start, initialize, accept, or inspect a local customer
workspace.

Generated customer-local output must not be committed to Nodics source
repositories unless the user explicitly asks for that exact repository change.

## Release Tagging

Every published installer release must have a matching Git tag:

```bash
git tag -a v0.7.1 -m "Nodics Installer 0.7.1"
git push origin v0.7.1
```

Beginners can then pin a known installer version:

```bash
npx github:Nodics/nodics.installer#v0.7.1
```

## npm Publication Readiness

The repository is named `nodics.installer`. The npm package name is
`@nodics/installer`.

`npx` and npm package identity are governed bootstrap contracts. Any change to
the package name, `package.json.bin`, `publishConfig`, release tags, publish
scripts, or documented bootstrap commands must be called out to the user before
implementation and reflected in the active plan.

Before publishing to npm, the release owner must confirm:

- Nodics owns the `@nodics` npm scope;
- package access is public;
- the GitHub tag matches `package.json.version`;
- `npm test` passes locally and in CI;
- `npm run publish:check` passes;
- `npm pack --dry-run` includes only expected files;
- publish uses npm provenance where available;
- support, security, and deprecation policy are documented.

After npm publication, this command becomes valid:

```bash
npx @nodics/installer
```

## Fresh-Machine Simulation

Use an empty workspace outside any source checkout:

```bash
mkdir -p /tmp/nodics-fresh
npx github:Nodics/nodics.installer#v0.7.1 \
  --action=execute \
  --yes \
  --execution-level=preflight \
  --workspace=/tmp/nodics-fresh \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --apps=axis \
  --accelerator=apparel
```

The expected result is a configured workspace with preflight evidence, no
started runtime, and no customer project commits.

## Resume And Recovery

The installer writes evidence to:

```text
<workspace>/.nodics-installer/setup-evidence.json
```

If setup is interrupted, rerun the same command. Completed stages are skipped
only when their stage version is still current. Stages that interact with live
topology state re-check the machine rather than trusting old evidence.

Recovery controls:

- `--resume` records operator intent to continue from existing evidence;
- `--retry-failed` removes failed evidence steps before execution;
- `--from-step=<step-code>` removes that step and later steps before execution;
- `backup --yes` archives installer-generated customer roots only;
- `rollback --yes --backup-id=latest` restores a selected generated-root backup
  while protecting `nodics.ai` and `nodics.axis`;
- `cleanup-workspace` removes only installer-created customer roots and setup
  evidence, while protecting `nodics.ai` and `nodics.axis`;
- `uninstall` stops topology first, then runs the same safe cleanup policy.

Backups are retained under `<workspace>/.nodics-installer/backups` so cleanup
can preserve rollback evidence.

## Enterprise Command Surface

The installer exposes these enterprise inspection and support actions:

- `inventory` lists generated projects, sites, environments, vendor roots, and
  installer metadata in a workspace;
- `upgrade-check` compares `.nodics-installer-lock.json` and
  `acceptance.localBootstrap` with current installer expectations;
- `support-bundle --yes` writes sanitized evidence, status, and log excerpts,
  writes a SHA-256 manifest, then attempts to create a `.tar.gz` archive;
- `backup --yes` and `rollback --yes` protect generated customer roots before
  destructive maintenance;
- `self-check` validates installer files, local command readiness, JSON result
  contracts, and npm/npx readiness without changing package identity;
- `workspace-manifest --yes` writes `.nodics-workspace.json` with generated
  roots, vendor roots, selected sites, project identity, and installer version;
- `update-vendors --yes` fetches and fast-forwards only clean `nodics.ai` and
  `nodics.axis` checkouts;
- `diff-review` groups Git changes by customer-generated versus vendor-owned
  roots before repair, support, or upgrade;
- `data-readiness` checks starter data manifests and local media references;
- `publishing-check` checks staged/online/process runtime presence plus
  data/media readiness;
- `health` checks expected local HTTP URLs after the topology is started;
- `logs --explain` maps known error signatures to beginner next commands.

Support bundles are local-only. The installer redacts bearer headers, tokens,
passwords, secrets, and the local home path before writing support evidence.
The bundle manifest records file sizes and SHA-256 hashes for support handoff.

## Profiles And Readiness

Plans and evidence now include:

- environment profiles: `local-dev`, `local-demo`, `local-qa`, `docker-local`;
- acceptance profiles: `smoke`, `standard`, `full`;
- release channels: `development`, `stable`, `explicit`;
- support matrix for Node.js, npm, Git, MongoDB, Redis, Elasticsearch, Docker,
  RAM, and disk;
- service dependency graph for backend runtimes and selected frontends;
- port plan with optional alternate-port preview;
- database lifecycle policy for retained data versus fresh data;
- generated/customer/vendor file ownership policy;
- data seed, publishing, media, and runtime health readiness summaries.
- schema ownership and seed idempotency readiness summaries;
- OS dependency guidance for macOS, Linux, and Windows/WSL;
- workspace conflict detection for existing folders, dirty repositories,
  missing remotes, and unexpected branches;
- upgrade compatibility matrix for installer, framework, Axis, customer
  project, lock metadata, and local bootstrap capability drift.

`stable` maps to `master` only when `--release` is not supplied. Explicit branch
or tag selection remains the source of truth.

## Remote Bootstrap And CI

The public GitHub bootstrap command remains:

```bash
npx github:Nodics/nodics.installer
```

The npm package command remains review-only until npm publication is approved:

```bash
npx @nodics/installer
```

Maintainers can test the GitHub bootstrap path from outside the repository:

```bash
npm run smoke:remote -- --workspace=/tmp/nodics-remote-smoke
```

The smoke script executes `version`, `self-check`, `plan`, and `preflight`
through `npx github:Nodics/nodics.installer`. GitHub Actions runs tests,
syntax checks, publish readiness, dry-run packaging, and uploads self-check,
plan-smoke, and npm-pack JSON artifacts.

## Safe Local Maintenance

Use `update-vendors --yes` only when customer projects are already generated and
vendor checkouts are clean. The command does not update customer roots.

Use `doctor --fix --yes` only for local installer metadata refresh. It can write
`.nodics-workspace.json` and missing installer lock metadata, but it does not
install dependencies, change source code, or patch `nodics.ai` / `nodics.axis`.

Use `--output=/path/setup-plan.json` with `--action=plan --json` when an
enterprise team wants to review a setup report before any mutating action.

Policy packs constrain installer setup choices only. They are not business
solution descriptors and they must not become another source of runtime truth.

The approved Application Builder scope is tracked in
`docs/application-builder-scope.md`: do not add `nodics.solution.json`, and do
not make `nodics.project.json` the Application Builder contract.

## Beginner Failure Catalog

Run:

```bash
npx github:Nodics/nodics.installer --action=troubleshooting
```

The catalog covers Node/npm version drift, GitHub access, dirty repositories,
npm registry/proxy failures, MongoDB/Redis/Elasticsearch availability, busy
ports, Docker daemon availability, WCMS import artifacts, and missing media
references.

## Acceptance Gate Split

Treat setup health and business data health separately:

- `preflight` proves prerequisite software, workspace safety, and ports.
- `topology-preflight` proves the customer project can see its runtime layout.
- `start` proves local services can become ready.
- `initialize` proves selected data packs can import.
- `acceptance` proves the end-to-end local business path.

A machine can be healthy even when a data pack has a source defect. In that
case, the installer must report the data-pack diagnosis without blaming the
beginner's machine.

## Docker Local

Docker mode requires both the Docker CLI and a running daemon:

```bash
docker --version
docker info
```

If `docker info` fails, start Docker Desktop or configure `NODICS_DOCKER_BIN`.
Only after that should the release owner run Docker build, start, status,
acceptance, stop, and clean.

## Generated App Verification

For generated application projects, verify:

- backend project identity comes from `--application-name`;
- Axis remains `nodics.axis`;
- company and commerce sites use customer names;
- first execution creates only the selected local environment;
- Docker compose project and backend image names use the customer slug;
- no user-facing generated identity points to Kickoff, Agora, or Nexus unless
  the file is intentionally documenting template origin.

## Vendor-Owned Repository Boundary

`nodics.ai` and `nodics.axis` are vendor-owned repositories in a partner or
customer workspace. They are allowed local dependencies, not customization
targets.

Policy:

- partner/customer custom work must not be added under `nodics.ai`;
- partner/customer custom work must not be added under `nodics.axis`;
- installer expansion actions must target named customer projects, modules,
  environments, and sites only;
- framework or BackOffice changes needed by a customer must be raised upstream
  to Nodics and delivered through an approved release branch or tag.

Reason: local customer changes in vendor-owned repositories create upgrade,
support, and migration conflicts. The stable boundary is:

- `nodics.ai` owns framework contracts, runtime tooling, and platform behavior;
- `nodics.axis` owns standard BackOffice behavior;
- the named customer backend project owns runtime composition and custom
  modules;
- named customer sites own customer-facing experience.

The installer must not write customer `.env` files or installer identity files
inside vendor-owned repositories. Axis receives local runtime values from the
customer project topology `env` block at launch time, keeping the BackOffice
checkout migration-safe.

## Expansion Governance

First-machine setup is intentionally small. It creates the named customer
project, selected first local environment, selected standard applications, and
selected starter sites only.

Later customer growth must be handled through explicit expansion actions:

- `add-environment` for QA, staging, production simulation, or another local
  runtime variant;
- `add-module` for a new customer-owned backend module;
- `add-site` for another company or commerce site such as electronics or telco.

Expansion actions must read existing setup evidence, preserve current project
identity, refuse dirty repositories, update project contracts deterministically,
and write new evidence. They must not rerun first-machine bootstrap or rename
existing customer repositories.

Example gated commands:

```bash
npx github:Nodics/nodics.installer#v0.7.1 \
  --action=add-environment \
  --yes \
  --workspace=/tmp/nodics-fresh \
  --application-name=Acme \
  --project-name=acme.startio \
  --environment-name=acmeQa \
  --from-environment=acmeLocal
```

```bash
npx github:Nodics/nodics.installer#v0.7.1 \
  --action=add-module \
  --yes \
  --workspace=/tmp/nodics-fresh \
  --application-name=Acme \
  --project-name=acme.startio \
  --module-name=acmeLoyalty
```

```bash
npx github:Nodics/nodics.installer#v0.7.1 \
  --action=add-site \
  --yes \
  --workspace=/tmp/nodics-fresh \
  --application-name=Acme \
  --project-name=acme.startio \
  --site-name=acme.electronics \
  --site-type=commerce \
  --accelerator=electronics
```

## Security Review

The installer must not print or persist secrets. Evidence and terminal output
must redact bearer tokens, GitHub tokens, passwords, generic tokens, and secret
query parameters.

Project `.env` files are local configuration, not secret distribution. Browser
frontend configuration must never contain private values.

## OS Support

The current support stance is:

- macOS: primary local developer path;
- Linux: supported for CI and expected to work for direct Node local setup;
- Windows: not certified yet; use WSL2 until native shell/path validation is
  completed.

## Enterprise Policy Pack

Enterprise teams can provide:

- `--proxy`;
- `--npm-registry`;
- `--offline-cache`;
- `--policy-pack`.

These values are recorded in the plan/evidence. They should point to approved
company infrastructure and must not embed credentials.

## Telemetry Decision

The installer currently has no remote telemetry. It writes local evidence only.
Any future telemetry must be opt-in, documented, redact secrets, and be
separable from setup success.

## Rollback Strategy

The installer can safely:

- stop topology;
- clean generated runtime directories while stopped;
- reapply identity and framework links with `repair`.

It must not reset Git repositories, delete user source changes, or remove
customer work. Rollback of source changes remains a user-owned Git operation.

## Upgrade Path

For an existing customer project, use:

```bash
npx github:Nodics/nodics.installer#v0.7.1 --action=repair --yes
```

The repair path updates installer identity, framework links, environment names,
customer-owned frontend `.env` files, Axis topology launch environment, and
Docker Local naming without recloning.

## Template Contract

Starter templates must keep the installer contract stable:

- template-owned names are replaceable by deterministic identity rules;
- framework ownership remains `nodics.ai`;
- Axis ownership remains `nodics.axis`;
- customer project modules are generated from the application name;
- Docker compose/image names are generated from the application slug;
- importable data packs declare manifest sections, checksums, lifecycle,
  destination role, environment scope, and tests;
- media-backed CMS component data must not import before active media
  references are available.

## Beginner Walkthrough

1. Install Node.js, npm, Git, MongoDB, Redis, and Elasticsearch.
2. Run `npx github:Nodics/nodics.installer`.
3. Answer the guided questions.
4. Run `--action=doctor` and fix local machine issues.
5. Run `--action=execute --yes --execution-level=preflight`.
6. Run `--action=start --yes`.
7. Open Axis, the company site, and the commerce site.
8. Run `--action=initialize --yes`.
9. Run `--action=acceptance --yes`.
10. Use `--action=logs` and `--action=status` when something is unclear.
11. Run `--action=stop --yes` when finished.
