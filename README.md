# Nodics Installer

`nodics.installer` is the first-machine bootstrapper for Nodics.

It exists so a beginner can start with one command, answer plain questions, and
get a safe setup plan before cloning repositories, installing dependencies, or
starting services.

The repository follows the standard Nodics module-shaped package contract:
`package.json`, `nodics.js`, `AGENTS.md`, `README.md`, `config/`, and focused
tests are present so Nodics tooling and AI agents can identify ownership. It is
still a non-runtime tooling package: `package.json.nodics.runtimeModule` and
`package.json.nodics.loadableByNodicsModuleLoader` are both `false`.

Current development command:

```bash
npx github:Nodics/nodics.installer
```

Local development command from this repository:

```bash
npm start
```

## Current Scope

The first implementation is intentionally non-destructive. It creates a
beginner-readable setup plan for the reference Kickoff journey and prints the
commands that later execution mode will run.

It does not yet clone repositories, install dependencies, start services, or
write setup evidence. Those actions must be added behind explicit approval and
resume-safe execution.

## Beginner Journeys

| Journey | Beginner intent | Status |
| --- | --- | --- |
| Run Nodics locally | Try Nodics with the reference Kickoff project. | Planned first. |
| Create my own project | Generate a customer project instead of using Kickoff. | Deferred until the local setup journey is stable. |

## Example

```bash
npm start -- --workspace=/Users/me/Projects/nodicsRoot --apps=axis,nexus,agora --accelerator=apparel
```

For structured output:

```bash
npm start -- --json
```

## What The Plan Explains

- required machine checks;
- repositories to clone or reuse;
- frontend apps selected from `nodics.exp/apps.json`;
- selected starter accelerator;
- Kickoff configuration steps;
- dependency installation order;
- direct Node local or Docker Local preflight/start commands;
- guided initialization and validation choices;
- safety rules and setup evidence fields.

## Repository Boundary

`nodics.installer` owns first-machine orchestration only. Once repositories
exist locally:

- `nodics.ai` owns framework tooling and contracts;
- `nodics.kickoff` owns reference local runtime composition;
- `nodics.exp` owns frontend app catalogue and workspace tooling;
- Axis, Nexus, and Agora own their own application source and verification.
