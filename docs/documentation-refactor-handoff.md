# Documentation Refactor Handoff

This document captures the Application Builder documentation work that should
move into the wider Nodics documentation refactoring scope later.

## Purpose

`nodics.installer` should keep only the documentation needed to run, validate,
and maintain the installer repository itself. Long-form beginner, operator,
partner, support, and enterprise architecture documentation should move into
the dedicated Nodics documentation system when that refactoring workstream is
active.

This file is a local handoff note so the future documentation refactor can pick
up the installer topics without adding another builder descriptor or source of
truth.

## Current Installer Documentation Boundary

Keep these topics in `nodics.installer`:

- quick start commands;
- installer action reference;
- maintainer validation commands;
- npm and npx governance notes;
- repository ownership and AI agent guidance;
- concise local troubleshooting pointers;
- release and package readiness notes for this installer package.

Do not make the installer README the full Nodics product manual.

## Future Documentation Scope

Move or expand these topics in the central documentation refactor:

- beginner local setup walkthrough from an empty machine;
- prerequisite software installation for macOS, Linux, Windows, and WSL;
- customer workspace model and generated project ownership;
- vendor-owned repository boundary for `nodics.ai` and `nodics.axis`;
- AI tool journey for Codex, Claude Code, GitHub Copilot, and similar tools;
- first setup journey with framework, Axis, company site, and commerce site;
- post-setup expansion journey for environments, modules, and sites;
- data readiness, media readiness, publishing readiness, and local acceptance;
- support bundle collection and support handoff process;
- upgrade, repair, rollback, and safe vendor update guidance;
- enterprise policy pack usage when that contract is implemented;
- release qualification and installer versioning process.

## Scope Rule To Preserve

Application Builder documentation must reflect these approved scope rules:

- do not introduce `nodics.solution.json`;
- do not introduce another descriptor or source-of-truth file;
- do not make `nodics.project.json` the Application Builder contract;
- derive builder intent from guided user input and existing Nodics conventions;
- use `package.json`, `nodics.js`, module folders, environment folders, site
  folders, npm scripts, `README.md`, and `AGENTS.md`;
- use installer evidence, locks, and workspace metadata only for safety,
  repair, audit, and support.

## Documentation Refactor Acceptance

The documentation refactor should be considered complete for Application
Builder only when:

- a beginner can follow one page from prerequisites to running local Nodics;
- partner and customer developers understand where custom code belongs;
- AI tools have a clear repository-entry guide and protected-root rule;
- support engineers can collect evidence without exposing secrets;
- release owners can qualify installer changes without changing npm or npx
  behavior accidentally;
- installer README links to the central documentation instead of duplicating the
  full guide.
