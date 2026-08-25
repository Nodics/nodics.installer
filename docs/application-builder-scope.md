# Application Builder Scope

This document records the approved local Application Builder scope for
`nodics.installer`.

## Approved Source Of Setup Input

The installer builds the first local workspace from:

- command-line options or questionnaire answers;
- existing Nodics repository metadata such as `package.json`, `nodics.js`,
  `README.md`, and `AGENTS.md`;
- existing customer project conventions and scripts after the customer project
  has been generated;
- installer evidence, locks, backups, and workspace manifests used only for
  safety, repair, audit, support, and rollback.

The installer must not introduce a new business solution descriptor as the
builder authority.

## Explicit Non-Scope

Do not add `nodics.solution.json`.

Do not make `nodics.project.json` the Application Builder contract. Existing
projects may continue to use `nodics.project.json` for their own runtime or
topology metadata, but the installer must not require it as the business
solution source of truth.

Do not place customer customizations under `nodics.ai` or `nodics.axis`.
Those repositories are vendor-owned in partner and customer workspaces.

Do not change `npx`, npm package identity, `package.json.bin`, `publishConfig`,
release tags, publish scripts, or documented bootstrap commands without first
calling out the impact and updating the active plan.

## Implemented Local Scope

The first execution creates or repairs one named customer workspace:

- `nodics.ai` remains the framework repository;
- `nodics.axis` remains the BackOffice repository;
- the backend project name comes from the user, for example `acme.startio`;
- the company site name comes from the user, for example `acme.web`;
- the commerce site name comes from the user and accelerator, for example
  `acme.apparel`;
- only the selected first local environment is retained;
- later expansion uses explicit actions: `add-environment`, `add-module`, and
  `add-site`.

## Enterprise Guardrails

The installer must provide:

- beginner questionnaire and deterministic non-interactive options;
- prerequisite, platform, dependency, workspace, and port checks;
- data, media, schema ownership, idempotency, and publishing readiness checks;
- generated-root backup and rollback for customer-owned roots only;
- policy-pack validation as setup constraints only, not as business solution
  descriptors;
- support bundle and troubleshooting outputs with secret redaction;
- AI tool guidance through `AGENTS.md` and README links.
