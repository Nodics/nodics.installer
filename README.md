# Nodics Installer

`nodics.installer` is the first-machine bootstrapper for Nodics.

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
application name, backend project folder, company site folder, commerce site
folder, workspace folder, local mode, Axis selection, accelerator, repository
access, and release branch. After the answers, it prints a dry-run setup plan.
It does not clone repositories, install dependencies, start services, or write
project files.

To skip questions and print a plan directly:

```bash
npx github:Nodics/nodics.installer \
  --action=plan \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel
```

In non-interactive shells, such as CI or JSON piping, the installer also avoids
prompts and prints deterministic output from provided options.

For local development inside this repository:

```bash
npm start
npm test
```

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
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
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
5. configure the named application project;
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
| Version | `npx github:Nodics/nodics.installer --action=version` | Prints installer version, engines, and supported actions. |

Mutating actions never run unless `--yes` is present. This includes `execute`,
`start`, `stop`, `restart`, `initialize`, `acceptance`, `repair`, and `clean`.

## Beginner Journey

The currently implemented journey is:

```bash
npx github:Nodics/nodics.installer \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
  --workspace=/Users/me/Projects/NodicsCustomer \
  --mode=node \
  --apps=axis \
  --accelerator=apparel
```

This plans a local setup using:

- `nodics.ai` for the framework;
- `acme.project` for the customer backend application project;
- `nodics.axis` for BackOffice, unchanged;
- `acme` for the company site, derived from the Nexus template;
- `acme-apparel` for the apparel commerce site, derived from the Agora template.

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
- `envs/acmeLocal` for direct Node.js local runtime composition;
- `envs/acmeDockerLocal` for Docker Local production-simulation composition.

The framework repository remains `nodics.ai` and the BackOffice application
remains `nodics.axis`. Only customer-owned template identity is renamed.

The custom project journey is intentionally still blocked. The installer reports
that path as deferred until the reference local setup is stable enough to become
the reusable base for project creation.

## Questions The Installer Asks

The questionnaire uses plain setup language:

1. Setup style: reference project or custom project.
2. Application name: the customer name used for identity and evidence.
3. Commerce site folder: for example `acme-apparel`.
4. Company site folder: for example `acme`.
5. Backend project folder: for example `acme.project`.
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

After startup, these daily commands are usually enough:

```bash
npx github:Nodics/nodics.installer \
  --action=status \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=logs \
  --runtime=platform \
  --lines=80 \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=restart \
  --yes \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

Examples:

```bash
npx github:Nodics/nodics.installer \
  --action=execute \
  --yes \
  --execution-level=download \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
  --workspace=/Users/me/Projects/NodicsCustomer
```

```bash
npx github:Nodics/nodics.installer \
  --action=execute \
  --yes \
  --execution-level=start \
  --application-name=Acme \
  --project-name=acme.project \
  --company-site-name=acme \
  --commerce-site-name=acme-apparel \
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

Version `0.5.0` implements the multi-site application identity and local operations setup contract:

- guided option parsing and questionnaire support;
- named backend project, company site, and commerce site setup planning;
- Node Local and Docker Local command plans;
- accelerator mapping;
- prerequisite, doctor, and port preflight;
- safe clone/reuse execution;
- template rebranding, customer module/environment renaming, and local identity files;
- framework-first dependency installation;
- application `.env` framework and identity linking;
- dependency install orchestration;
- resumable setup evidence;
- status, logs, start, stop, restart, initialize, acceptance, repair, clean, and version actions;
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
