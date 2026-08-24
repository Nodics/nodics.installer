/*
    Nodics - Enterprise Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is governed by the Nodics Source-Available Commercial License.
    You may use, copy, modify, deploy, or distribute it only as permitted by the
    root LICENSE file or a separate written agreement with Nodics.

 */

'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const readline = require('node:readline');

const VERSION = '0.2.0';
const VALID_JOURNEYS = new Set(['reference', 'project']);
const VALID_MODES = new Set(['node', 'docker']);
const VALID_APPS = new Set(['axis', 'nexus', 'agora']);
const VALID_ACCELERATORS = new Set(['common', 'apparel', 'electronics', 'telco', 'combined']);
const VALID_ACTIONS = new Set(['plan', 'questionnaire', 'preflight', 'execute']);
const VALID_EXECUTION_LEVELS = new Set(['download', 'install', 'preflight', 'start', 'initialize', 'acceptance']);
const VALID_CLONE_MODES = new Set(['https', 'ssh', 'existing']);

const DEFAULT_REPOSITORIES = Object.freeze({
    framework: {
        code: 'framework',
        name: 'nodics.ai',
        https: 'https://github.com/Nodics/nodics.ai.git',
        ssh: 'git@github.com:Nodics/nodics.ai.git'
    },
    kickoff: {
        code: 'kickoff',
        name: 'nodics.kickoff',
        https: 'https://github.com/Nodics/nodics.kickoff.git',
        ssh: 'git@github.com:Nodics/nodics.kickoff.git'
    },
    experience: {
        code: 'experience',
        name: 'nodics.exp',
        https: 'https://github.com/Nodics/nodics.exp.git',
        ssh: 'git@github.com:Nodics/nodics.exp.git'
    }
});

const FRONTEND_REPOSITORIES = Object.freeze({
    axis: {
        code: 'axis',
        name: 'nodics.axis',
        https: 'https://github.com/Nodics/nodics.axis.git',
        ssh: 'git@github.com:Nodics/nodics.axis.git',
        type: 'backoffice'
    },
    nexus: {
        code: 'nexus',
        name: 'nodics.nexus',
        https: 'https://github.com/Nodics/nodics.nexus.git',
        ssh: 'git@github.com:Nodics/nodics.nexus.git',
        type: 'corporate'
    },
    agora: {
        code: 'agora',
        name: 'nodics.agora',
        https: 'https://github.com/Nodics/nodics.agora.git',
        ssh: 'git@github.com:Nodics/nodics.agora.git',
        type: 'storefront'
    }
});

const ACCELERATOR_PROFILES = Object.freeze({
    common: {
        domains: ['common'],
        requiredApps: [],
        dataPacks: ['nexusWebData', 'agoraCommonData'],
        gates: ['topology preflight']
    },
    apparel: {
        domains: ['common', 'apparel'],
        requiredApps: ['agora'],
        dataPacks: ['agoraCommonData', 'agoraApparelData'],
        gates: ['guided initialization', 'agora commerce data']
    },
    electronics: {
        domains: ['common', 'electronics'],
        requiredApps: ['agora'],
        dataPacks: ['agoraCommonData', 'agoraElectronicsData'],
        gates: ['guided initialization', 'agora commerce data']
    },
    telco: {
        domains: ['common', 'electronics', 'telco'],
        requiredApps: ['agora'],
        dataPacks: ['agoraCommonData', 'agoraTelcoData'],
        gates: ['guided initialization', 'telco commerce data']
    },
    combined: {
        domains: ['common', 'apparel', 'electronics', 'telco'],
        requiredApps: ['agora', 'nexus'],
        dataPacks: ['agoraCommonData', 'agoraApparelData', 'agoraElectronicsData', 'agoraTelcoData', 'nexusWebData'],
        gates: ['guided initialization', 'multi-domain acceptance']
    }
});

const installer = {
    readOption: function (args, name, defaultValue) {
        const prefix = name + '=';
        const match = (args || []).find(argument => argument.startsWith(prefix));
        return match ? match.slice(prefix.length) : defaultValue;
    },

    hasFlag: function (args, name) {
        return (args || []).includes(name);
    },

    readCsvOption: function (args, name, defaultValue) {
        const value = this.readOption(args, name, '');
        return (value ? value.split(',') : defaultValue)
            .map(item => String(item).trim().toLowerCase())
            .filter(Boolean);
    },

    usage: function () {
        return [
            'Nodics Installer',
            '',
            'Usage:',
            '  npx github:Nodics/nodics.installer [options]',
            '  npm start -- [options]',
            '',
            'Beginner actions:',
            '  --action=plan             Print the setup plan only. Default.',
            '  --action=questionnaire    Ask guided setup questions, then print a plan.',
            '  --action=preflight        Check local machine prerequisites and ports.',
            '  --action=execute --yes    Run the selected setup level with evidence.',
            '',
            'Options:',
            '  --journey=reference|project',
            '  --workspace=/absolute/path       Default: ~/Nodics/nodicsRoot',
            '  --mode=node|docker               Default: node',
            '  --apps=axis,nexus,agora          Default: axis,nexus,agora',
            '  --accelerator=common|apparel|electronics|telco|combined',
            '  --execution-level=download|install|preflight|start|initialize|acceptance',
            '  --clone=https|ssh|existing       Default: https',
            '  --release=development            Git branch/tag to use. Default: development',
            '  --sample-data                     Include starter sample data guidance.',
            '  --fresh-data                      Prefer clean initialization data where supported.',
            '  --acceptance                      Run local acceptance commands at acceptance level.',
            '  --proxy=http://host:port          Record enterprise proxy requirement.',
            '  --npm-registry=https://registry   Use npm registry while installing.',
            '  --offline-cache=/path             Record offline cache location.',
            '  --policy-pack=/path               Record enterprise policy pack location.',
            '  --json                            Print structured JSON.',
            '  --help                            Show this help.',
            '',
            'Safety:',
            '  Execute never runs unless --yes is present.',
            '  Existing dirty repositories are refused instead of overwritten.'
        ].join('\n');
    },

    parseOptions: function (args) {
        const workspace = this.readOption(args, '--workspace', path.join(os.homedir(), 'Nodics', 'nodicsRoot'));
        const accelerator = this.readOption(args, '--accelerator', 'common').toLowerCase();
        const explicitApps = this.readOption(args, '--apps', null);
        const defaultApps = explicitApps === null ? ['axis', 'nexus', 'agora'] : [];
        const requestedApps = this.readCsvOption(args, '--apps', defaultApps);
        const requiredApps = ACCELERATOR_PROFILES[accelerator] ? ACCELERATOR_PROFILES[accelerator].requiredApps : [];
        const apps = Array.from(new Set([...requestedApps, ...requiredApps]));
        const explicitExecutionLevel = this.readOption(args, '--execution-level', null);
        let executionLevel = explicitExecutionLevel || 'preflight';
        if (!explicitExecutionLevel && this.hasFlag(args, '--start')) {
            executionLevel = 'start';
        }
        if (!explicitExecutionLevel && this.hasFlag(args, '--initialize')) {
            executionLevel = 'initialize';
        }
        if (!explicitExecutionLevel && this.hasFlag(args, '--acceptance')) {
            executionLevel = 'acceptance';
        }
        return {
            journey: this.readOption(args, '--journey', 'reference').toLowerCase(),
            workspace: path.resolve(workspace),
            mode: this.readOption(args, '--mode', 'node').toLowerCase(),
            apps,
            accelerator,
            action: this.readOption(args, '--action', 'plan').toLowerCase(),
            executionLevel: executionLevel.toLowerCase(),
            cloneMode: this.readOption(args, '--clone', 'https').toLowerCase(),
            release: this.readOption(args, '--release', 'development'),
            sampleData: this.hasFlag(args, '--sample-data'),
            freshData: this.hasFlag(args, '--fresh-data'),
            start: this.hasFlag(args, '--start'),
            initialize: this.hasFlag(args, '--initialize'),
            acceptance: this.hasFlag(args, '--acceptance'),
            yes: this.hasFlag(args, '--yes'),
            json: this.hasFlag(args, '--json'),
            proxy: this.readOption(args, '--proxy', ''),
            npmRegistry: this.readOption(args, '--npm-registry', ''),
            offlineCache: this.readOption(args, '--offline-cache', ''),
            policyPack: this.readOption(args, '--policy-pack', '')
        };
    },

    getQuestionnaireFields: function () {
        return [
            { name: 'journey', question: 'Setup style (reference/project)', defaultValue: 'reference' },
            { name: 'workspace', question: 'Workspace folder', defaultValue: path.join(os.homedir(), 'Nodics', 'nodicsRoot') },
            { name: 'mode', question: 'Runtime mode (node/docker)', defaultValue: 'node' },
            { name: 'apps', question: 'Applications (axis,nexus,agora)', defaultValue: 'axis,nexus,agora' },
            { name: 'accelerator', question: 'Accelerator (common/apparel/electronics/telco/combined)', defaultValue: 'common' },
            { name: 'cloneMode', question: 'Repository access (https/ssh/existing)', defaultValue: 'https' },
            { name: 'release', question: 'Branch or tag', defaultValue: 'development' }
        ];
    },

    normalizeQuestionnaireAnswer: function (name, value) {
        if (name === 'workspace') {
            return '--workspace=' + value;
        }
        if (name === 'cloneMode') {
            return '--clone=' + value;
        }
        return '--' + name + '=' + value;
    },

    promptField: async function (reader, field, scriptedAnswers) {
        if (scriptedAnswers && Object.prototype.hasOwnProperty.call(scriptedAnswers, field.name)) {
            return scriptedAnswers[field.name] || field.defaultValue;
        }
        return new Promise(resolve => {
            reader.question(field.question + ' [' + field.defaultValue + ']: ', answer => {
                resolve((answer || field.defaultValue).trim());
            });
        });
    },

    runQuestionnaire: async function (baseOptions, scriptedAnswers) {
        const fields = this.getQuestionnaireFields();
        const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
        const args = [];
        try {
            for (const field of fields) {
                const answer = await this.promptField(reader, field, scriptedAnswers);
                args.push(this.normalizeQuestionnaireAnswer(field.name, answer));
            }
        } finally {
            reader.close();
        }
        return this.mergeQuestionnaireOptions(baseOptions, this.parseOptions(args));
    },

    mergeQuestionnaireOptions: function (baseOptions, answers) {
        return {
            ...baseOptions,
            journey: answers.journey,
            workspace: answers.workspace,
            mode: answers.mode,
            apps: answers.apps,
            accelerator: answers.accelerator,
            cloneMode: answers.cloneMode,
            release: answers.release
        };
    },

    validateOptions: function (options) {
        const errors = [];
        if (!VALID_JOURNEYS.has(options.journey)) {
            errors.push('Unknown journey `' + options.journey + '`. Use reference or project.');
        }
        if (!VALID_MODES.has(options.mode)) {
            errors.push('Unknown local mode `' + options.mode + '`. Use node or docker.');
        }
        options.apps.forEach(app => {
            if (!VALID_APPS.has(app)) {
                errors.push('Unknown frontend app `' + app + '`. Use axis, nexus, or agora.');
            }
        });
        if (!VALID_ACCELERATORS.has(options.accelerator)) {
            errors.push('Unknown accelerator `' + options.accelerator + '`. Use common, apparel, electronics, telco, or combined.');
        }
        if (!VALID_ACTIONS.has(options.action)) {
            errors.push('Unknown action `' + options.action + '`. Use plan, questionnaire, preflight, or execute.');
        }
        if (!VALID_EXECUTION_LEVELS.has(options.executionLevel)) {
            errors.push('Unknown execution level `' + options.executionLevel + '`.');
        }
        if (!VALID_CLONE_MODES.has(options.cloneMode)) {
            errors.push('Unknown clone mode `' + options.cloneMode + '`. Use https, ssh, or existing.');
        }
        if (options.action === 'execute' && !options.yes) {
            errors.push('Execution requires --yes so the installer cannot mutate the machine by accident.');
        }
        if (options.journey === 'project') {
            errors.push('The custom project journey is documented but deferred until the reference local setup journey is stable.');
        }
        if (options.workspace === path.parse(options.workspace).root || options.workspace === os.homedir()) {
            errors.push('Workspace must be a dedicated folder, not the filesystem root or home directory.');
        }
        return { valid: errors.length === 0, errors };
    },

    resolveRepositoryUrl: function (repository, options) {
        return options.cloneMode === 'ssh' ? repository.ssh : repository.https;
    },

    selectedRepositories: function (options) {
        const repositories = [DEFAULT_REPOSITORIES.framework, DEFAULT_REPOSITORIES.kickoff];
        if (options.apps.length > 0) {
            repositories.push(DEFAULT_REPOSITORIES.experience);
            options.apps.forEach(app => repositories.push(FRONTEND_REPOSITORIES[app]));
        }
        return repositories.map(repository => ({
            ...repository,
            repository: this.resolveRepositoryUrl(repository, options),
            release: options.release,
            targetPath: repository.type ?
                path.join(options.workspace, 'nodics.exp', repository.name) :
                path.join(options.workspace, repository.name)
        }));
    },

    normalizeCommands: function (commands) {
        return commands
            .filter(command => command.when !== false)
            .map(command => {
                if (command.when === true) {
                    const { when, ...withoutWhen } = command;
                    return withoutWhen;
                }
                return command;
            });
    },

    nodeCommands: function (options) {
        const kickoff = path.join(options.workspace, 'nodics.kickoff');
        const exp = path.join(options.workspace, 'nodics.exp');
        const apps = options.apps.join(',');
        const commands = [
            { stage: 'configure', cwd: kickoff, command: 'copy .env.example to .env when .env is absent' },
            { stage: 'configure', cwd: kickoff, command: 'set NODICS_FRAMEWORK_ROOT=../nodics.ai in .env' },
            { stage: 'configure', cwd: kickoff, command: 'npm run configure:framework' },
            { stage: 'install', cwd: path.join(options.workspace, 'nodics.ai'), command: 'npm ci or npm install' },
            { stage: 'install', cwd: kickoff, command: 'npm ci or npm install' },
            { stage: 'install', cwd: exp, command: 'npm run apps:fetch -- --apps=' + apps, when: options.apps.length > 0 },
            ...options.apps.map(app => ({
                stage: 'install',
                cwd: path.join(exp, FRONTEND_REPOSITORIES[app].name),
                command: 'npm ci or npm install',
                when: 'frontend app `' + app + '` is selected'
            })),
            { stage: 'install', cwd: exp, command: 'npm run apps:verify -- --apps=' + apps, when: options.apps.length > 0 },
            { stage: 'preflight', cwd: kickoff, command: 'npm run topology:preflight' },
            { stage: 'start', cwd: kickoff, command: 'npm run topology:start:all', when: options.apps.length > 0 },
            { stage: 'start', cwd: kickoff, command: 'npm run topology:start', when: options.apps.length === 0 },
            { stage: 'initialize', cwd: kickoff, command: 'npm run acceptance:guided-initialization', when: options.accelerator !== 'common' },
            { stage: 'acceptance', cwd: kickoff, command: 'npm run acceptance:local:fresh', when: options.acceptance },
            { stage: 'acceptance', cwd: kickoff, command: 'npm run test:multi-domain', when: options.accelerator === 'combined' }
        ];
        return this.normalizeCommands(commands);
    },

    dockerCommands: function (options) {
        const kickoff = path.join(options.workspace, 'nodics.kickoff');
        const commands = [
            { stage: 'configure', cwd: kickoff, command: 'copy .env.example to .env when .env is absent' },
            { stage: 'configure', cwd: kickoff, command: 'set NODICS_FRAMEWORK_ROOT=../nodics.ai in .env' },
            { stage: 'configure', cwd: kickoff, command: 'npm run configure:framework' },
            { stage: 'install', cwd: kickoff, command: 'npm ci or npm install' },
            { stage: 'preflight', cwd: kickoff, command: 'npm run docker-local:preflight' },
            { stage: 'start', cwd: kickoff, command: 'npm run docker-local:build' },
            { stage: 'start', cwd: kickoff, command: 'npm run docker-local:start' },
            { stage: 'acceptance', cwd: kickoff, command: 'npm run docker-local:acceptance', when: options.acceptance }
        ];
        return this.normalizeCommands(commands);
    },

    expectedUrls: function (options) {
        if (options.mode === 'docker') {
            return {
                axis: options.apps.includes('axis') ? 'http://localhost:4100' : undefined,
                nexus: options.apps.includes('nexus') ? 'http://localhost:4200' : undefined,
                agora: options.apps.includes('agora') ? 'http://localhost:4300' : undefined,
                platform: 'http://localhost:5300',
                wcmsStaged: 'http://localhost:5312',
                wcmsOnline: 'http://localhost:5314',
                process: 'http://localhost:5330',
                engagement: 'http://localhost:5340',
                commerce: 'http://localhost:5350'
            };
        }
        return {
            axis: options.apps.includes('axis') ? 'http://localhost:3100' : undefined,
            nexus: options.apps.includes('nexus') ? 'http://localhost:3200' : undefined,
            agora: options.apps.includes('agora') ? 'http://localhost:3300' : undefined,
            platform: 'http://localhost:4300',
            wcmsStaged: 'http://localhost:4312',
            wcmsOnline: 'http://localhost:4314',
            process: 'http://localhost:4330',
            engagement: 'http://localhost:4340',
            commerce: 'http://localhost:4350'
        };
    },

    createSetupPlan: function (options) {
        const validation = this.validateOptions(options);
        if (!validation.valid) {
            const error = new Error('Nodics Installer options need correction:\n- ' + validation.errors.join('\n- '));
            error.validation = validation;
            throw error;
        }
        const profile = ACCELERATOR_PROFILES[options.accelerator];
        const repositories = this.selectedRepositories(options);
        return {
            contractVersion: 1,
            operation: options.action === 'execute' ? 'local-setup-execution' : 'local-setup-plan',
            dryRun: options.action !== 'execute',
            writePerformed: false,
            executionSupported: true,
            installer: {
                packageName: 'nodics.installer',
                version: VERSION,
                bootstrapCommand: 'npx github:Nodics/nodics.installer'
            },
            beginnerChoices: {
                journey: 'Run Nodics locally with the reference Kickoff project',
                workspace: options.workspace,
                localMode: options.mode === 'docker' ? 'Docker Local production-simulation' : 'Direct Node.js local processes',
                apps: options.apps,
                accelerator: options.accelerator,
                release: options.release,
                cloneMode: options.cloneMode
            },
            enterpriseOptions: {
                proxy: options.proxy || undefined,
                npmRegistry: options.npmRegistry || undefined,
                offlineCache: options.offlineCache || undefined,
                policyPack: options.policyPack || undefined,
                evidenceRequired: true,
                secretsPrinted: false
            },
            accelerator: {
                code: options.accelerator,
                domains: profile.domains,
                dataPacks: profile.dataPacks,
                gates: profile.gates
            },
            prerequisites: [
                { code: 'node', command: 'node --version', required: true },
                { code: 'npm', command: 'npm --version', required: true },
                { code: 'git', command: 'git --version', required: true },
                { code: 'docker', command: 'docker --version', required: options.mode === 'docker' }
            ],
            repositories,
            setupSteps: [
                'Inspect machine prerequisites and busy ports.',
                'Resolve and protect the selected workspace.',
                'Download or reuse required Nodics repositories.',
                'Configure Kickoff framework links.',
                'Install dependencies in framework, project, and selected frontend apps.',
                'Run local preflight before starting services.',
                'Start the selected backend and frontend topology when requested by execution level.',
                'Run guided initialization when sample or accelerator data is selected.',
                'Write setup evidence without secret values.'
            ],
            commands: options.mode === 'docker' ? this.dockerCommands(options) : this.nodeCommands(options),
            safetyRules: [
                'Plan and preflight actions do not clone, install, start, reset, or write project repositories.',
                'Execute requires --yes.',
                'Dirty existing repositories are refused instead of overwritten.',
                'Secrets are sanitized from command output before evidence is written.',
                'Production certification is not claimed from local setup evidence.'
            ],
            evidencePath: path.join(options.workspace, '.nodics-installer', 'setup-evidence.json'),
            expectedUrls: this.expectedUrls(options)
        };
    },

    renderTextPlan: function (plan) {
        const lines = [
            'Nodics Installer setup plan',
            '',
            'Bootstrap command: ' + plan.installer.bootstrapCommand,
            'Workspace: ' + plan.beginnerChoices.workspace,
            'Mode: ' + plan.beginnerChoices.localMode,
            'Apps: ' + plan.beginnerChoices.apps.join(', '),
            'Starter experience: ' + plan.beginnerChoices.accelerator,
            'Branch/tag: ' + plan.beginnerChoices.release,
            'Repository access: ' + plan.beginnerChoices.cloneMode,
            'Evidence: ' + plan.evidencePath,
            '',
            plan.dryRun ? 'This is a dry run. No setup changes were made.' : 'Execution plan approved.'
        ];
        lines.push('', 'Accelerator:');
        lines.push('- Domains: ' + plan.accelerator.domains.join(', '));
        lines.push('- Data packs: ' + plan.accelerator.dataPacks.join(', '));
        lines.push('', 'Repositories:');
        plan.repositories.forEach(repository => {
            lines.push('- ' + repository.name + ' -> ' + repository.targetPath);
        });
        lines.push('', 'Steps:');
        plan.setupSteps.forEach((step, index) => lines.push(String(index + 1) + '. ' + step));
        lines.push('', 'Planned commands:');
        plan.commands.forEach(command => {
            const suffix = command.when ? ' (' + command.when + ')' : '';
            lines.push('- ' + command.stage + ' [' + command.cwd + '] ' + command.command + suffix);
        });
        lines.push('', 'Expected URLs:');
        Object.entries(plan.expectedUrls).filter(([, value]) => value).forEach(([key, value]) => {
            lines.push('- ' + key + ': ' + value);
        });
        return lines.join('\n');
    },

    sanitizeOutput: function (value) {
        return String(value || '')
            .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[redacted-github-token]')
            .replace(/(authorization:\s*bearer\s+)[^\s]+/ig, '$1[redacted]')
            .replace(/((?:token|password|secret)=)[^\s&]+/ig, '$1[redacted]');
    },

    runCommand: function (executable, args, options) {
        const startedAt = new Date().toISOString();
        const result = childProcess.spawnSync(executable, args || [], {
            cwd: options.cwd,
            env: options.env || process.env,
            encoding: 'utf8',
            shell: false
        });
        const entry = {
            command: [executable, ...(args || [])].join(' '),
            cwd: options.cwd,
            status: result.status === 0 ? 'passed' : 'failed',
            exitCode: result.status,
            stdout: this.sanitizeOutput(result.stdout),
            stderr: this.sanitizeOutput(result.stderr),
            startedAt,
            finishedAt: new Date().toISOString()
        };
        if (result.error) {
            entry.status = 'failed';
            entry.stderr = this.sanitizeOutput(result.error.message);
            if (options.allowFailure) {
                return entry;
            }
            throw result.error;
        }
        if (entry.status === 'failed' && !options.allowFailure) {
            const error = new Error('Command failed: ' + entry.command + '\n' + entry.stderr);
            error.commandResult = entry;
            throw error;
        }
        return entry;
    },

    portListening: function (port) {
        return new Promise(resolve => {
            const socket = new net.Socket();
            socket.setTimeout(500);
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.once('error', () => resolve(false));
            socket.connect(port, '127.0.0.1');
        });
    },

    preflight: async function (plan, options) {
        const checks = [];
        const commandMap = { node: ['node', ['--version']], npm: ['npm', ['--version']], git: ['git', ['--version']], docker: ['docker', ['--version']] };
        for (const prerequisite of plan.prerequisites) {
            if (!prerequisite.required && prerequisite.code === 'docker') {
                checks.push({ code: 'docker', required: false, status: 'skipped' });
                continue;
            }
            const [executable, commandArgs] = commandMap[prerequisite.code];
            const result = this.runCommand(executable, commandArgs, { cwd: process.cwd(), allowFailure: true });
            checks.push({
                code: prerequisite.code,
                required: prerequisite.required,
                status: result.status,
                version: result.stdout.trim() || result.stderr.trim()
            });
        }
        const workspaceParent = path.dirname(options.workspace);
        checks.push({
            code: 'workspace-parent',
            required: true,
            status: fs.existsSync(workspaceParent) ? 'passed' : 'failed',
            path: workspaceParent
        });
        const ports = Object.values(plan.expectedUrls)
            .filter(Boolean)
            .map(value => Number(new URL(value).port))
            .filter(Boolean);
        for (const port of Array.from(new Set(ports))) {
            const busy = await this.portListening(port);
            checks.push({ code: 'port-' + port, required: true, status: busy ? 'failed' : 'passed', busy });
        }
        return {
            operation: 'local-setup-preflight',
            ok: checks.every(check => check.status === 'passed' || check.status === 'skipped' || !check.required),
            checks
        };
    },

    createEvidence: function (plan, options) {
        return {
            contractVersion: 1,
            operation: 'local-setup-evidence',
            workspace: options.workspace,
            action: options.action,
            executionLevel: options.executionLevel,
            release: options.release,
            startedAt: new Date().toISOString(),
            finishedAt: undefined,
            plan,
            steps: []
        };
    },

    readEvidence: function (evidencePath) {
        if (!fs.existsSync(evidencePath)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    },

    writeEvidence: function (evidencePath, evidence) {
        fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
        fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2) + '\n');
    },

    stepCompleted: function (evidence, code) {
        return evidence.steps.some(step => step.code === code && step.status === 'passed');
    },

    recordStep: function (evidence, evidencePath, step) {
        evidence.steps.push({
            ...step,
            timestamp: new Date().toISOString()
        });
        this.writeEvidence(evidencePath, evidence);
    },

    ensureWorkspace: function (workspace) {
        fs.mkdirSync(workspace, { recursive: true });
    },

    isGitCheckout: function (targetPath) {
        return fs.existsSync(path.join(targetPath, '.git'));
    },

    assertCleanCheckout: function (targetPath) {
        const status = this.runCommand('git', ['status', '--short'], { cwd: targetPath, allowFailure: false });
        if (status.stdout.trim()) {
            throw new Error('Refusing to reuse dirty repository: ' + targetPath);
        }
    },

    switchRelease: function (targetPath, release) {
        const localSwitch = this.runCommand('git', ['switch', release], { cwd: targetPath, allowFailure: true });
        if (localSwitch.status === 'passed') {
            return;
        }
        this.runCommand('git', ['switch', '-c', release, 'origin/' + release], { cwd: targetPath, allowFailure: false });
    },

    prepareRepositories: function (plan, options) {
        this.ensureWorkspace(options.workspace);
        const prepared = [];
        for (const repository of plan.repositories) {
            fs.mkdirSync(path.dirname(repository.targetPath), { recursive: true });
            if (fs.existsSync(repository.targetPath)) {
                if (!this.isGitCheckout(repository.targetPath)) {
                    throw new Error('Target exists but is not a Git checkout: ' + repository.targetPath);
                }
                this.assertCleanCheckout(repository.targetPath);
                this.runCommand('git', ['fetch', 'origin', '--prune'], { cwd: repository.targetPath, allowFailure: false });
                this.switchRelease(repository.targetPath, repository.release);
                this.runCommand('git', ['pull', '--ff-only', 'origin', repository.release], { cwd: repository.targetPath, allowFailure: false });
                prepared.push({ repository: repository.name, action: 'reused', targetPath: repository.targetPath });
                continue;
            }
            if (options.cloneMode === 'existing') {
                throw new Error('Repository is required but missing in --clone=existing mode: ' + repository.targetPath);
            }
            this.runCommand('git', ['clone', '--branch', repository.release, repository.repository, repository.targetPath],
                { cwd: options.workspace, allowFailure: false });
            prepared.push({ repository: repository.name, action: 'cloned', targetPath: repository.targetPath });
        }
        return prepared;
    },

    configureKickoff: function (plan, options) {
        const kickoff = path.join(options.workspace, 'nodics.kickoff');
        const envPath = path.join(kickoff, '.env');
        const examplePath = path.join(kickoff, '.env.example');
        if (!fs.existsSync(envPath)) {
            if (fs.existsSync(examplePath)) {
                fs.copyFileSync(examplePath, envPath);
            } else {
                fs.writeFileSync(envPath, 'NODICS_FRAMEWORK_ROOT=../nodics.ai\n');
            }
        }
        const content = fs.readFileSync(envPath, 'utf8');
        const nextContent = content.match(/^NODICS_FRAMEWORK_ROOT=/m) ?
            content.replace(/^NODICS_FRAMEWORK_ROOT=.*/m, 'NODICS_FRAMEWORK_ROOT=../nodics.ai') :
            content.replace(/\s*$/, '\nNODICS_FRAMEWORK_ROOT=../nodics.ai\n');
        fs.writeFileSync(envPath, nextContent);
        return this.runKickoffCommand(options, 'configure:framework', [], false);
    },

    packageInstallCommand: function (packagePath, options) {
        const commandArgs = fs.existsSync(path.join(packagePath, 'package-lock.json')) ? ['ci'] : ['install'];
        if (options.npmRegistry) {
            commandArgs.push('--registry', options.npmRegistry);
        }
        return this.runCommand('npm', commandArgs, { cwd: packagePath, allowFailure: false });
    },

    installDependencies: function (plan, options) {
        const roots = [
            path.join(options.workspace, 'nodics.ai'),
            path.join(options.workspace, 'nodics.kickoff')
        ];
        if (options.apps.length > 0) {
            roots.push(path.join(options.workspace, 'nodics.exp'));
            options.apps.forEach(app => roots.push(path.join(options.workspace, 'nodics.exp', FRONTEND_REPOSITORIES[app].name)));
        }
        return roots.map(root => this.packageInstallCommand(root, options));
    },

    runKickoffCommand: function (options, script, commandArgs, allowFailure) {
        return this.runCommand('npm', ['run', script, ...(commandArgs || [])], {
            cwd: path.join(options.workspace, 'nodics.kickoff'),
            allowFailure: Boolean(allowFailure)
        });
    },

    executeSetup: async function (plan, options) {
        const evidence = this.readEvidence(plan.evidencePath) || this.createEvidence(plan, options);
        const runStage = (code, label, callback) => {
            if (this.stepCompleted(evidence, code)) {
                return;
            }
            const result = callback();
            this.recordStep(evidence, plan.evidencePath, { code, label, status: 'passed', result });
        };
        runStage('download', 'Download or reuse repositories', () => this.prepareRepositories(plan, options));
        if (options.executionLevel === 'download') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        runStage('configure', 'Configure Kickoff framework link', () => this.configureKickoff(plan, options));
        runStage('install', 'Install dependencies', () => this.installDependencies(plan, options));
        if (options.executionLevel === 'install') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        if (!this.stepCompleted(evidence, 'preflight')) {
            const preflightResult = await this.preflight(plan, options);
            this.recordStep(evidence, plan.evidencePath, {
                code: 'preflight',
                label: 'Run local preflight',
                status: preflightResult.ok ? 'passed' : 'failed',
                result: preflightResult
            });
            if (!preflightResult.ok) {
                throw new Error('Preflight failed. See evidence: ' + plan.evidencePath);
            }
        }
        if (options.executionLevel === 'preflight') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        runStage('start', 'Start topology', () => options.mode === 'docker' ?
            this.runKickoffCommand(options, 'docker-local:start', [], false) :
            this.runKickoffCommand(options, options.apps.length > 0 ? 'topology:start:all' : 'topology:start', [], false));
        if (options.executionLevel === 'start') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        if (options.accelerator !== 'common' || options.initialize || options.sampleData || options.freshData) {
            runStage('initialize', 'Run guided initialization', () =>
                this.runKickoffCommand(options, 'acceptance:guided-initialization', [], false));
        }
        if (options.executionLevel === 'initialize') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        if (options.acceptance) {
            runStage('acceptance', 'Run acceptance checks', () => options.mode === 'docker' ?
                this.runKickoffCommand(options, 'docker-local:acceptance', [], false) :
                this.runKickoffCommand(options, 'acceptance:local:fresh', [], false));
        }
        evidence.finishedAt = new Date().toISOString();
        this.writeEvidence(plan.evidencePath, evidence);
        return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
    },

    printResult: function (options, result, textRenderer) {
        console.log(options.json ? JSON.stringify(result, null, 2) : textRenderer(result));
    },

    run: async function (args) {
        if (this.hasFlag(args, '--help')) {
            console.log(this.usage());
            return true;
        }
        let options = this.parseOptions(args);
        if (options.action === 'questionnaire') {
            options = await this.runQuestionnaire(options);
        }
        const plan = this.createSetupPlan(options);
        if (options.action === 'preflight') {
            const result = await this.preflight(plan, options);
            this.printResult(options, result, preflight =>
                'Nodics Installer preflight ' + (preflight.ok ? 'passed' : 'failed') + '\n' +
                preflight.checks.map(check => '- ' + check.code + ': ' + check.status).join('\n'));
            return true;
        }
        if (options.action === 'execute') {
            const result = await this.executeSetup(plan, options);
            this.printResult(options, result, execution =>
                'Nodics Installer execution completed\nEvidence: ' + execution.evidencePath);
            return true;
        }
        console.log(options.json ? JSON.stringify(plan, null, 2) : this.renderTextPlan(plan));
        return true;
    }
};

module.exports = installer;
