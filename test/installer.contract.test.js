/*
    Nodics - Enterprise Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is governed by the Nodics Source-Available Commercial License.
    You may use, copy, modify, deploy, or distribute it only as permitted by the
    root LICENSE file or a separate written agreement with Nodics.

 */

'use strict';

const assert = require('node:assert');
const childProcess = require('node:child_process');
const path = require('node:path');
const test = require('node:test');
const installer = require('../src/installer');

const repoRoot = path.resolve(__dirname, '..');

test('creates a beginner local setup dry-run plan', () => {
    const plan = installer.createSetupPlan(installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--mode=node',
        '--apps=axis,nexus,agora',
        '--accelerator=apparel'
    ]));
    assert.equal(plan.operation, 'local-setup-plan');
    assert.equal(plan.dryRun, true);
    assert.equal(plan.writePerformed, false);
    assert.equal(plan.installer.bootstrapCommand, 'npx github:Nodics/nodics.installer');
    assert(plan.repositories.some(repository => repository.name === 'nodics.ai'));
    assert(plan.repositories.some(repository => repository.name === 'nodics.kickoff'));
    assert(plan.repositories.some(repository => repository.name === 'nodics.exp'));
    assert(plan.repositories.some(repository => repository.name === 'nodics.agora'));
    assert(plan.commands.some(command => command.command === 'npm run configure:framework'));
    assert(plan.commands.some(command => command.command.includes('topology:start:all')));
    assert.equal(plan.expectedUrls.axis, 'http://localhost:3100');
});

test('creates a Docker Local setup dry-run plan', () => {
    const plan = installer.createSetupPlan(installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--mode=docker',
        '--apps=axis,nexus',
        '--accelerator=telco'
    ]));
    assert(plan.prerequisites.find(check => check.code === 'docker').required);
    assert(plan.commands.some(command => command.command === 'npm run docker-local:preflight'));
    assert.equal(plan.expectedUrls.axis, 'http://localhost:4100');
    assert.equal(plan.expectedUrls.nexus, 'http://localhost:4200');
});

test('rejects deferred custom-project execution path', () => {
    assert.throws(() => installer.createSetupPlan(installer.parseOptions(['--journey=project'])),
        /custom project journey is documented but deferred/);
});

test('CLI prints structured JSON', () => {
    const output = childProcess.execFileSync(process.execPath,
        [path.join(repoRoot, 'bin', 'nodics-installer.js'), '--workspace=/tmp/nodicsRoot', '--json'],
        { cwd: repoRoot, encoding: 'utf8' });
    const parsed = JSON.parse(output);
    assert.equal(parsed.operation, 'local-setup-plan');
    assert.equal(parsed.installer.packageName, 'nodics.installer');
});
