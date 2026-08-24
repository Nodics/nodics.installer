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
    assert.equal(packageJson.version, '0.4.0');
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
        '--application-name=Acme',
        '--project-name=acme.project',
        '--company-site-name=acme',
        '--commerce-site-name=acme-apparel',
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
    assert.equal(plan.installer.version, '0.4.0');
    assert.equal(plan.installer.bootstrapCommand, 'npx github:Nodics/nodics.installer');
    assert.equal(plan.beginnerChoices.application.name, 'Acme');
    assert.equal(plan.beginnerChoices.application.code, 'acme');
    assert.equal(plan.beginnerChoices.application.projectPath, '/tmp/nodicsRoot/acme.project');
    assert.equal(plan.beginnerChoices.application.coreModuleName, 'acmeCore');
    assert.equal(plan.beginnerChoices.application.apiModuleName, 'acmeApi');
    assert.equal(plan.beginnerChoices.application.integrationModuleName, 'acmeInt');
    assert.equal(plan.beginnerChoices.application.localEnvironmentName, 'acmeLocal');
    assert.equal(plan.beginnerChoices.application.dockerLocalEnvironmentName, 'acmeDockerLocal');
    assert.equal(plan.beginnerChoices.application.companySitePath, '/tmp/nodicsRoot/acme');
    assert.equal(plan.beginnerChoices.application.commerceSitePath, '/tmp/nodicsRoot/acme-apparel');
    assert.deepEqual(plan.accelerator.domains, ['common', 'apparel']);
    assert(plan.repositories.some(repository => repository.name === 'nodics.ai'));
    assert(plan.repositories.some(repository => repository.name === 'acme.project'));
    assert(plan.repositories.some(repository => repository.name === 'nodics.axis'));
    assert(plan.repositories.some(repository => repository.name === 'acme'));
    assert(plan.repositories.some(repository => repository.name === 'acme-apparel'));
    assert.equal(plan.repositories.find(repository => repository.name === 'acme-apparel').targetPath,
        '/tmp/nodicsRoot/acme-apparel');
    assert.equal(Object.prototype.propertyIsEnumerable.call(
        plan.repositories.find(repository => repository.name === 'acme.project'), 'repository'), false);
    assert(!JSON.stringify(plan).includes('nodics.kickoff'));
    assert(!JSON.stringify(plan).includes('nodics.agora'));
    assert(!JSON.stringify(plan).includes('nodics.nexus'));
    assert(plan.commands.some(command => command.stage === 'preflight' && command.command === 'npm run topology:preflight'));
    assert(plan.commands.some(command => command.stage === 'start' && command.command.includes('topology:start:all')));
    assert.equal(plan.expectedUrls.axis, 'http://localhost:3100');
    assert.equal(plan.expectedUrls.companySite, 'http://localhost:3200');
    assert.equal(plan.expectedUrls.commerceSite, 'http://localhost:3300');
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
    assert.equal(plan.expectedUrls.companySite, 'http://localhost:4200');
    assert.equal(plan.expectedUrls.commerceSite, 'http://localhost:4300');
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
        projectName: 'customer-telco.project',
        companySiteName: 'customer-telco',
        commerceSiteName: 'customer-telco-apparel',
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
    assert.equal(options.application.projectName, 'customer-telco.project');
    assert.equal(options.application.coreModuleName, 'customerTelcoCore');
    assert.equal(options.application.apiModuleName, 'customerTelcoApi');
    assert.equal(options.application.integrationModuleName, 'customerTelcoInt');
    assert.equal(options.application.localEnvironmentName, 'customerTelcoLocal');
    assert.equal(options.application.dockerLocalEnvironmentName, 'customerTelcoDockerLocal');
    assert.equal(options.application.companySiteName, 'customer-telco');
    assert.equal(options.application.commerceSiteName, 'customer-telco-apparel');
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
        rebrandGeneratedApplications: () => ['evidence-app.project/.nodics-installer-identity.json'],
        installFrameworkDependencies: () => ({ status: 'passed', command: 'npm ci' }),
        configureApplicationProject: () => ({ status: 'passed', command: 'npm run configure:framework' }),
        installDependencies: () => [{ status: 'passed', command: 'npm ci' }],
        preflight: async () => ({ operation: 'local-setup-preflight', ok: true, checks: [{ code: 'node', status: 'passed' }] }),
        runTopologyPreflight: () => ({ status: 'passed', command: 'npm run topology:preflight' })
    };
    const plan = service.createSetupPlan(options);
    const result = await service.executeSetup(plan, options);
    assert.equal(result.ok, true);
    assert(fs.existsSync(plan.evidencePath));
    const evidence = JSON.parse(fs.readFileSync(plan.evidencePath, 'utf8'));
    assert.deepEqual(evidence.steps.map(step => step.code), [
        'download',
        'rebrand',
        'install-framework',
        'configure',
        'install',
        'preflight',
        'topology-preflight'
    ]);
});

test('rebrand rewrites generated topology frontend roots', () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nodics-installer-topology-'));
    const projectPath = path.join(workspace, 'acme.project');
    const axisPath = path.join(workspace, 'nodics.axis');
    const companyPath = path.join(workspace, 'acme');
    const commercePath = path.join(workspace, 'acme-apparel');
    fs.mkdirSync(projectPath, { recursive: true });
    fs.mkdirSync(axisPath, { recursive: true });
    fs.mkdirSync(companyPath, { recursive: true });
    fs.mkdirSync(commercePath, { recursive: true });
    fs.writeFileSync(path.join(axisPath, '.env.example'), 'AXIS_PROJECT_CODE=nodics.kickoff\n');
    fs.writeFileSync(path.join(companyPath, '.env.example'), 'NEXUS_DEV_PORT=3200\n');
    fs.writeFileSync(path.join(projectPath, 'package.json'), JSON.stringify({ name: 'nodics.kickoff' }, null, 2));
    fs.writeFileSync(path.join(projectPath, 'nodics.project.json'), JSON.stringify({
        topology: {
            groups: {
                frontends: [
                    { code: 'axis', label: 'Axis', cwd: '{workspaceRoot}/nodics.exp/nodics.axis' },
                    { code: 'nexus', label: 'Nexus', cwd: '{workspaceRoot}/nodics.exp/nodics.nexus' },
                    { code: 'agora', label: 'Agora', cwd: '{workspaceRoot}/nodics.exp/nodics.agora' }
                ]
            }
        }
    }, null, 2));
    ['kickoffCore', 'kickoffApi', 'kickoffInt'].forEach(moduleName => {
        fs.mkdirSync(path.join(projectPath, 'modules', moduleName), { recursive: true });
        fs.writeFileSync(path.join(projectPath, 'modules', moduleName, 'package.json'), JSON.stringify({ name: moduleName }, null, 2));
    });
    const serverConfigPath = path.join(projectPath, 'envs', 'kickoffLocal', 'platformServer', 'config');
    fs.mkdirSync(serverConfigPath, { recursive: true });
    fs.writeFileSync(path.join(serverConfigPath, 'properties.js'),
        "module.exports = { activeModules: { modules: ['nodics.kickoff', 'kickoffCore'] } };\n");
    const dockerPath = path.join(projectPath, 'envs', 'kickoffDockerLocal', 'docker');
    fs.mkdirSync(dockerPath, { recursive: true });
    fs.writeFileSync(path.join(dockerPath, 'backend.Dockerfile'),
        'ENV=kickoffDockerLocal\nCOPY nodics.kickoff /workspace/nodics.kickoff\n');
    const dataPath = path.join(projectPath, 'modules', 'nexus.web', 'modules', 'nexusWebData', 'data');
    fs.mkdirSync(dataPath, { recursive: true });
    fs.writeFileSync(path.join(dataPath, 'content.js'), "module.exports = { text: 'nodics.kickoff checksum payload' };\n");
    const options = installer.parseOptions([
        '--workspace=' + workspace,
        '--application-name=Acme',
        '--project-name=acme.project',
        '--company-site-name=acme',
        '--commerce-site-name=acme-apparel',
        '--accelerator=apparel'
    ]);
    installer.renameProjectIdentityPaths(projectPath, options);
    installer.updateProjectTopologyIdentity(projectPath, options);
    installer.rebrandProjectFiles(projectPath, options);
    installer.configureFrontendEnvironmentFiles(options);
    const projectJson = JSON.parse(fs.readFileSync(path.join(projectPath, 'nodics.project.json'), 'utf8'));
    assert.deepEqual(projectJson.topology.groups.frontends.map(frontend => ({
        code: frontend.code,
        label: frontend.label,
        cwd: frontend.cwd
    })), [
        { code: 'axis', label: 'Axis', cwd: '{workspaceRoot}/nodics.axis' },
        { code: 'companySite', label: 'Acme', cwd: '{workspaceRoot}/acme' },
        { code: 'commerceSite', label: 'Acme Apparel', cwd: '{workspaceRoot}/acme-apparel' }
    ]);
    const renamedServerConfigPath = path.join(projectPath, 'envs', 'acmeLocal', 'platformServer', 'config');
    assert(!fs.existsSync(path.join(projectPath, 'modules', 'kickoffCore')));
    assert(!fs.existsSync(path.join(projectPath, 'modules', 'kickoffApi')));
    assert(!fs.existsSync(path.join(projectPath, 'modules', 'kickoffInt')));
    assert(!fs.existsSync(path.join(projectPath, 'envs', 'kickoffLocal')));
    assert(fs.existsSync(path.join(projectPath, 'modules', 'acmeCore')));
    assert(fs.existsSync(path.join(projectPath, 'modules', 'acmeApi')));
    assert(fs.existsSync(path.join(projectPath, 'modules', 'acmeInt')));
    assert(fs.existsSync(path.join(projectPath, 'envs', 'acmeLocal')));
    assert(fs.existsSync(path.join(projectPath, 'envs', 'acmeDockerLocal')));
    assert.match(fs.readFileSync(path.join(renamedServerConfigPath, 'properties.js'), 'utf8'), /'acme\.project'/);
    assert.match(fs.readFileSync(path.join(renamedServerConfigPath, 'properties.js'), 'utf8'), /'acmeCore'/);
    assert.doesNotMatch(fs.readFileSync(path.join(renamedServerConfigPath, 'properties.js'), 'utf8'), /kickoffCore|kickoffLocal/);
    const dockerFile = fs.readFileSync(path.join(projectPath, 'envs', 'acmeDockerLocal', 'docker', 'backend.Dockerfile'), 'utf8');
    assert.match(dockerFile, /ENV=acmeDockerLocal/);
    assert.match(dockerFile, /COPY acme\.project \/workspace\/acme\.project/);
    assert.doesNotMatch(dockerFile, /kickoffDockerLocal|nodics\.kickoff/);
    assert.match(fs.readFileSync(path.join(dataPath, 'content.js'), 'utf8'), /nodics\.kickoff checksum payload/);
    assert.match(fs.readFileSync(path.join(axisPath, '.env'), 'utf8'), /AXIS_PROJECT_CODE=acme\.project/);
    assert.match(fs.readFileSync(path.join(companyPath, '.env'), 'utf8'), /NEXUS_PLATFORM_BASE_URL=http:\/\/localhost:4300/);
    assert.match(fs.readFileSync(path.join(commercePath, '.env'), 'utf8'), /AGORA_SOLUTION=apparel/);
});

test('resumed evidence refreshes requested execution context', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nodics-installer-resume-'));
    const downloadOptions = installer.parseOptions([
        '--workspace=' + workspace,
        '--action=execute',
        '--yes',
        '--execution-level=download',
        '--application-name=Resume App',
        '--apps=axis'
    ]);
    const service = {
        ...installer,
        prepareRepositories: () => [{ repository: 'nodics.ai', action: 'reused' }],
        rebrandGeneratedApplications: () => ['resume-app.project/.nodics-installer-identity.json'],
        installFrameworkDependencies: () => ({ status: 'passed', command: 'npm ci' }),
        configureApplicationProject: () => ({ status: 'passed', command: 'npm run configure:framework' }),
        installDependencies: () => [{ status: 'passed', command: 'npm ci' }]
    };
    const downloadPlan = service.createSetupPlan(downloadOptions);
    await service.executeSetup(downloadPlan, downloadOptions);

    const installOptions = installer.parseOptions([
        '--workspace=' + workspace,
        '--action=execute',
        '--yes',
        '--execution-level=install',
        '--application-name=Resume App',
        '--apps=axis'
    ]);
    const installPlan = service.createSetupPlan(installOptions);
    await service.executeSetup(installPlan, installOptions);

    const evidence = JSON.parse(fs.readFileSync(installPlan.evidencePath, 'utf8'));
    assert.equal(evidence.executionLevel, 'install');
    assert.equal(evidence.plan.beginnerChoices.application.name, 'Resume App');
    assert(evidence.steps.some(step => step.code === 'install'));
});

test('start execution rechecks live topology even when evidence has a prior start', async () => {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'nodics-installer-start-resume-'));
    const options = installer.parseOptions([
        '--workspace=' + workspace,
        '--action=execute',
        '--yes',
        '--execution-level=start',
        '--application-name=Resume Start',
        '--apps=axis'
    ]);
    let startCalls = 0;
    const service = {
        ...installer,
        prepareRepositories: () => [{ repository: 'nodics.ai', action: 'reused' }],
        rebrandGeneratedApplications: () => ['resume-start.project/.nodics-installer-identity.json'],
        installFrameworkDependencies: () => ({ status: 'passed', command: 'npm ci' }),
        configureApplicationProject: () => ({ status: 'passed', command: 'npm run configure:framework' }),
        installDependencies: () => [{ status: 'passed', command: 'npm ci' }],
        preflight: async () => ({ operation: 'local-setup-preflight', ok: true, checks: [{ code: 'node', status: 'passed' }] }),
        runTopologyPreflight: () => ({ status: 'passed', command: 'npm run topology:preflight' }),
        readTopologyStatus: () => ({
            status: {
                supervisor: 'NOT_RUNNING',
                runtimes: [{ code: 'platform', ready: false, ownership: 'NONE' }]
            }
        }),
        startTopology: async () => {
            startCalls += 1;
            return {
                status: 'passed',
                topology: {
                    supervisor: 'RUNNING',
                    runtimes: [{ code: 'platform', ready: true, ownership: 'THIS_SUPERVISOR' }]
                }
            };
        }
    };
    const plan = service.createSetupPlan(options);
    fs.mkdirSync(path.dirname(plan.evidencePath), { recursive: true });
    fs.writeFileSync(plan.evidencePath, JSON.stringify({
        operation: 'local-setup-execution',
        steps: [{
            code: 'start',
            label: 'Start topology',
            stageVersion: '0.4.0:detached-topology-start-v1',
            status: 'passed'
        }]
    }, null, 2));

    await service.executeSetup(plan, options);

    assert.equal(startCalls, 1);
    const evidence = JSON.parse(fs.readFileSync(plan.evidencePath, 'utf8'));
    assert.equal(evidence.steps.filter(step => step.code === 'start').length, 2);
});

test('doctor returns prerequisite fix guidance', async () => {
    const workspace = path.join(os.tmpdir(), 'nodics-installer-doctor-test');
    const options = installer.parseOptions(['--workspace=' + workspace, '--action=doctor']);
    const plan = installer.createSetupPlan(options);
    const result = await installer.preflight(plan, options);
    assert(result.checks.some(check => check.code === 'mongodb'));
    assert(result.checks.some(check => check.code === 'redis'));
    assert(result.checks.some(check => check.code === 'elasticsearch'));
    assert(installer.renderDoctor(result).includes('Nodics Installer doctor'));
});

test('CLI prints structured JSON', () => {
    const output = childProcess.execFileSync(process.execPath,
        [path.join(repoRoot, 'bin', 'nodics-installer.js'), '--workspace=/tmp/nodicsRoot', '--json'],
        { cwd: repoRoot, encoding: 'utf8' });
    const parsed = JSON.parse(output);
    assert.equal(parsed.operation, 'local-setup-plan');
    assert.equal(parsed.installer.packageName, 'nodics.installer');
    assert.equal(parsed.installer.version, '0.4.0');
});
