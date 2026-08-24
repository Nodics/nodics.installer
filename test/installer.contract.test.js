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
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const installer = require('../src/installer');

const repoRoot = path.resolve(__dirname, '..');

test('repository keeps the standard non-runtime Nodics module shape', async () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    const nodicsRoot = require('../nodics');
    assert.equal(packageJson.main, 'nodics.js');
    assert.equal(packageJson.version, '0.3.0');
    assert.equal(packageJson.nodics.kind, 'tooling');
    assert.equal(packageJson.nodics.displayName, 'Nodics Installer');
    assert.equal(packageJson.nodics.runtimeModule, false);
    assert.equal(packageJson.nodics.loadableByNodicsModuleLoader, false);
    assert.deepEqual(packageJson.nodics.runtime, { router: false, publish: false, web: false });
    assert(fs.existsSync(path.join(repoRoot, 'nodics.js')));
    assert(fs.existsSync(path.join(repoRoot, 'config', 'properties.js')));
    assert(fs.existsSync(path.join(repoRoot, 'config', 'prescripts.js')));
    assert(fs.existsSync(path.join(repoRoot, 'config', 'postscripts.js')));
    assert.equal(await nodicsRoot.init({}), true);
    assert.equal(await nodicsRoot.postInit({}), true);
});

test('creates an executable beginner local setup plan', () => {
    const plan = installer.createSetupPlan(installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--application-name=Acme Apparel',
        '--mode=node',
        '--apps=axis',
        '--accelerator=apparel',
        '--release=development'
    ]));
    assert.equal(plan.contractVersion, 1);
    assert.equal(plan.operation, 'local-setup-plan');
    assert.equal(plan.dryRun, true);
    assert.equal(plan.writePerformed, false);
    assert.equal(plan.executionSupported, true);
    assert.equal(plan.installer.version, '0.3.0');
    assert.equal(plan.installer.bootstrapCommand, 'npx github:Nodics/nodics.installer');
    assert.equal(plan.beginnerChoices.application.name, 'Acme Apparel');
    assert.equal(plan.beginnerChoices.application.code, 'acme-apparel');
    assert.equal(plan.beginnerChoices.application.projectPath, '/tmp/nodicsRoot/acme-apparel');
    assert.equal(plan.beginnerChoices.application.webPath, '/tmp/nodicsRoot/acme-apparel.web');
    assert.deepEqual(plan.accelerator.domains, ['common', 'apparel']);
    assert(plan.repositories.some(repository => repository.name === 'nodics.ai'));
    assert(plan.repositories.some(repository => repository.name === 'acme-apparel'));
    assert(plan.repositories.some(repository => repository.name === 'nodics.axis'));
    assert(plan.repositories.some(repository => repository.name === 'acme-apparel.web'));
    assert.equal(plan.repositories.find(repository => repository.name === 'acme-apparel.web').targetPath,
        '/tmp/nodicsRoot/acme-apparel.web');
    assert.equal(Object.prototype.propertyIsEnumerable.call(
        plan.repositories.find(repository => repository.name === 'acme-apparel'), 'repository'), false);
    assert(!JSON.stringify(plan).includes('nodics.kickoff'));
    assert(!JSON.stringify(plan).includes('nodics.agora'));
    assert(!JSON.stringify(plan).includes('nodics.nexus'));
    assert(plan.commands.some(command => command.stage === 'preflight' && command.command === 'npm run topology:preflight'));
    assert(plan.commands.some(command => command.stage === 'start' && command.command.includes('topology:start:all')));
    assert.equal(plan.expectedUrls.axis, 'http://localhost:3100');
    assert.equal(plan.expectedUrls.application, 'http://localhost:3300');
    assert.equal(plan.evidencePath, '/tmp/nodicsRoot/.nodics-installer/setup-evidence.json');
});

test('creates a Docker Local setup plan with Docker preflight', () => {
    const plan = installer.createSetupPlan(installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--mode=docker',
        '--application-name=Telco Portal',
        '--apps=axis',
        '--accelerator=telco'
    ]));
    assert(plan.prerequisites.find(check => check.code === 'docker').required);
    assert(plan.commands.some(command => command.command === 'npm run docker-local:preflight'));
    assert.equal(plan.expectedUrls.axis, 'http://localhost:4100');
    assert.equal(plan.expectedUrls.application, 'http://localhost:4300');
    assert(!Object.prototype.hasOwnProperty.call(plan.expectedUrls, 'nexus'));
    assert(!Object.prototype.hasOwnProperty.call(plan.expectedUrls, 'agora'));
});

test('accelerators do not add branded frontend applications', () => {
    const options = installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--application-name=Combined Store',
        '--apps=axis',
        '--accelerator=combined'
    ]);
    assert.deepEqual(options.apps, ['axis']);
    assert.equal(options.application.code, 'combined-store');
});

test('beginner execution flags select matching execution levels', () => {
    assert.equal(installer.parseOptions(['--start']).executionLevel, 'start');
    assert.equal(installer.parseOptions(['--initialize']).executionLevel, 'initialize');
    assert.equal(installer.parseOptions(['--acceptance']).executionLevel, 'acceptance');
    assert.equal(installer.parseOptions(['--execution-level=download', '--start']).executionLevel, 'download');
});

test('rejects unsafe or deferred execution paths', () => {
    assert.throws(() => installer.createSetupPlan(installer.parseOptions(['--journey=project'])),
        /custom project journey is documented but deferred/);
    assert.throws(() => installer.createSetupPlan(installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--action=execute'
    ])), /Execution requires --yes/);
    assert.throws(() => installer.createSetupPlan(installer.parseOptions([
        '--workspace=' + os.homedir()
    ])), /not the filesystem root or home directory/);
    assert.throws(() => installer.createSetupPlan(installer.parseOptions([
        '--workspace=/tmp/nodicsRoot',
        '--apps=axis,nexus'
    ])), /Customer-facing apps are named with --application-name/);
});

test('questionnaire answers merge into normal options', async () => {
    const baseOptions = installer.parseOptions(['--action=questionnaire', '--json']);
    const options = await installer.runQuestionnaire(baseOptions, {
        journey: 'reference',
        applicationName: 'Customer Telco',
        workspace: '/tmp/nodicsQuestionnaire',
        mode: 'docker',
        apps: 'axis',
        accelerator: 'combined',
        cloneMode: 'ssh',
        release: 'master'
    });
    assert.equal(options.action, 'questionnaire');
    assert.equal(options.application.name, 'Customer Telco');
    assert.equal(options.application.code, 'customer-telco');
    assert.equal(options.workspace, '/tmp/nodicsQuestionnaire');
    assert.equal(options.mode, 'docker');
    assert.deepEqual(options.apps, ['axis']);
    assert.equal(options.cloneMode, 'ssh');
    assert.equal(options.release, 'master');
});

test('bare interactive startup asks guided questions', () => {
    const options = installer.parseOptions([]);
    assert.equal(installer.shouldRunStartupQuestionnaire([], options, {
        input: { isTTY: true },
        output: { isTTY: true }
    }), true);
    assert.equal(installer.shouldRunStartupQuestionnaire(['--action=plan'], installer.parseOptions(['--action=plan']), {
        input: { isTTY: true },
        output: { isTTY: true }
    }), false);
    assert.equal(installer.shouldRunStartupQuestionnaire(['--json'], installer.parseOptions(['--json']), {
        input: { isTTY: true },
        output: { isTTY: true }
    }), false);
    assert.equal(installer.shouldRunStartupQuestionnaire([], options, {
        input: { isTTY: false },
        output: { isTTY: true }
    }), false);
});

test('preflight reports command and port checks without mutating repositories', async () => {
    const workspace = path.join(os.tmpdir(), 'nodics-installer-preflight-test');
    const options = installer.parseOptions(['--workspace=' + workspace, '--action=preflight', '--apps=axis']);
    const plan = installer.createSetupPlan(options);
    const result = await installer.preflight(plan, options);
    assert.equal(result.operation, 'local-setup-preflight');
    assert(result.checks.some(check => check.code === 'node'));
    assert(result.checks.some(check => check.code === 'npm'));
    assert(result.checks.some(check => check.code === 'git'));
    assert(result.checks.some(check => check.code === 'docker' && check.status === 'skipped'));
    assert(result.checks.some(check => check.code === 'workspace-parent'));
    assert(!fs.existsSync(path.join(workspace, 'nodics.ai')));
});

test('execute writes resumable evidence with injected stages', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nodics-installer-execute-'));
    const options = installer.parseOptions([
        '--workspace=' + workspace,
        '--action=execute',
        '--yes',
        '--execution-level=preflight',
        '--application-name=Evidence App',
        '--apps=axis'
    ]);
    const service = {
        ...installer,
        prepareRepositories: () => [{ repository: 'nodics.ai', action: 'reused' }],
        configureApplicationProject: () => ({ status: 'passed', command: 'npm run configure:framework' }),
        installDependencies: () => [{ status: 'passed', command: 'npm ci' }],
        preflight: async () => ({ operation: 'local-setup-preflight', ok: true, checks: [{ code: 'node', status: 'passed' }] })
    };
    const plan = service.createSetupPlan(options);
    const result = await service.executeSetup(plan, options);
    assert.equal(result.ok, true);
    assert(fs.existsSync(plan.evidencePath));
    const evidence = JSON.parse(fs.readFileSync(plan.evidencePath, 'utf8'));
    assert.deepEqual(evidence.steps.map(step => step.code), ['download', 'configure', 'install', 'preflight']);
});

test('CLI prints structured JSON', () => {
    const output = childProcess.execFileSync(process.execPath,
        [path.join(repoRoot, 'bin', 'nodics-installer.js'), '--workspace=/tmp/nodicsRoot', '--json'],
        { cwd: repoRoot, encoding: 'utf8' });
    const parsed = JSON.parse(output);
    assert.equal(parsed.operation, 'local-setup-plan');
    assert.equal(parsed.installer.packageName, 'nodics.installer');
    assert.equal(parsed.installer.version, '0.3.0');
});
