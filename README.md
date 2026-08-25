# Nodics Installer

`nodics.installer` is the first-machine bootstrapper repository for Nodics.
Its npm package identity is `@nodics/installer`.

It is designed for a beginner who has just opened GitHub or the Nodics
documentation and wants one guided command to prepare a local Nodics workspace.
The user should not need to know repository names, module names, topology
commands, or `.env` details before seeing a clear setup plan.

The package follows the standard Nodics module-shaped repository contract:
`package.json`, `nodics.js`, `AGENTS.md`, `README.md`, `config/`, and focused
tests are present so Nodics tooling and AI agents can identify ownership. It is
still a non-runtime tooling package: `package.json.nodics.runtimeModule` and
`package.json.nodics.loadableByNodicsModuleLoader` are both `false`.

## Quick Start

Run the installer directly from GitHub:

```bash
npx github:Nodics/nodics.installer
```

When started from a normal terminal, that command asks guided questions first:
application name, accelerator, commerce site folder, company site folder,
backend project code/folder, workspace folder, local mode, Axis selection, repository
access, and release branch. After the answers, it prints a dry-run setup plan.
It does not clone repositories, install dependencies, start services, or write
project files.

To skip questions and print a plan directly:

```bash
npx github:Nodics/nodics.installer \
  --action=plan \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel
```

In non-interactive shells, such as CI or JSON piping, the installer also avoids
prompts and prints deterministic output from provided options.

If a user starts from an AI coding tool such as Codex, Claude Code, GitHub
Copilot, or another repository-aware assistant, they can point that tool
directly at a Nodics GitHub repository URL. In that path the AI tool should read
the repository's root `AGENTS.md`, then the nearest module `AGENTS.md` and
README before changing files. The user does not need to install or run the
installer first for repository analysis or source work. The installer is still
the right tool when the user wants to create, repair, preflight, start,
initialize, or accept a local customer workspace.

For local development inside this repository:

```bash
npm start
npm test
npm run publish:check
```

Maintainers and AI tools must treat `npx` and npm package identity as governed
bootstrap contracts. Before changing `package.json` package name, `bin`,
`publishConfig`, release tags, publish scripts, or documented bootstrap
commands, update the active plan and explicitly tell the user what will change
for `npx github:Nodics/nodics.installer` or `npx @nodics/installer`.

## How `npx` Finds The Installer

`npx` does not automatically map `@nodics/installer` to the GitHub repository
`Nodics/nodics.installer`.

There are two supported bootstrap forms:

```bash
npx github:Nodics/nodics.installer
```

This downloads and runs the public GitHub repository directly. It works before
the installer is published to npm.

```bash
npx @nodics/installer
```

This will work only after Nodics publishes the current package named
`@nodics/installer` under the `@nodics` npm scope. At that point npm is the
registry of record, and the package points back to this GitHub repository
through its package metadata.

The current enterprise-safe publication decision is:

1. use `npx github:Nodics/nodics.installer` for public GitHub bootstrap now;
2. keep the repository named `nodics.installer`;
3. publish the package `@nodics/installer` later when the Nodics npm organization, package
   ownership, release signing, and support policy are ready.

## Application Builder Scope

The installer builds local setup from questionnaire answers, command options,
existing Nodics repository conventions, and installer evidence used for safety
and support. It must not introduce a separate business solution descriptor.

Do not add `nodics.solution.json`. Do not make `nodics.project.json` the
Application Builder contract. Existing customer projects may still use
`nodics.project.json` for their own runtime or topology metadata, but the
installer scope is governed by [docs/application-builder-scope.md](docs/application-builder-scope.md).

## Prerequisite Software

The installer can print a plan with only Node.js and npm available, but a proper
local Nodics runtime needs the tools below.

| Software | Why it is needed | Beginner check |
| --- | --- | --- |
| Node.js | Runs the installer, backend tooling, application project scripts, and frontend tooling. | `node --version` |
| npm | Installs package dependencies and runs repository scripts. | `npm --version` |
| Git | Downloads or updates Nodics repositories. | `git --version` |
| MongoDB | Stores local runtime data for framework services. | `mongod --version` or `mongosh --version` |
| Redis | Used by cache/session features when enabled in the local profile. | `redis-server --version` |
| Elasticsearch | Used by search-backed capabilities when enabled. | `curl http://localhost:9200` after starting it |
| Docker Desktop | Needed only when `--mode=docker` is selected. | `docker --version` |

The current package engine range is Node.js `>=22 <27` and npm `>=10 <12`.

On macOS with Homebrew, a beginner can usually install the basic toolchain with:

```bash
brew install node git mongodb-community redis
```

Elasticsearch installation can vary by organization and license policy. If your
company provides a local Docker image, package mirror, or managed developer
script, use that approved path. For a first direct local run, start with the
services your selected Nodics profile actually enables; disabled integrations may
log that a provider is not enabled, which is expected in local development.

Before running execution, use preflight:

```bash
npx github:Nodics/nodics.installer \
  --action=preflight \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

Installer preflight checks Node.js, npm, Git, MongoDB, Redis, Elasticsearch,
optional Docker, the workspace parent, and expected local ports. MongoDB, Redis,
and Elasticsearch are treated as local runtime dependencies: the installer
reports clear guidance, while the project topology preflight remains the final
authority after repositories are available.

## Why This Exists

`npm run setup:local` is useful only after a developer already has a Nodics
project downloaded locally. A brand-new machine does not have `nodics.ai`,
`nodics.axis`, or the customer's named application project yet, so there is no
local package script to run.

`nodics.installer` runs one step earlier. Its job is to:

1. ask beginner-friendly questions;
2. create a safe setup plan;
3. check local prerequisites;
4. download or reuse required repositories;
5. create the named application project with the selected first local environment;
6. install dependencies;
7. start the selected local topology when explicitly requested;
8. guide initialization and acceptance;
9. write resumable setup evidence.

## Actions

The installer separates planning, checking, and execution so a beginner can see
what will happen before the machine is changed.

| Action | Command | What it does |
| --- | --- | --- |
| Plan | `npx github:Nodics/nodics.installer --action=plan` | Prints the setup plan only. |
| Questionnaire | `npx github:Nodics/nodics.installer --action=questionnaire` | Asks guided questions, then prints a plan. |
| Preflight | `npx github:Nodics/nodics.installer --action=preflight` | Checks Node.js, npm, Git, runtime dependencies, optional Docker, workspace parent, and expected ports. |
| Doctor | `npx github:Nodics/nodics.installer --action=doctor` | Prints preflight checks with beginner fix guidance. |
| Execute | `npx github:Nodics/nodics.installer --action=execute --yes` | Runs the selected setup level and writes evidence. |
| Status | `npx github:Nodics/nodics.installer --action=status` | Shows evidence, repositories, topology readiness, URLs, and log location. |
| Start | `npx github:Nodics/nodics.installer --action=start --yes` | Starts or verifies the existing local topology. |
| Stop | `npx github:Nodics/nodics.installer --action=stop --yes` | Stops the local topology through the customer project. |
| Restart | `npx github:Nodics/nodics.installer --action=restart --yes` | Stops and starts the local topology again. |
| Logs | `npx github:Nodics/nodics.installer --action=logs` | Lists topology logs and prints recent lines. |
| Initialize | `npx github:Nodics/nodics.installer --action=initialize --yes` | Starts if needed, then runs guided initialization. |
| Acceptance | `npx github:Nodics/nodics.installer --action=acceptance --yes` | Starts if needed, then runs local acceptance checks. |
| Repair | `npx github:Nodics/nodics.installer --action=repair --yes` | Reapplies installer identity and framework links without recloning. |
| Clean | `npx github:Nodics/nodics.installer --action=clean --yes` | Removes generated runtime files only; refuses while topology is running. |
| Backup | `npx github:Nodics/nodics.installer --action=backup --yes` | Archives installer-generated customer roots while protecting vendor repositories. |
| Rollback | `npx github:Nodics/nodics.installer --action=rollback --yes --backup-id=latest` | Restores an installer-generated customer-root backup. |
| Cleanup workspace | `npx github:Nodics/nodics.installer --action=cleanup-workspace --yes` | Removes installer-created customer roots and setup evidence while protecting vendor repositories. |
| Uninstall | `npx github:Nodics/nodics.installer --action=uninstall --yes` | Stops topology, then runs safe generated workspace cleanup. |
| Inventory | `npx github:Nodics/nodics.installer --action=inventory` | Lists Nodics repositories, generated projects, sites, environments, and installer metadata in a workspace. |
| Support bundle | `npx github:Nodics/nodics.installer --action=support-bundle --yes` | Exports sanitized evidence, status, and log excerpts for support handoff. |
| Upgrade check | `npx github:Nodics/nodics.installer --action=upgrade-check` | Compares generated metadata and local acceptance capabilities with current installer rules. |
| Self-check | `npx github:Nodics/nodics.installer --action=self-check` | Validates installer files, local commands, JSON contracts, and npm/npx readiness status. |
| Workspace manifest | `npx github:Nodics/nodics.installer --action=workspace-manifest --yes` | Writes `.nodics-workspace.json` so tools can identify generated and vendor roots. |
| Update vendors | `npx github:Nodics/nodics.installer --action=update-vendors --yes` | Fast-forwards only clean `nodics.ai` and `nodics.axis` checkouts. |
| Diff review | `npx github:Nodics/nodics.installer --action=diff-review` | Groups local Git changes by generated/customer/vendor ownership. |
| Data readiness | `npx github:Nodics/nodics.installer --action=data-readiness` | Checks seed manifests and local media/data readiness. |
| Publishing check | `npx github:Nodics/nodics.installer --action=publishing-check` | Checks staged/online/process/media readiness before publishing acceptance. |
| Health | `npx github:Nodics/nodics.installer --action=health` | Checks expected local runtime URLs after topology start. |
| Troubleshooting | `npx github:Nodics/nodics.installer --action=troubleshooting` | Prints known beginner failure signatures and first fixes. |
| Version | `npx github:Nodics/nodics.installer --action=version` | Prints installer version, engines, and supported actions. |

Mutating actions never run unless `--yes` is present. This includes `execute`,
`start`, `stop`, `restart`, `initialize`, `acceptance`, `repair`, `clean`,
`support-bundle`, `backup`, `rollback`, `cleanup-workspace`, `uninstall`,
`workspace-manifest`, and `update-vendors`.

## Enterprise Options

The installer records enterprise setup choices in the plan and evidence:

- `--environment-profile=local-dev|local-demo|local-qa|docker-local`
- `--acceptance-profile=smoke|standard|full`
- `--release-channel=development|stable|explicit`
- `--resume`, `--retry-failed`, and `--from-step=<step-code>`
- `--alternate-ports`
- `--output=/path/setup-plan.json`
- `--backup-id=latest`
- `--fix` with `--action=doctor --yes` for safe installer metadata repair
- `--explain` with logs and beginner reports
- `--module-preset=capability|data-pack|integration-adapter|api-facade|workflow-extension`
- `--site-preset=apparel|electronics|telco|company|commerce`
- `--policy-pack=/path`, `--offline-cache=/path`, `--proxy=...`, and
  `--npm-registry=...`

`stable` maps to `master` when `--release` is not supplied. Explicit
`--release=<branch-or-tag>` always wins. The npm package identity and bootstrap
commands remain review-only until a release owner approves npm publication.

Policy packs constrain setup choices such as allowed accelerators, modes,
required apps, and release values. They are not business solution descriptors.

Maintainers can validate the GitHub bootstrap path without changing npm package
identity:

```bash
npm run smoke:remote -- --workspace=/tmp/nodics-remote-smoke
```

That script runs `npx github:Nodics/nodics.installer` for `version`,
`self-check`, `plan`, and `preflight`.

## Beginner Journey

The currently implemented journey is:

```bash
npx github:Nodics/nodics.installer \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer \
  --mode=node \
  --apps=axis \
  --accelerator=apparel
```

This plans a local setup using:

- `nodics.ai` for the framework;
- `acme.startio` for the customer backend application project;
- `nodics.axis` for BackOffice, unchanged;
- `acme.web` for the company site, derived from the Nexus template;
- `acme.apparel` for the apparel commerce site, derived from the Agora template.

Starter templates may still be used internally, but the user's local workspace,
environment identity, evidence, and beginner plan use the application name. The
user should not need to choose or work inside folders named Kickoff, Agora, or
Nexus.

Inside the generated backend project, installer-owned source identity is also
derived from the application name. For the Acme example, the customer project
uses:

- `modules/acmeCore` for shared customer behavior;
- `modules/acmeApi` for customer API customizations;
- `modules/acmeInt` for customer integration customizations;
- `envs/acmeLocal` for the first direct Node.js local runtime composition.

If the customer explicitly selects `--mode=docker`, the first local environment
is `envs/acmeDockerLocal` instead. The first installer execution keeps only the
selected local environment. Additional environments, modules, and sites are
treated as later expansion work so the first workspace stays understandable for
a beginner.

The framework repository remains `nodics.ai` and the BackOffice application
remains `nodics.axis`. Only customer-owned template identity is renamed.

## Vendor-Owned Repository Boundary

For partner and customer projects, treat `nodics.ai` and `nodics.axis` as
vendor-owned repositories. They are downloaded so the local application can run,
but partner/customer customization must not be made inside them.

Why this matters:

- `nodics.ai` carries framework contracts, runtime tooling, and upgrade rules.
- `nodics.axis` carries the standard BackOffice application.
- Local changes in either repository make future Nodics migration, patching, and
  support much harder.

Customer work belongs in the named customer repositories:

- backend application project, for example `acme.startio`;
- company site, for example `acme.web`;
- commerce sites, for example `acme.apparel` or `acme.electronics`;
- customer-owned modules and environments created later by expansion actions.

It is fine to read `nodics.ai` and `nodics.axis`, run documented scripts from
them, and sync them to an approved branch or tag. Required product changes
should be reported upstream to Nodics instead of patched locally in a customer
workspace.

The installer does not write customer `.env` files or installer identity files
inside `nodics.ai` or `nodics.axis`. Axis local runtime values are declared in
the named customer project topology `env` block and injected by framework
tooling when Axis is started.

The custom project journey is intentionally still blocked. The installer reports
that path as deferred until the reference local setup is stable enough to become
the reusable base for project creation.

## Questions The Installer Asks

The questionnaire uses plain setup language:

1. Setup style: reference project or custom project.
2. Application name: the customer name used for identity and evidence.
3. Commerce site folder: for example `acme.apparel`.
4. Company site folder: for example `acme.web`.
5. Backend project code/folder: for example `acme.startio`.
6. Workspace folder: where Nodics should live.
7. Runtime mode: direct Node.js local processes or Docker Local.
8. Standard applications: Axis or no standard app.
9. Accelerator: common, apparel, electronics, telco, or combined.
10. Repository access: HTTPS, SSH, or existing local repositories.
11. Branch or tag: normally `development` for active development.

Example:

```bash
npx github:Nodics/nodics.installer --action=questionnaire
```

## Execution Levels

Execution levels let a user stop after the amount of work they are comfortable
with.

| Level | What happens |
| --- | --- |
| `download` | Create the workspace and clone or reuse repositories. |
| `install` | Download/reuse repositories, apply identity, install framework dependencies, configure the application project, and install project/frontend dependencies. |
| `preflight` | Run download, identity, framework install, configure, dependency install, machine checks, and topology preflight. This is the default execution level. |
| `start` | Run everything through preflight, then start the selected topology. |
| `initialize` | Start services and run guided initialization when selected. |
| `acceptance` | Run the longest local validation path when `--acceptance` is also selected. |

Recommended beginner sequence:

1. Run the default plan and read it.
2. Run `--action=preflight` and resolve missing software or busy ports.
3. Run `--action=execute --yes --execution-level=download` to download the source.
4. Run `--action=execute --yes --execution-level=install` to configure the application project and install dependencies.
5. Run `--action=execute --yes --execution-level=preflight` to run installer and topology checks.
6. Run `--action=execute --yes --execution-level=start` when the machine is ready to start services.
7. Use `--execution-level=initialize` or `--execution-level=acceptance --acceptance` for the longer data and validation path.

## Later Expansion

After the first local environment is working, the same installer will become
the entry point for controlled expansion:

- `add-environment` for another environment such as QA, staging, production
  simulation, or an additional local variant;
- `add-module` for a new customer-owned backend module;
- `add-site` for another customer-facing site such as electronics, telco, or a
  future storefront.

Those expansion actions must read the existing installer evidence and project
identity before creating anything. They must add only the requested item, update
the project contract and environment links, refuse dirty repositories, and write
new evidence. They must not rerun the first-machine bootstrap or rename the
already-created `acme.startio`, `acme.web`, or `acme.apparel` projects.

Add one environment:

```bash
npx github:Nodics/nodics.installer \
  --action=add-environment \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --environment-name=acmeQa \
  --from-environment=acmeLocal \
  --workspace=/Users/me/Projects/NodicsCustomer
```

Add one backend module:

```bash
npx github:Nodics/nodics.installer \
  --action=add-module \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --module-name=acmeLoyalty \
  --workspace=/Users/me/Projects/NodicsCustomer
```

Add one additional commerce site:

```bash
npx github:Nodics/nodics.installer \
  --action=add-site \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --site-name=acme.electronics \
  --site-type=commerce \
  --accelerator=electronics \
  --workspace=/Users/me/Projects/NodicsCustomer
```

Expansion evidence is written to:

```text
<workspace>/.nodics-installer/expansion-evidence.json
```

After startup, these daily commands are usually enough:

```bash
npx github:Nodics/nodics.installer \
  --action=status \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=logs \
  --runtime=platform \
  --lines=80 \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=restart \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

Examples:

```bash
npx github:Nodics/nodics.installer \
  --action=execute \
  --yes \
  --execution-level=download \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=execute \
  --yes \
  --execution-level=start \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --accelerator=apparel \
  --apps=axis
```

## Repository Download Modes

Use HTTPS for the easiest first run:

```bash
--clone=https
```

Use SSH when the developer already has GitHub SSH access configured:

```bash
--clone=ssh
```

Use existing mode when repositories are already present and should not be
downloaded:

```bash
--clone=existing
```

Existing repositories must be clean. The installer refuses dirty checkouts
instead of resetting or overwriting local work.

## Accelerator Profiles

Accelerators choose the starter business experience for the named application.
They no longer add branded frontend applications such as Agora or Nexus to the
user's workspace.

| Accelerator | Domains | Required apps | Data packs |
| --- | --- | --- | --- |
| `common` | common | none | `<application>.commonData` |
| `apparel` | common, apparel | none | `<application>.commonData`, `<application>.apparelData` |
| `electronics` | common, electronics | none | `<application>.commonData`, `<application>.electronicsData` |
| `telco` | common, electronics, telco | none | `<application>.commonData`, `<application>.telcoData` |
| `combined` | common, apparel, electronics, telco | none | all listed application data packs |

## Node Local And Docker Local

Direct Node local mode is the fastest developer loop:

```bash
--mode=node
```

Expected URLs include:

- Axis: `http://localhost:3100`
- Company site: `http://localhost:3200`
- Commerce site: `http://localhost:3300`
- Platform API: `http://localhost:4300`
- WCMS Staged API: `http://localhost:4312`
- WCMS Online API: `http://localhost:4314`
- Process API: `http://localhost:4330`
- Engagement API: `http://localhost:4340`
- Commerce API: `http://localhost:4350`

Docker Local is for a more isolated production-simulation setup:

```bash
--mode=docker
```

Expected URLs use the Docker Local port range, for example Axis at
`http://localhost:4100`, company site at `http://localhost:4200`, commerce site
at `http://localhost:4300`, and Platform at `http://localhost:5300`.

Docker Local uses the application name for the compose and backend image
identity. For `Acme`, the installer rewrites the Docker template to use names
such as `nodics-acme-docker-local` and `nodics/acme-backend:docker-local`
instead of Kickoff-owned Docker names.

## Enterprise Options

Enterprise options are recorded in the plan and used where supported:

```bash
--proxy=http://proxy.company.local:8080
--npm-registry=https://registry.company.local
--offline-cache=/Volumes/nodics-cache
--policy-pack=/Users/me/company/nodics-policy
```

These options are intentionally advanced. A beginner should not need them for
the normal first local run.

## Enterprise Readiness

The detailed enterprise checklist is maintained in
[docs/enterprise-readiness.md](docs/enterprise-readiness.md). It covers release
tagging, npm publication readiness, fresh-machine simulation, resume/recovery,
the failure catalog, acceptance gate split, Docker Local validation, generated
identity verification, security review, OS support, policy packs, telemetry,
rollback, upgrades, template contracts, and the beginner walkthrough.

## Evidence

Execution writes a resumable evidence file:

```text
<workspace>/.nodics-installer/setup-evidence.json
```

The evidence contains:

- installer version;
- selected journey, application name, mode, standard apps, accelerator, release, and workspace;
- repositories and target paths;
- setup stages completed;
- command results;
- preflight results;
- expected local URLs.

Secrets are sanitized from command output before evidence is written.

## Troubleshooting

Start with the least destructive checks:

```bash
npx github:Nodics/nodics.installer \
  --action=status \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=doctor \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

If a port is busy, stop the process that owns the port or change the project
topology port before starting again. The default Node Local ports are
`3100`, `3200`, `3300`, `4300`, `4312`, `4314`, `4330`, `4340`, and `4350`.
Docker Local uses `4100`, `4200`, `4300`, `5300`, `5312`, `5314`, `5330`,
`5340`, and `5350`.

If MongoDB, Redis, or Elasticsearch are missing, install or start only the
services required by the selected local profile, then rerun:

```bash
npx github:Nodics/nodics.installer \
  --action=doctor \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

If a repository already exists and the installer refuses it as dirty, commit,
stash, or move the local changes yourself. The installer will not reset or
overwrite a dirty checkout.

If startup is confusing, inspect recent logs:

```bash
npx github:Nodics/nodics.installer \
  --action=logs \
  --runtime=wcmsStaged \
  --lines=120 \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

If guided initialization fails with a message like `Media reference was not
found` or `agoraComponentMediaData`, the WCMS component media data was imported
before its matching media references were available. The installer reports this
as `media-reference-missing` and lists import error files under:

```text
<project>/envs/<application>Local/wcmsStagedServer/temp/import/**/error/
```

Review the listed file, stop the topology, clean generated runtime state, start
again, and rerun initialization:

```bash
npx github:Nodics/nodics.installer \
  --action=stop \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer

npx github:Nodics/nodics.installer \
  --action=clean \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer

npx github:Nodics/nodics.installer \
  --action=start \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer

npx github:Nodics/nodics.installer \
  --action=initialize \
  --yes \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

If the same media-reference error repeats on a fresh runtime, the accelerator
data pack needs a source fix in its import order or missing media reference seed
data. Treat that as a framework/application data issue, not a local machine
setup issue.

For Docker Local, first confirm Docker Desktop is running:

```bash
docker info
```

Then run Docker preflight from the customer project through the installer:

```bash
npx github:Nodics/nodics.installer \
  --mode=docker \
  --action=preflight \
  --application-name=Acme \
  --project-name=acme.startio \
  --company-site-name=acme.web \
  --commerce-site-name=acme.apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

## Safety Rules

The installer follows these rules:

- plan and preflight do not mutate project repositories;
- execute requires `--yes`;
- dangerous workspace paths such as `/` or the home directory are refused;
- dirty existing repositories are refused;
- no destructive Git reset is used;
- secrets are not printed in normal logs or setup evidence;
- local setup evidence never claims production certification.

## Current Status

Version `0.7.2` implements the multi-site application identity, selected local
environment identity, Docker identity cleanup, npm package readiness, and local
operations setup contract:

- guided option parsing and questionnaire support;
- named backend project, company site, and commerce site setup planning;
- Node Local and Docker Local command plans;
- accelerator mapping;
- prerequisite, doctor, and port preflight;
- safe clone/reuse execution;
- template rebranding, first local environment renaming, and local identity files;
- expansion actions for one environment, module, or site at a time, including
  copied-environment index isolation, generated module runtime metadata,
  new-site topology ports, and dependency installation;
- framework-first dependency installation;
- application `.env` framework and identity linking;
- Axis native topology `env` injection without writing customer config into
  `nodics.axis`;
- vendor-owned repository boundary verification;
- dependency install orchestration;
- resumable setup evidence;
- status, logs, start, stop, restart, initialize, acceptance, repair, clean, and version actions;
- troubleshooting failure catalog action;
- structured beginner diagnostics for initialization and acceptance command failures;
- CI release check for Node.js 22 and 24 plus package smoke test;
- module-shaped repository compliance tests.

The full runtime stack was not started during repository tests. The test suite
uses focused contract checks and injected execution stages so the installer can
be validated without cloning or starting every Nodics service.

## Repository Boundary

`nodics.installer` owns first-machine orchestration only. Once repositories
exist locally:

- `nodics.ai` owns framework tooling and contracts;
- the named application project owns customer runtime composition;
- `nodics.axis` owns the standard BackOffice application;
- the named application web project owns the customer-facing web experience.
