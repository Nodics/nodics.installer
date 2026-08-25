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

const VERSION = '0.7.0';
const REBRAND_STAGE_VERSION = VERSION + ':project-runtime-identity-v6';
const START_STAGE_VERSION = VERSION + ':detached-topology-start-v1';
const VALID_JOURNEYS = new Set(['reference', 'project']);
const VALID_MODES = new Set(['node', 'docker']);
const VALID_APPS = new Set(['axis']);
const VALID_ACCELERATORS = new Set(['common', 'apparel', 'electronics', 'telco', 'combined']);
const VALID_ACTIONS = new Set([
    'plan', 'questionnaire', 'preflight', 'doctor', 'execute', 'status', 'start', 'stop', 'restart', 'logs',
    'initialize', 'acceptance', 'repair', 'clean', 'troubleshooting', 'version'
]);
const MUTATING_ACTIONS = new Set(['execute', 'start', 'stop', 'restart', 'initialize', 'acceptance', 'repair', 'clean']);
const VALID_EXECUTION_LEVELS = new Set(['download', 'install', 'preflight', 'start', 'initialize', 'acceptance']);
const VALID_CLONE_MODES = new Set(['https', 'ssh', 'existing']);

const DEFAULT_REPOSITORIES = Object.freeze({
    framework: {
        code: 'framework',
        name: 'nodics.ai',
        https: 'https://github.com/Nodics/nodics.ai.git',
        ssh: 'git@github.com:Nodics/nodics.ai.git'
    },
    applicationTemplate: {
        code: 'application-template',
        name: 'nodics.kickoff',
        https: 'https://github.com/Nodics/nodics.kickoff.git',
        ssh: 'git@github.com:Nodics/nodics.kickoff.git'
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
    applicationWebTemplate: {
        code: 'application-web-template',
        name: 'nodics.agora',
        https: 'https://github.com/Nodics/nodics.agora.git',
        ssh: 'git@github.com:Nodics/nodics.agora.git',
        type: 'commerce-site'
    },
    companySiteTemplate: {
        code: 'company-site-template',
        name: 'nodics.nexus',
        https: 'https://github.com/Nodics/nodics.nexus.git',
        ssh: 'git@github.com:Nodics/nodics.nexus.git',
        type: 'company-site'
    }
});

const ACCELERATOR_PROFILES = Object.freeze({
    common: {
        domains: ['common'],
        requiredApps: [],
        dataPacks: ['commonData'],
        gates: ['topology preflight']
    },
    apparel: {
        domains: ['common', 'apparel'],
        requiredApps: [],
        dataPacks: ['commonData', 'apparelData'],
        gates: ['guided initialization', 'application commerce data']
    },
    electronics: {
        domains: ['common', 'electronics'],
        requiredApps: [],
        dataPacks: ['commonData', 'electronicsData'],
        gates: ['guided initialization', 'application commerce data']
    },
    telco: {
        domains: ['common', 'electronics', 'telco'],
        requiredApps: [],
        dataPacks: ['commonData', 'telcoData'],
        gates: ['guided initialization', 'telco commerce data']
    },
    combined: {
        domains: ['common', 'apparel', 'electronics', 'telco'],
        requiredApps: [],
        dataPacks: ['commonData', 'apparelData', 'electronicsData', 'telcoData'],
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

    toApplicationSlug: function (value) {
        return String(value || 'my-nodics-app')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9.]+/g, '-')
            .replace(/^[.-]+|[.-]+$/g, '') || 'my-nodics-app';
    },

    toApplicationTitle: function (value) {
        return String(value || 'My Nodics App')
            .trim()
            .replace(/\s+/g, ' ');
    },

    toDisplayTitle: function (value, fallback) {
        const source = String(value || fallback || 'My Nodics App')
            .trim()
            .replace(/[._-]+/g, ' ')
            .replace(/\s+/g, ' ');
        return source.split(' ')
            .filter(Boolean)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ') || 'My Nodics App';
    },

    toLowerCamelIdentifier: function (value, fallback) {
        const words = String(value || fallback || 'my-nodics-app')
            .trim()
            .toLowerCase()
            .split(/[^a-z0-9]+/g)
            .filter(Boolean);
        const identifier = words.map((word, index) => {
            if (index === 0) {
                return word;
            }
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join('');
        if (!identifier) {
            return 'myNodicsApp';
        }
        return /^[a-z]/.test(identifier) ? identifier : 'app' + identifier.charAt(0).toUpperCase() + identifier.slice(1);
    },

    toUpperCamelIdentifier: function (value, fallback) {
        const lowerCamel = this.toLowerCamelIdentifier(value, fallback);
        return lowerCamel.charAt(0).toUpperCase() + lowerCamel.slice(1);
    },

    toDockerIdentifier: function (value, fallback) {
        return String(value || fallback || 'my-nodics-app')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'my-nodics-app';
    },

    defaultProjectName: function (applicationName) {
        return this.toApplicationSlug(applicationName) + '.startio';
    },

    defaultCompanySiteName: function (applicationName) {
        return this.toApplicationSlug(applicationName) + '.web';
    },

    defaultCommerceSiteName: function (applicationName, accelerator) {
        const commerceSuffixByAccelerator = {
            apparel: 'apparel',
            electronics: 'electronics',
            telco: 'telco',
            combined: 'commerce',
            common: 'commerce'
        };
        return this.toApplicationSlug(applicationName) + '.' + (commerceSuffixByAccelerator[accelerator] || 'commerce');
    },

    createApplicationIdentity: function (options) {
        const title = this.toApplicationTitle(options.applicationName);
        const slug = this.toApplicationSlug(options.applicationName);
        const dockerSlug = this.toDockerIdentifier(slug);
        const projectSlug = this.toApplicationSlug(options.projectName || this.defaultProjectName(options.applicationName));
        const commerceSlug = this.toApplicationSlug(options.commerceSiteName ||
            this.defaultCommerceSiteName(options.applicationName, options.accelerator));
        const companySlug = this.toApplicationSlug(options.companySiteName || this.defaultCompanySiteName(options.applicationName));
        const modulePrefix = this.toLowerCamelIdentifier(slug);
        const servicePrefix = this.toUpperCamelIdentifier(modulePrefix);
        return {
            name: title,
            code: slug,
            projectName: projectSlug,
            projectPath: path.join(options.workspace, projectSlug),
            modulePrefix,
            servicePrefix,
            coreModuleName: modulePrefix + 'Core',
            apiModuleName: modulePrefix + 'Api',
            integrationModuleName: modulePrefix + 'Int',
            localEnvironmentName: modulePrefix + 'Local',
            dockerLocalEnvironmentName: modulePrefix + 'DockerLocal',
            dockerSlug,
            dockerComposeProjectName: 'nodics-' + dockerSlug + '-docker-local',
            dockerBackendImageName: 'nodics/' + dockerSlug + '-backend',
            companySiteName: companySlug,
            companySiteTitle: this.toDisplayTitle(options.companySiteName, title),
            companySitePath: path.join(options.workspace, companySlug),
            commerceSiteName: commerceSlug,
            commerceSiteTitle: this.toDisplayTitle(options.commerceSiteName, title + ' Apparel'),
            commerceSitePath: path.join(options.workspace, commerceSlug),
            axisPath: path.join(options.workspace, 'nodics.axis')
        };
    },

    applicationDataPacks: function (options, profile) {
        const identity = options.application || this.createApplicationIdentity(options);
        return profile.dataPacks.map(dataPack => identity.code + '.' + dataPack);
    },

    usage: function () {
        return [
            'Nodics Installer',
            '',
            'Usage:',
            '  npx github:Nodics/nodics.installer [options]',
            '  npm start -- [options]',
            '',
            'Default start:',
            '  With no options in an interactive terminal, the installer asks guided',
            '  questions first. In non-interactive shells it prints the default plan.',
            '',
            'Beginner actions:',
            '  --action=plan             Print the setup plan only. Default.',
            '  --action=questionnaire    Ask guided setup questions, then print a plan.',
            '  --action=preflight        Check local machine prerequisites and ports.',
            '  --action=doctor           Check prerequisites and print fix guidance.',
            '  --action=execute --yes    Run the selected setup level with evidence.',
            '  --action=status           Show evidence, repository, topology, and URL status.',
            '  --action=start --yes      Start the selected topology.',
            '  --action=stop --yes       Stop the selected topology.',
            '  --action=restart --yes    Stop and start the selected topology.',
            '  --action=logs             Show topology log files and optional excerpts.',
            '  --action=initialize --yes Run guided initialization.',
            '  --action=acceptance --yes Run local acceptance checks.',
            '  --action=repair --yes     Reapply installer identity and framework links.',
            '  --action=clean --yes      Remove generated runtime files only.',
            '  --action=troubleshooting  Print known beginner failure signatures.',
            '  --action=version          Show installer version and supported actions.',
            '',
            'Options:',
            '  --journey=reference|project',
            '  --application-name="My Store"   Customer application name. Default: My Nodics App',
            '  --project-name=my-store.startio Backend/customer project code/folder.',
            '  --commerce-site-name=my-store.apparel',
            '                                  Commerce/apparel site folder. Default: <app>.<accelerator>',
            '  --company-site-name=my-store.web Company site folder. Default: <app>.web',
            '  --workspace=/absolute/path       Default: ~/Nodics/nodicsRoot',
            '  --mode=node|docker               Default: node',
            '  --apps=axis                      Standard apps to include. Default: axis',
            '  --without-commerce-site          Do not create a commerce/apparel site.',
            '  --without-company-site           Do not create a company site.',
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
            '  --runtime=platform                Select runtime for logs.',
            '  --lines=80                        Number of log lines to show. Default: 80.',
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
        const applicationName = this.readOption(args, '--application-name',
            this.readOption(args, '--application', 'My Nodics App'));
        const projectName = this.readOption(args, '--project-name', '');
        const commerceSiteName = this.readOption(args, '--commerce-site-name',
            this.readOption(args, '--storefront-name', ''));
        const companySiteName = this.readOption(args, '--company-site-name', '');
        const accelerator = this.readOption(args, '--accelerator', 'common').toLowerCase();
        const explicitApps = this.readOption(args, '--apps', null);
        const defaultApps = explicitApps === null ? ['axis'] : [];
        const requestedApps = this.readCsvOption(args, '--apps', defaultApps);
        const requiredApps = ACCELERATOR_PROFILES[accelerator] ? ACCELERATOR_PROFILES[accelerator].requiredApps : [];
        const apps = Array.from(new Set([...requestedApps, ...requiredApps]));
        const action = this.readOption(args, '--action', 'plan').toLowerCase();
        const explicitExecutionLevel = this.readOption(args, '--execution-level', null);
        let executionLevel = explicitExecutionLevel || 'preflight';
        if (!explicitExecutionLevel && action === 'start') {
            executionLevel = 'start';
        }
        if (!explicitExecutionLevel && action === 'initialize') {
            executionLevel = 'initialize';
        }
        if (!explicitExecutionLevel && action === 'acceptance') {
            executionLevel = 'acceptance';
        }
        if (!explicitExecutionLevel && this.hasFlag(args, '--start')) {
            executionLevel = 'start';
        }
        if (!explicitExecutionLevel && this.hasFlag(args, '--initialize')) {
            executionLevel = 'initialize';
        }
        if (!explicitExecutionLevel && this.hasFlag(args, '--acceptance')) {
            executionLevel = 'acceptance';
        }
        const options = {
            journey: this.readOption(args, '--journey', 'reference').toLowerCase(),
            workspace: path.resolve(workspace),
            applicationName,
            projectName,
            commerceSiteName,
            companySiteName,
            mode: this.readOption(args, '--mode', 'node').toLowerCase(),
            apps,
            commerceSite: !this.hasFlag(args, '--without-commerce-site') && !this.hasFlag(args, '--without-web'),
            companySite: !this.hasFlag(args, '--without-company-site'),
            accelerator,
            action,
            executionLevel: executionLevel.toLowerCase(),
            cloneMode: this.readOption(args, '--clone', 'https').toLowerCase(),
            release: this.readOption(args, '--release', 'development'),
            sampleData: this.hasFlag(args, '--sample-data'),
            freshData: this.hasFlag(args, '--fresh-data'),
            start: this.hasFlag(args, '--start') || action === 'start',
            initialize: this.hasFlag(args, '--initialize') || action === 'initialize',
            acceptance: this.hasFlag(args, '--acceptance') || action === 'acceptance',
            yes: this.hasFlag(args, '--yes'),
            json: this.hasFlag(args, '--json'),
            proxy: this.readOption(args, '--proxy', ''),
            npmRegistry: this.readOption(args, '--npm-registry', ''),
            offlineCache: this.readOption(args, '--offline-cache', ''),
            policyPack: this.readOption(args, '--policy-pack', ''),
            runtime: this.readOption(args, '--runtime', ''),
            lines: Number(this.readOption(args, '--lines', '80')) || 80
        };
        options.application = this.createApplicationIdentity(options);
        return options;
    },

    getQuestionnaireFields: function () {
        return [
            { name: 'journey', question: 'Setup style (reference/project)', defaultValue: 'reference' },
            { name: 'applicationName', question: 'Application name', defaultValue: 'My Nodics App' },
            { name: 'accelerator', question: 'Accelerator (common/apparel/electronics/telco/combined)', defaultValue: 'common' },
            { name: 'commerceSiteName', question: 'Commerce/apparel site name', defaultValue: answers => this.defaultCommerceSiteName(answers.applicationName || 'My Nodics App', answers.accelerator || 'common') },
            { name: 'companySiteName', question: 'Company site name', defaultValue: answers => this.defaultCompanySiteName(answers.applicationName || 'My Nodics App') },
            {
                name: 'projectName',
                question: 'Backend project code/folder',
                defaultValue: answers => this.defaultProjectName(answers.applicationName || 'My Nodics App')
            },
            { name: 'workspace', question: 'Workspace folder', defaultValue: path.join(os.homedir(), 'Nodics', 'nodicsRoot') },
            { name: 'mode', question: 'Runtime mode (node/docker)', defaultValue: 'node' },
            { name: 'apps', question: 'Standard applications (axis)', defaultValue: 'axis' },
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
        if (name === 'applicationName') {
            return '--application-name=' + value;
        }
        if (name === 'commerceSiteName') {
            return '--commerce-site-name=' + value;
        }
        if (name === 'companySiteName') {
            return '--company-site-name=' + value;
        }
        if (name === 'projectName') {
            return '--project-name=' + value;
        }
        return '--' + name + '=' + value;
    },

    resolveQuestionDefault: function (field, answers) {
        return typeof field.defaultValue === 'function' ? field.defaultValue(answers || {}) : field.defaultValue;
    },

    promptField: async function (reader, field, scriptedAnswers, answers) {
        const defaultValue = this.resolveQuestionDefault(field, answers);
        if (scriptedAnswers && Object.prototype.hasOwnProperty.call(scriptedAnswers, field.name)) {
            return scriptedAnswers[field.name] || defaultValue;
        }
        return new Promise(resolve => {
            reader.question(field.question + ' [' + defaultValue + ']: ', answer => {
                resolve((answer || defaultValue).trim());
            });
        });
    },

    runQuestionnaire: async function (baseOptions, scriptedAnswers) {
        const fields = this.getQuestionnaireFields();
        const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
        const args = [];
        const answers = {};
        try {
            for (const field of fields) {
                const answer = await this.promptField(reader, field, scriptedAnswers, answers);
                answers[field.name] = answer;
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
            applicationName: answers.applicationName,
            projectName: answers.projectName,
            commerceSiteName: answers.commerceSiteName,
            companySiteName: answers.companySiteName,
            application: answers.application,
            workspace: answers.workspace,
            mode: answers.mode,
            apps: answers.apps,
            accelerator: answers.accelerator,
            cloneMode: answers.cloneMode,
            release: answers.release
        };
    },

    shouldRunStartupQuestionnaire: function (args, options, streams) {
        const input = streams && streams.input ? streams.input : process.stdin;
        const output = streams && streams.output ? streams.output : process.stdout;
        const hasExplicitAction = (args || []).some(argument => argument.startsWith('--action='));
        const hasHelp = this.hasFlag(args, '--help');
        return !hasHelp &&
            !hasExplicitAction &&
            (args || []).length === 0 &&
            options.action === 'plan' &&
            !options.json &&
            Boolean(input.isTTY) &&
            Boolean(output.isTTY);
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
                errors.push('Unknown standard app `' + app + '`. Use axis. Customer-facing apps are named with --application-name.');
            }
        });
        const validSlug = /^[a-z0-9][a-z0-9-.]*[a-z0-9]$|^[a-z0-9]$/;
        if (!options.application || !validSlug.test(options.application.code)) {
            errors.push('Application name must contain at least one letter or number.');
        }
        ['projectName', 'companySiteName', 'commerceSiteName'].forEach(field => {
            if (options.application && !validSlug.test(options.application[field])) {
                errors.push(field + ' must contain at least one letter or number.');
            }
        });
        if (options.application && /(^|[.-])project$/.test(options.application.projectName)) {
            errors.push('Backend project name must be specific, for example acme.startio. Do not use a generic .project or -project suffix.');
        }
        if (options.application) {
            const generatedPaths = [
                options.application.projectPath,
                options.application.axisPath
            ];
            if (options.companySite) {
                generatedPaths.push(options.application.companySitePath);
            }
            if (options.commerceSite) {
                generatedPaths.push(options.application.commerceSitePath);
            }
            if (new Set(generatedPaths).size !== generatedPaths.length) {
                errors.push('Generated project, company site, commerce site, and Axis paths must be unique.');
            }
        }
        if (!VALID_ACCELERATORS.has(options.accelerator)) {
            errors.push('Unknown accelerator `' + options.accelerator + '`. Use common, apparel, electronics, telco, or combined.');
        }
        if (!VALID_ACTIONS.has(options.action)) {
            errors.push('Unknown action `' + options.action + '`. Use plan, questionnaire, preflight, doctor, execute, status, start, stop, restart, logs, initialize, acceptance, repair, clean, troubleshooting, or version.');
        }
        if (!VALID_EXECUTION_LEVELS.has(options.executionLevel)) {
            errors.push('Unknown execution level `' + options.executionLevel + '`.');
        }
        if (!VALID_CLONE_MODES.has(options.cloneMode)) {
            errors.push('Unknown clone mode `' + options.cloneMode + '`. Use https, ssh, or existing.');
        }
        if (MUTATING_ACTIONS.has(options.action) && !options.yes) {
            errors.push('Action `' + options.action + '` requires --yes so the installer cannot mutate the machine by accident.');
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
        const repositories = [
            {
                ...DEFAULT_REPOSITORIES.framework,
                targetName: DEFAULT_REPOSITORIES.framework.name
            },
            {
                ...DEFAULT_REPOSITORIES.applicationTemplate,
                code: 'application',
                targetName: options.application.projectName,
                sourceTemplate: DEFAULT_REPOSITORIES.applicationTemplate.name
            }
        ];
        if (options.apps.includes('axis')) {
            repositories.push({
                ...FRONTEND_REPOSITORIES.axis,
                targetName: FRONTEND_REPOSITORIES.axis.name
            });
        }
        if (options.commerceSite) {
            repositories.push({
                ...FRONTEND_REPOSITORIES.applicationWebTemplate,
                code: 'commerce-site',
                targetName: options.application.commerceSiteName,
                sourceTemplate: FRONTEND_REPOSITORIES.applicationWebTemplate.name
            });
        }
        if (options.companySite) {
            repositories.push({
                ...FRONTEND_REPOSITORIES.companySiteTemplate,
                code: 'company-site',
                targetName: options.application.companySiteName,
                sourceTemplate: FRONTEND_REPOSITORIES.companySiteTemplate.name
            });
        }
        return repositories.map(repository => {
            const target = {
                code: repository.code,
                name: repository.targetName || repository.name,
                type: repository.type,
                release: options.release,
                targetPath: repository.code === 'application' ? options.application.projectPath :
                    repository.code === 'commerce-site' ? options.application.commerceSitePath :
                        repository.code === 'company-site' ? options.application.companySitePath :
                        repository.code === 'axis' ? options.application.axisPath :
                            path.join(options.workspace, repository.name)
            };
            Object.defineProperty(target, 'repository', {
                value: this.resolveRepositoryUrl(repository, options),
                enumerable: false
            });
            return target;
        });
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
        const project = options.application.projectPath;
        const commands = [
            { stage: 'configure', cwd: project, command: 'copy .env.example to .env when .env is absent' },
            { stage: 'configure', cwd: project, command: 'set NODICS_FRAMEWORK_ROOT=../nodics.ai in .env' },
            { stage: 'configure', cwd: project, command: 'set NODICS_APPLICATION_NAME=' + options.application.name + ' in .env' },
            { stage: 'configure', cwd: project, command: 'npm run configure:framework' },
            { stage: 'install', cwd: path.join(options.workspace, 'nodics.ai'), command: 'npm ci or npm install' },
            { stage: 'install', cwd: project, command: 'npm ci or npm install' },
            { stage: 'install', cwd: options.application.axisPath, command: 'npm ci or npm install', when: options.apps.includes('axis') },
            { stage: 'install', cwd: options.application.companySitePath, command: 'npm ci or npm install', when: options.companySite },
            { stage: 'install', cwd: options.application.commerceSitePath, command: 'npm ci or npm install', when: options.commerceSite },
            { stage: 'preflight', cwd: project, command: 'npm run topology:preflight' },
            { stage: 'start', cwd: project, command: 'npm run topology:start:all', when: options.apps.length > 0 || options.companySite || options.commerceSite },
            { stage: 'start', cwd: project, command: 'npm run topology:start', when: options.apps.length === 0 && !options.companySite && !options.commerceSite },
            { stage: 'initialize', cwd: project, command: 'npm run acceptance:guided-initialization', when: options.accelerator !== 'common' },
            { stage: 'acceptance', cwd: project, command: 'npm run acceptance:local:fresh', when: options.acceptance },
            { stage: 'acceptance', cwd: project, command: 'npm run test:multi-domain', when: options.accelerator === 'combined' }
        ];
        return this.normalizeCommands(commands);
    },

    dockerCommands: function (options) {
        const project = options.application.projectPath;
        const commands = [
            { stage: 'configure', cwd: project, command: 'copy .env.example to .env when .env is absent' },
            { stage: 'configure', cwd: project, command: 'set NODICS_FRAMEWORK_ROOT=../nodics.ai in .env' },
            { stage: 'configure', cwd: project, command: 'set NODICS_APPLICATION_NAME=' + options.application.name + ' in .env' },
            { stage: 'configure', cwd: project, command: 'npm run configure:framework' },
            { stage: 'install', cwd: path.join(options.workspace, 'nodics.ai'), command: 'npm ci or npm install' },
            { stage: 'install', cwd: project, command: 'npm ci or npm install' },
            { stage: 'install', cwd: options.application.axisPath, command: 'npm ci or npm install', when: options.apps.includes('axis') },
            { stage: 'install', cwd: options.application.companySitePath, command: 'npm ci or npm install', when: options.companySite },
            { stage: 'install', cwd: options.application.commerceSitePath, command: 'npm ci or npm install', when: options.commerceSite },
            { stage: 'preflight', cwd: project, command: 'npm run docker-local:preflight' },
            { stage: 'start', cwd: project, command: 'npm run docker-local:build' },
            { stage: 'start', cwd: project, command: 'npm run docker-local:start' },
            { stage: 'acceptance', cwd: project, command: 'npm run docker-local:acceptance', when: options.acceptance }
        ];
        return this.normalizeCommands(commands);
    },

    expectedUrls: function (options) {
        if (options.mode === 'docker') {
            return {
                axis: options.apps.includes('axis') ? 'http://localhost:4100' : undefined,
                companySite: options.companySite ? 'http://localhost:4200' : undefined,
                commerceSite: options.commerceSite ? 'http://localhost:4300' : undefined,
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
            companySite: options.companySite ? 'http://localhost:3200' : undefined,
            commerceSite: options.commerceSite ? 'http://localhost:3300' : undefined,
            platform: 'http://localhost:4300',
            wcmsStaged: 'http://localhost:4312',
            wcmsOnline: 'http://localhost:4314',
            process: 'http://localhost:4330',
            engagement: 'http://localhost:4340',
            commerce: 'http://localhost:4350'
        };
    },

    initialProvisioning: function (options) {
        return {
            scope: 'first-local-environment',
            environment: options.mode === 'docker' ?
                options.application.dockerLocalEnvironmentName : options.application.localEnvironmentName,
            modules: [
                options.application.coreModuleName,
                options.application.apiModuleName,
                options.application.integrationModuleName
            ],
            sites: [
                options.companySite ? options.application.companySiteName : null,
                options.commerceSite ? options.application.commerceSiteName : null
            ].filter(Boolean),
            laterExpansion: [
                'add-environment',
                'add-module',
                'add-site'
            ]
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
                packageName: this.readJsonFile(path.resolve(__dirname, '..', 'package.json')).name,
                version: VERSION,
                bootstrapCommand: 'npx github:Nodics/nodics.installer'
            },
            beginnerChoices: {
                journey: 'Run Nodics locally with a named customer application',
                workspace: options.workspace,
                application: options.application,
                localMode: options.mode === 'docker' ? 'Docker Local production-simulation' : 'Direct Node.js local processes',
                apps: options.apps,
                companySite: options.companySite,
                commerceSite: options.commerceSite,
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
                dataPacks: this.applicationDataPacks(options, profile),
                gates: profile.gates
            },
            initialProvisioning: this.initialProvisioning(options),
            prerequisites: [
                { code: 'node', command: 'node --version', required: true },
                { code: 'npm', command: 'npm --version', required: true },
                { code: 'git', command: 'git --version', required: true },
                { code: 'mongodb', command: 'mongod --version or mongosh --version', required: false },
                { code: 'redis', command: 'redis-server --version', required: false },
                { code: 'elasticsearch', command: 'curl http://localhost:9200', required: false },
                { code: 'docker', command: 'docker --version', required: options.mode === 'docker' }
            ],
            repositories,
            setupSteps: [
                'Inspect machine prerequisites and busy ports.',
                'Resolve and protect the selected workspace.',
                'Download or reuse required Nodics repositories.',
                'Create only the selected first local environment for this application.',
                'Configure application project framework links.',
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
            'Application: ' + plan.beginnerChoices.application.name + ' (' + plan.beginnerChoices.application.code + ')',
            'Backend project: ' + plan.beginnerChoices.application.projectName,
            'Mode: ' + plan.beginnerChoices.localMode,
            'Standard apps: ' + plan.beginnerChoices.apps.join(', '),
            'Company site: ' + (plan.beginnerChoices.companySite ? plan.beginnerChoices.application.companySiteName : 'disabled'),
            'Commerce site: ' + (plan.beginnerChoices.commerceSite ? plan.beginnerChoices.application.commerceSiteName : 'disabled'),
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
        lines.push('', 'Initial provisioning:');
        lines.push('- Environment: ' + plan.initialProvisioning.environment);
        lines.push('- Modules: ' + plan.initialProvisioning.modules.join(', '));
        lines.push('- Sites: ' + (plan.initialProvisioning.sites.length ?
            plan.initialProvisioning.sites.join(', ') : 'none'));
        lines.push('- Later expansion actions: ' + plan.initialProvisioning.laterExpansion.join(', '));
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

    spawnDetachedCommand: function (executable, args, options) {
        const child = childProcess.spawn(executable, args || [], {
            cwd: options.cwd,
            env: options.env || process.env,
            detached: true,
            stdio: 'ignore',
            shell: false
        });
        child.unref();
        return {
            command: [executable, ...(args || [])].join(' '),
            cwd: options.cwd,
            status: 'started',
            pid: child.pid,
            startedAt: new Date().toISOString()
        };
    },

    sleep: function (ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        const commandMap = {
            node: ['node', ['--version']],
            npm: ['npm', ['--version']],
            git: ['git', ['--version']],
            docker: ['docker', ['--version']],
            redis: ['redis-server', ['--version']]
        };
        for (const prerequisite of plan.prerequisites) {
            if (prerequisite.code === 'mongodb') {
                const mongod = this.runCommand('mongod', ['--version'], { cwd: process.cwd(), allowFailure: true });
                const mongosh = mongod.status === 'passed' ? mongod :
                    this.runCommand('mongosh', ['--version'], { cwd: process.cwd(), allowFailure: true });
                checks.push({
                    code: 'mongodb',
                    required: false,
                    status: mongosh.status,
                    version: mongosh.stdout.split('\n')[0] || mongosh.stderr,
                    fix: mongosh.status === 'passed' ? undefined : 'Install/start MongoDB before runtime topology preflight.'
                });
                continue;
            }
            if (prerequisite.code === 'elasticsearch') {
                const result = this.runCommand('curl', ['-fsS', 'http://localhost:9200'], {
                    cwd: process.cwd(),
                    allowFailure: true
                });
                checks.push({
                    code: 'elasticsearch',
                    required: false,
                    status: result.status,
                    version: result.status === 'passed' ? 'reachable at http://localhost:9200' : '',
                    fix: result.status === 'passed' ? undefined : 'Start Elasticsearch or disable search-backed local capabilities.'
                });
                continue;
            }
            if (!prerequisite.required && prerequisite.code === 'docker') {
                checks.push({ code: 'docker', required: false, status: 'skipped' });
                continue;
            }
            if (prerequisite.code === 'docker') {
                const version = this.runCommand('docker', ['--version'], { cwd: process.cwd(), allowFailure: true });
                if (version.status !== 'passed') {
                    checks.push({
                        code: 'docker',
                        required: prerequisite.required,
                        status: 'failed',
                        version: version.stderr.trim(),
                        fix: 'Install Docker Desktop or make `docker` available on PATH.'
                    });
                    continue;
                }
                const daemon = this.runCommand('docker', ['info', '--format', '{{.ServerVersion}}'], {
                    cwd: process.cwd(),
                    allowFailure: true
                });
                checks.push({
                    code: 'docker',
                    required: prerequisite.required,
                    status: daemon.status,
                    version: version.stdout.trim() + (daemon.status === 'passed' ? ' daemon ' + daemon.stdout.trim() : ''),
                    fix: daemon.status === 'passed' ? undefined : 'Start Docker Desktop or set NODICS_DOCKER_BIN before Docker Local start.'
                });
                continue;
            }
            const [executable, commandArgs] = commandMap[prerequisite.code];
            if (!executable) {
                continue;
            }
            const result = this.runCommand(executable, commandArgs, { cwd: process.cwd(), allowFailure: true });
            checks.push({
                code: prerequisite.code,
                required: prerequisite.required,
                status: result.status,
                version: result.stdout.trim() || result.stderr.trim(),
                fix: result.status === 'passed' ? undefined : 'Install or make `' + executable + '` available on PATH.'
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

    refreshEvidenceContext: function (evidence, plan, options) {
        evidence.workspace = options.workspace;
        evidence.action = options.action;
        evidence.executionLevel = options.executionLevel;
        evidence.release = options.release;
        evidence.plan = plan;
        evidence.finishedAt = undefined;
        return evidence;
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

    readJsonFile: function (filePath) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    },

    writeJsonFile: function (filePath, value) {
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
    },

    upsertEnvFile: function (envPath, values, examplePath) {
        if (!fs.existsSync(envPath)) {
            if (examplePath && fs.existsSync(examplePath)) {
                fs.copyFileSync(examplePath, envPath);
            } else {
                fs.mkdirSync(path.dirname(envPath), { recursive: true });
                fs.writeFileSync(envPath, '');
            }
        }
        let nextContent = fs.readFileSync(envPath, 'utf8');
        Object.entries(values).forEach(([key, value]) => {
            const line = key + '=' + value;
            nextContent = nextContent.match(new RegExp('^' + key + '=', 'm')) ?
                nextContent.replace(new RegExp('^' + key + '=.*', 'm'), line) :
                nextContent.replace(/\s*$/, '\n' + line + '\n');
        });
        fs.writeFileSync(envPath, nextContent);
        return envPath;
    },

    stepCompleted: function (evidence, code, stageVersion) {
        return evidence.steps.some(step => step.code === code &&
            step.status === 'passed' &&
            (!stageVersion || step.stageVersion === stageVersion));
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
                prepared.push(this.repositoryEvidence(repository, 'reused'));
                continue;
            }
            if (options.cloneMode === 'existing') {
                throw new Error('Repository is required but missing in --clone=existing mode: ' + repository.targetPath);
            }
            this.runCommand('git', ['clone', '--branch', repository.release, repository.repository, repository.targetPath],
                { cwd: options.workspace, allowFailure: false });
            prepared.push(this.repositoryEvidence(repository, 'cloned'));
        }
        return prepared;
    },

    repositoryEvidence: function (repository, action) {
        const head = this.runCommand('git', ['rev-parse', 'HEAD'], { cwd: repository.targetPath, allowFailure: true });
        const branch = this.runCommand('git', ['branch', '--show-current'], { cwd: repository.targetPath, allowFailure: true });
        return {
            repository: repository.name,
            action,
            targetPath: repository.targetPath,
            branch: branch.stdout.trim() || repository.release,
            commit: head.stdout.trim() || undefined
        };
    },

    replaceTextInFile: function (filePath, replacements) {
        if (!fs.existsSync(filePath)) {
            return false;
        }
        let content = fs.readFileSync(filePath, 'utf8');
        const original = content;
        replacements.forEach(([pattern, value]) => {
            content = content.split(pattern).join(value);
        });
        if (content !== original) {
            fs.writeFileSync(filePath, content);
            return true;
        }
        return false;
    },

    renamePathIfExists: function (sourcePath, targetPath) {
        if (sourcePath === targetPath || !fs.existsSync(sourcePath)) {
            return [];
        }
        if (fs.existsSync(targetPath)) {
            throw new Error('Cannot rename generated path because target already exists: ' + targetPath);
        }
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.renameSync(sourcePath, targetPath);
        return [targetPath];
    },

    removePathIfExists: function (targetPath) {
        if (!fs.existsSync(targetPath)) {
            return [];
        }
        fs.rmSync(targetPath, { recursive: true, force: true });
        return [targetPath];
    },

    renameProjectIdentityPaths: function (projectPath, options) {
        const modulesPath = path.join(projectPath, 'modules');
        const envsPath = path.join(projectPath, 'envs');
        const renamed = [];
        [
            ['kickoffCore', options.application.coreModuleName],
            ['kickoffApi', options.application.apiModuleName],
            ['kickoffInt', options.application.integrationModuleName]
        ].forEach(([sourceName, targetName]) => {
            renamed.push(...this.renamePathIfExists(path.join(modulesPath, sourceName), path.join(modulesPath, targetName)));
        });
        if (options.mode === 'docker') {
            renamed.push(...this.renamePathIfExists(path.join(envsPath, 'kickoffDockerLocal'),
                path.join(envsPath, options.application.dockerLocalEnvironmentName)));
            renamed.push(...this.removePathIfExists(path.join(envsPath, 'kickoffLocal')));
        } else {
            renamed.push(...this.renamePathIfExists(path.join(envsPath, 'kickoffLocal'),
                path.join(envsPath, options.application.localEnvironmentName)));
            renamed.push(...this.removePathIfExists(path.join(envsPath, 'kickoffDockerLocal')));
        }
        const servicePath = path.join(modulesPath, options.application.integrationModuleName, 'src', 'service');
        renamed.push(...this.renamePathIfExists(
            path.join(servicePath, 'defaultKickoffEditorialProcessAdapterService.js'),
            path.join(servicePath, 'default' + options.application.servicePrefix + 'EditorialProcessAdapterService.js')
        ));
        return renamed;
    },

    collectRebrandableFiles: function (rootPath) {
        const ignoredDirectories = new Set([
            '.git', 'node_modules', '.nodics', 'generated', 'temp', 'data', 'assets', 'test', 'tests',
            'expectedOnlineProjections'
        ]);
        const rebrandableExtensions = new Set([
            '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.yaml', '.yml', '.html', '.css', '.ts', '.tsx',
            '.Dockerfile'
        ]);
        const fileNames = new Set(['Dockerfile', '.env.example', '.env']);
        const files = [];
        const visit = currentPath => {
            const entries = fs.existsSync(currentPath) ? fs.readdirSync(currentPath, { withFileTypes: true }) : [];
            entries.forEach(entry => {
                const entryPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    if (!ignoredDirectories.has(entry.name)) {
                        visit(entryPath);
                    }
                    return;
                }
                if (entry.isFile() && (rebrandableExtensions.has(path.extname(entry.name)) || fileNames.has(entry.name))) {
                    files.push(entryPath);
                }
            });
        };
        visit(rootPath);
        return files;
    },

    rebrandProjectFiles: function (projectPath, options) {
        const replacements = [
            ['nodics-kickoff-docker-local', options.application.dockerComposeProjectName],
            ['nodics/kickoff-backend', options.application.dockerBackendImageName],
            ['nodics.exp/nodics.axis', 'nodics.axis'],
            ['nodics.exp/nodics.nexus', options.application.companySiteName],
            ['nodics.exp/nodics.agora', options.application.commerceSiteName],
            ['kickoffDockerLocal', options.application.dockerLocalEnvironmentName],
            ['kickoffLocal', options.application.localEnvironmentName],
            ['kickoffCore', options.application.coreModuleName],
            ['kickoffApi', options.application.apiModuleName],
            ['kickoffInt', options.application.integrationModuleName],
            ['nodics.kickoff', options.application.projectName],
            ['Nodics Kickoff', options.application.name],
            ['Kickoff', options.application.name]
        ];
        return this.collectRebrandableFiles(projectPath)
            .filter(filePath => this.replaceTextInFile(filePath, replacements));
    },

    configureFrontendEnvironmentFiles: function (options) {
        const changed = [];
        if (options.apps.includes('axis')) {
            changed.push(this.upsertEnvFile(
                path.join(options.application.axisPath, '.env'),
                {
                    AXIS_BACKOFFICE_BASE_URL: 'http://localhost:4300',
                    AXIS_ENTERPRISE_CODE: 'default',
                    AXIS_PROJECT_CODE: options.application.projectName,
                    AXIS_CLIENT_CONTRACT_VERSION: '0',
                    AXIS_REQUEST_TIMEOUT_MS: '10000',
                    AXIS_BROWSER_SESSION_CSRF_COOKIE_NAME: 'nodics_axis_csrf',
                    AXIS_ASSISTANT_MAXIMUM_EVENT_BYTES: '65536',
                    AXIS_ASSISTANT_RECONNECT_WINDOW_MS: '120000',
                    AXIS_ASSISTANT_IDLE_TIMEOUT_MS: '45000',
                    AXIS_DEV_HOST: '0.0.0.0',
                    AXIS_DEV_PORT: '3100',
                    AXIS_STRICT_PORT: 'true',
                    AXIS_BUILD_SOURCEMAP: 'true'
                },
                path.join(options.application.axisPath, '.env.example')
            ));
        }
        if (options.companySite) {
            changed.push(this.upsertEnvFile(
                path.join(options.application.companySitePath, '.env'),
                {
                    NEXUS_AXIS_BASE_URL: 'http://localhost:3100',
                    NEXUS_PLATFORM_BASE_URL: 'http://localhost:4300',
                    NEXUS_ENTERPRISE_CODE: 'default',
                    NEXUS_DEFAULT_LOCALE: 'en',
                    NEXUS_CHANNEL: 'web',
                    NEXUS_CLIENT_CONTRACT_VERSION: '0',
                    NEXUS_REQUEST_TIMEOUT_MS: '10000',
                    NEXUS_CORPORATE_HOSTS: 'localhost,127.0.0.1',
                    NEXUS_CORPORATE_SITE: 'nexusCorporateSite',
                    NEXUS_DEV_HOST: '0.0.0.0',
                    NEXUS_DEV_PORT: '3200',
                    NEXUS_STRICT_PORT: 'true',
                    NEXUS_BUILD_SOURCEMAP: 'true'
                },
                path.join(options.application.companySitePath, '.env.example')
            ));
        }
        if (options.commerceSite) {
            changed.push(this.upsertEnvFile(
                path.join(options.application.commerceSitePath, '.env'),
                {
                    AGORA_SOLUTION: options.accelerator === 'common' ? 'commerce' : options.accelerator,
                    VITE_STOREFRONT_COMMERCE_PROXY_TARGET: 'http://localhost:4350'
                },
                path.join(options.application.commerceSitePath, '.env.example')
            ));
        }
        return changed.filter(Boolean);
    },

    updatePackageName: function (rootPath, packageName, displayName) {
        const changed = [];
        const packagePath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageJson = this.readJsonFile(packagePath);
            packageJson.name = packageName;
            packageJson.description = packageJson.description || displayName;
            this.writeJsonFile(packagePath, packageJson);
            changed.push(packagePath);
        }
        const lockPath = path.join(rootPath, 'package-lock.json');
        if (fs.existsSync(lockPath)) {
            const lockJson = this.readJsonFile(lockPath);
            lockJson.name = packageName;
            if (lockJson.packages && lockJson.packages['']) {
                lockJson.packages[''].name = packageName;
            }
            this.writeJsonFile(lockPath, lockJson);
            changed.push(lockPath);
        }
        return changed;
    },

    writeInstallerIdentity: function (rootPath, identity) {
        const identityPath = path.join(rootPath, '.nodics-installer-identity.json');
        this.writeJsonFile(identityPath, identity);
        return identityPath;
    },

    updateProjectTopologyIdentity: function (projectPath, options) {
        const projectJsonPath = path.join(projectPath, 'nodics.project.json');
        if (!fs.existsSync(projectJsonPath)) {
            return [];
        }
        const projectJson = this.readJsonFile(projectJsonPath);
        const frontends = projectJson.topology &&
            projectJson.topology.groups &&
            Array.isArray(projectJson.topology.groups.frontends) ?
            projectJson.topology.groups.frontends : [];
        const frontendTargets = {
            axis: {
                label: 'Axis',
                cwd: '{workspaceRoot}/' + path.basename(options.application.axisPath)
            },
            nexus: {
                code: 'companySite',
                label: options.application.companySiteTitle,
                cwd: '{workspaceRoot}/' + options.application.companySiteName
            },
            agora: {
                code: 'commerceSite',
                label: options.application.commerceSiteTitle,
                cwd: '{workspaceRoot}/' + options.application.commerceSiteName
            }
        };
        let changed = false;
        frontends.forEach(frontend => {
            const target = frontendTargets[frontend.code];
            if (!target) {
                return;
            }
            Object.entries(target).forEach(([key, value]) => {
                if (frontend[key] !== value) {
                    frontend[key] = value;
                    changed = true;
                }
            });
        });
        if (projectJson.acceptance && projectJson.acceptance.urls) {
            const acceptanceUrls = projectJson.acceptance.urls;
            if (options.companySite && acceptanceUrls.companySite === undefined && acceptanceUrls.nexus !== undefined) {
                acceptanceUrls.companySite = acceptanceUrls.nexus;
                delete acceptanceUrls.nexus;
                changed = true;
            }
            if (options.commerceSite && acceptanceUrls.commerceSite === undefined && acceptanceUrls.agora !== undefined) {
                acceptanceUrls.commerceSite = acceptanceUrls.agora;
                delete acceptanceUrls.agora;
                changed = true;
            }
        }
        if (changed) {
            this.writeJsonFile(projectJsonPath, projectJson);
            return [projectJsonPath];
        }
        return [];
    },

    rebrandGeneratedApplications: function (plan, options) {
        const changed = [];
        const projectIdentity = {
            kind: 'customer-project',
            applicationName: options.application.name,
            applicationCode: options.application.code,
            projectName: options.application.projectName,
            coreModuleName: options.application.coreModuleName,
            apiModuleName: options.application.apiModuleName,
            integrationModuleName: options.application.integrationModuleName,
            localEnvironmentName: options.application.localEnvironmentName,
            dockerLocalEnvironmentName: options.application.dockerLocalEnvironmentName,
            dockerComposeProjectName: options.application.dockerComposeProjectName,
            dockerBackendImageName: options.application.dockerBackendImageName,
            companySiteName: options.application.companySiteName,
            commerceSiteName: options.application.commerceSiteName
        };
        changed.push(...this.updatePackageName(options.application.projectPath, options.application.projectName, options.application.name));
        changed.push(this.writeInstallerIdentity(options.application.projectPath, projectIdentity));
        changed.push(...this.renameProjectIdentityPaths(options.application.projectPath, options));
        changed.push(...this.updateProjectTopologyIdentity(options.application.projectPath, options));
        changed.push(...this.rebrandProjectFiles(options.application.projectPath, options));
        if (options.companySite) {
            changed.push(...this.updatePackageName(options.application.companySitePath,
                options.application.companySiteName, options.application.companySiteTitle));
            changed.push(this.writeInstallerIdentity(options.application.companySitePath, {
                kind: 'company-site',
                applicationName: options.application.name,
                siteName: options.application.companySiteName,
                siteTitle: options.application.companySiteTitle
            }));
            ['README.md', 'index.html', '.env.example'].forEach(fileName => {
                const filePath = path.join(options.application.companySitePath, fileName);
                if (this.replaceTextInFile(filePath, [
                    ['nodics.nexus', options.application.companySiteName],
                    ['Nodics Nexus', options.application.companySiteTitle],
                    ['Nexus', options.application.companySiteTitle]
                ])) {
                    changed.push(filePath);
                }
            });
        }
        if (options.commerceSite) {
            changed.push(...this.updatePackageName(options.application.commerceSitePath,
                options.application.commerceSiteName, options.application.commerceSiteTitle));
            changed.push(this.writeInstallerIdentity(options.application.commerceSitePath, {
                kind: 'commerce-site',
                applicationName: options.application.name,
                siteName: options.application.commerceSiteName,
                siteTitle: options.application.commerceSiteTitle,
                accelerator: options.accelerator
            }));
            ['README.md', 'index.html', '.env.example'].forEach(fileName => {
                const filePath = path.join(options.application.commerceSitePath, fileName);
                if (this.replaceTextInFile(filePath, [
                    ['nodics.agora', options.application.commerceSiteName],
                    ['Nodics Agora', options.application.commerceSiteTitle],
                    ['Agora', options.application.commerceSiteTitle]
                ])) {
                    changed.push(filePath);
                }
            });
        }
        changed.push(...this.configureFrontendEnvironmentFiles(options));
        return Array.from(new Set(changed)).map(filePath => path.relative(options.workspace, filePath));
    },

    configureApplicationProject: function (plan, options) {
        const projectPath = options.application.projectPath;
        const envPath = path.join(projectPath, '.env');
        const examplePath = path.join(projectPath, '.env.example');
        const envEntries = {
            NODICS_FRAMEWORK_ROOT: '../nodics.ai',
            NODICS_APPLICATION_NAME: options.application.name,
            NODICS_APPLICATION_CODE: options.application.code,
            NODICS_AXIS_ROOT: '../nodics.axis',
            NODICS_COMPANY_SITE_ROOT: options.companySite ? '../' + options.application.companySiteName : '',
            NODICS_COMMERCE_SITE_ROOT: options.commerceSite ? '../' + options.application.commerceSiteName : ''
        };
        this.upsertEnvFile(envPath, envEntries, examplePath);
        return this.runProjectCommand(options, 'configure:framework', [], false);
    },

    packageInstallCommand: function (packagePath, options) {
        const commandArgs = fs.existsSync(path.join(packagePath, 'package-lock.json')) ? ['ci'] : ['install'];
        if (options.npmRegistry) {
            commandArgs.push('--registry', options.npmRegistry);
        }
        return this.runCommand('npm', commandArgs, { cwd: packagePath, allowFailure: false });
    },

    installDependencies: function (plan, options) {
        const roots = [options.application.projectPath];
        if (options.apps.includes('axis')) {
            roots.push(options.application.axisPath);
        }
        if (options.companySite) {
            roots.push(options.application.companySitePath);
        }
        if (options.commerceSite) {
            roots.push(options.application.commerceSitePath);
        }
        return roots.map(root => this.packageInstallCommand(root, options));
    },

    installFrameworkDependencies: function (plan, options) {
        return this.packageInstallCommand(path.join(options.workspace, 'nodics.ai'), options);
    },

    runProjectCommand: function (options, script, commandArgs, allowFailure) {
        return this.runCommand('npm', ['run', script, ...(commandArgs || [])], {
            cwd: options.application.projectPath,
            allowFailure: Boolean(allowFailure)
        });
    },

    parseJsonFromCommandOutput: function (output) {
        const start = output.indexOf('{');
        const end = output.lastIndexOf('}');
        if (start === -1 || end === -1 || end < start) {
            return null;
        }
        return JSON.parse(output.slice(start, end + 1));
    },

    readTopologyStatus: function (options) {
        const result = this.runProjectCommand(options, 'topology:status', [], true);
        const status = result.status === 'passed' ? this.parseJsonFromCommandOutput(result.stdout) : null;
        return { commandResult: result, status };
    },

    topologyIsReady: function (status) {
        return Boolean(status && Array.isArray(status.runtimes) &&
            status.supervisor === 'RUNNING' &&
            status.runtimes.every(runtime => runtime.ready === true && runtime.ownership === 'THIS_SUPERVISOR'));
    },

    waitForTopologyReady: async function (options, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        let last = null;
        do {
            last = this.readTopologyStatus(options);
            if (this.topologyIsReady(last.status)) {
                return last;
            }
            await this.sleep(2000);
        } while (Date.now() < deadline);
        const error = new Error('Topology did not become ready within ' + timeoutMs + 'ms');
        error.topologyStatus = last;
        throw error;
    },

    startTopology: async function (options) {
        const script = options.mode === 'docker' ? 'docker-local:start' :
            (options.apps.length > 0 || options.companySite || options.commerceSite ? 'topology:start:all' : 'topology:start');
        const launch = this.spawnDetachedCommand('npm', ['run', script], { cwd: options.application.projectPath });
        const ready = await this.waitForTopologyReady(options, 120000);
        return {
            ...launch,
            status: 'passed',
            finishedAt: new Date().toISOString(),
            topology: ready.status
        };
    },

    ensureTopologyStarted: async function (options) {
        const current = this.readTopologyStatus(options);
        if (this.topologyIsReady(current.status)) {
            return {
                status: 'passed',
                action: 'already-running',
                finishedAt: new Date().toISOString(),
                topology: current.status
            };
        }
        return this.startTopology(options);
    },

    runTopologyPreflight: function (options) {
        return options.mode === 'docker' ?
            this.runProjectCommand(options, 'docker-local:preflight', [], false) :
            this.runProjectCommand(options, 'topology:preflight', [], false);
    },

    runGuidedInitialization: function (options) {
        return this.runProjectCommand(options, 'acceptance:guided-initialization', [], false);
    },

    runAcceptanceChecks: function (options) {
        return options.mode === 'docker' ?
            this.runProjectCommand(options, 'docker-local:acceptance', [], false) :
            this.runProjectCommand(options, 'acceptance:local:fresh', [], false);
    },

    collectFiles: function (rootPath, matcher, maxFiles) {
        const files = [];
        const visit = currentPath => {
            if (files.length >= maxFiles || !fs.existsSync(currentPath)) {
                return;
            }
            const entries = fs.readdirSync(currentPath, { withFileTypes: true });
            entries.forEach(entry => {
                if (files.length >= maxFiles) {
                    return;
                }
                const entryPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    visit(entryPath);
                    return;
                }
                if (entry.isFile() && matcher(entryPath)) {
                    files.push(entryPath);
                }
            });
        };
        visit(rootPath);
        return files;
    },

    collectImportErrorArtifacts: function (options) {
        const importRoot = path.join(
            options.application.projectPath,
            'envs',
            options.application.localEnvironmentName,
            'wcmsStagedServer',
            'temp',
            'import'
        );
        return this.collectFiles(importRoot, filePath => filePath.includes(path.sep + 'error' + path.sep), 20);
    },

    diagnoseOperationalFailure: function (error, options, operation) {
        const commandResult = error && error.commandResult ? error.commandResult : null;
        const text = [
            error && error.message,
            commandResult && commandResult.stdout,
            commandResult && commandResult.stderr
        ].filter(Boolean).join('\n');
        const artifacts = this.collectImportErrorArtifacts(options);
        const artifactEvidence = artifacts.map(filePath => {
            let content = '';
            try {
                content = fs.readFileSync(filePath, 'utf8').slice(0, 4000);
            } catch (readError) {
                content = '';
            }
            return filePath + '\n' + content;
        }).join('\n');
        if (/Media reference was not found|agoraComponentMediaData/.test(text + '\n' + artifactEvidence)) {
            return {
                code: 'media-reference-missing',
                summary: 'Guided initialization reached WCMS component media data before its media references were available.',
                evidence: artifacts,
                nextSteps: [
                    'Review the WCMS Staged import error artifact listed below.',
                    'Run logs for WCMS Staged with --action=logs --runtime=wcmsStaged --lines=120.',
                    'Clean generated runtime state only after stopping the topology, then rerun initialize.',
                    'If the same media-reference error repeats on a fresh runtime, fix the accelerator data-pack import order or missing media reference seed data.'
                ]
            };
        }
        if (/record-level errors|temp\/import|import\/core\/error/i.test(text) || artifacts.length > 0) {
            return {
                code: 'import-record-errors',
                summary: 'A data import command finished with record-level errors.',
                evidence: artifacts,
                nextSteps: [
                    'Open the listed import error artifact to find the failing data file and record.',
                    'Run logs for the failing runtime with --action=logs --runtime=wcmsStaged --lines=120.',
                    'Resolve the data issue, then rerun initialize or acceptance.'
                ]
            };
        }
        return {
            code: operation + '-command-failed',
            summary: 'The project command failed before the installer could complete this operation.',
            evidence: artifacts,
            nextSteps: [
                'Read the command, exit code, and stderr in the JSON output or terminal text.',
                'Run --action=doctor to re-check prerequisite software and busy ports.',
                'Run --action=logs --lines=120 to inspect the latest topology logs.'
            ]
        };
    },

    runOperationalStep: function (options, operation, callback) {
        try {
            return callback();
        } catch (error) {
            const commandResult = error && error.commandResult ? error.commandResult : null;
            return {
                status: 'failed',
                operation,
                command: commandResult && commandResult.command,
                cwd: commandResult && commandResult.cwd,
                exitCode: commandResult && commandResult.exitCode,
                stdout: commandResult && commandResult.stdout,
                stderr: commandResult && commandResult.stderr,
                error: error && error.message ? this.sanitizeOutput(error.message) : String(error),
                diagnosis: this.diagnoseOperationalFailure(error, options, operation),
                finishedAt: new Date().toISOString()
            };
        }
    },

    readProjectDescriptor: function (options) {
        const projectJsonPath = path.join(options.application.projectPath, 'nodics.project.json');
        return fs.existsSync(projectJsonPath) ? this.readJsonFile(projectJsonPath) : null;
    },

    repositoryStatus: function (repository) {
        const exists = fs.existsSync(repository.targetPath);
        const gitCheckout = exists && this.isGitCheckout(repository.targetPath);
        const result = {
            name: repository.name,
            path: repository.targetPath,
            exists,
            gitCheckout
        };
        if (!gitCheckout) {
            return result;
        }
        const status = this.runCommand('git', ['status', '--short'], { cwd: repository.targetPath, allowFailure: true });
        const branch = this.runCommand('git', ['branch', '--show-current'], { cwd: repository.targetPath, allowFailure: true });
        const commit = this.runCommand('git', ['rev-parse', '--short', 'HEAD'], { cwd: repository.targetPath, allowFailure: true });
        result.branch = branch.stdout.trim() || undefined;
        result.commit = commit.stdout.trim() || undefined;
        result.dirty = Boolean(status.stdout.trim());
        return result;
    },

    setupStatus: function (plan, options) {
        const evidence = this.readEvidence(plan.evidencePath);
        const topology = fs.existsSync(options.application.projectPath) ? this.readTopologyStatus(options) : null;
        const projectDescriptor = this.readProjectDescriptor(options);
        return {
            operation: 'local-setup-status',
            ok: Boolean(topology && this.topologyIsReady(topology.status)),
            installer: plan.installer,
            workspace: options.workspace,
            application: options.application,
            evidencePath: plan.evidencePath,
            evidence: evidence ? {
                exists: true,
                action: evidence.action,
                executionLevel: evidence.executionLevel,
                release: evidence.release,
                startedAt: evidence.startedAt,
                finishedAt: evidence.finishedAt,
                steps: evidence.steps.map(step => ({
                    code: step.code,
                    status: step.status,
                    stageVersion: step.stageVersion,
                    timestamp: step.timestamp
                }))
            } : { exists: false },
            repositories: plan.repositories.map(repository => this.repositoryStatus(repository)),
            topology: topology ? topology.status : null,
            project: projectDescriptor ? {
                projectCode: projectDescriptor.projectCode,
                displayName: projectDescriptor.displayName,
                environment: projectDescriptor.topology && projectDescriptor.topology.environment,
                stateDirectory: projectDescriptor.topology && projectDescriptor.topology.stateDirectory
            } : null,
            expectedUrls: plan.expectedUrls,
            logDirectory: this.resolveTopologyStateDirectory(options, projectDescriptor)
        };
    },

    renderStatus: function (status) {
        const lines = [
            'Nodics Installer status ' + (status.ok ? 'ready' : 'not ready'),
            '',
            'Workspace: ' + status.workspace,
            'Application: ' + status.application.name + ' (' + status.application.projectName + ')',
            'Evidence: ' + status.evidencePath + (status.evidence.exists ? '' : ' (missing)')
        ];
        if (status.project) {
            lines.push('Environment: ' + status.project.environment);
            lines.push('Topology state: ' + status.project.stateDirectory);
        }
        if (status.topology) {
            lines.push('Supervisor: ' + status.topology.supervisor);
            status.topology.runtimes.forEach(runtime => {
                lines.push('- ' + runtime.code + ': ' + (runtime.ready ? 'ready' : 'not ready') +
                    ' port=' + runtime.port + ' ownership=' + runtime.ownership);
            });
        } else {
            lines.push('Supervisor: unavailable');
        }
        lines.push('', 'Repositories:');
        status.repositories.forEach(repository => {
            lines.push('- ' + repository.name + ': ' + (repository.exists ? 'present' : 'missing') +
                (repository.branch ? ' branch=' + repository.branch : '') +
                (repository.commit ? ' commit=' + repository.commit : '') +
                (repository.dirty ? ' dirty' : ''));
        });
        lines.push('', 'Expected URLs:');
        Object.entries(status.expectedUrls).filter(([, value]) => value).forEach(([key, value]) => {
            lines.push('- ' + key + ': ' + value);
        });
        if (status.logDirectory) {
            lines.push('', 'Logs: ' + status.logDirectory);
        }
        return lines.join('\n');
    },

    stopTopology: function (options, allowFailure) {
        return this.runProjectCommand(options, 'topology:stop', [], Boolean(allowFailure));
    },

    restartTopology: async function (options) {
        const stop = this.stopTopology(options, true);
        const start = await this.ensureTopologyStarted(options);
        return {
            operation: 'local-setup-restart',
            ok: true,
            stop,
            start
        };
    },

    repairSetup: function (plan, options) {
        const changed = this.rebrandGeneratedApplications(plan, options);
        const configure = this.configureApplicationProject(plan, options);
        return {
            operation: 'local-setup-repair',
            ok: true,
            changed,
            configure
        };
    },

    resolveTopologyStateDirectory: function (options, projectDescriptor) {
        const descriptor = projectDescriptor || this.readProjectDescriptor(options);
        const stateDirectory = descriptor && descriptor.topology && descriptor.topology.stateDirectory;
        return stateDirectory ? path.join(options.application.projectPath, stateDirectory) : null;
    },

    collectLogFiles: function (options) {
        const stateDirectory = this.resolveTopologyStateDirectory(options);
        if (!stateDirectory || !fs.existsSync(stateDirectory)) {
            return [];
        }
        return fs.readdirSync(stateDirectory)
            .filter(fileName => fileName.endsWith('.log'))
            .map(fileName => path.join(stateDirectory, fileName))
            .sort();
    },

    readLastLines: function (filePath, lineCount) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        if (lines.length && lines[lines.length - 1] === '') {
            lines.pop();
        }
        return lines.slice(-Math.max(1, lineCount)).join('\n');
    },

    logsStatus: function (options) {
        const runtime = String(options.runtime || '').trim();
        const logs = this.collectLogFiles(options)
            .filter(filePath => !runtime || path.basename(filePath, '.log') === runtime)
            .map(filePath => ({
                runtime: path.basename(filePath, '.log'),
                path: filePath,
                sizeBytes: fs.statSync(filePath).size,
                excerpt: this.readLastLines(filePath, options.lines)
            }));
        return {
            operation: 'local-setup-logs',
            ok: logs.length > 0,
            runtime: runtime || undefined,
            lines: options.lines,
            logDirectory: this.resolveTopologyStateDirectory(options),
            logs
        };
    },

    renderLogs: function (result) {
        const lines = [
            'Nodics Installer logs',
            'Directory: ' + (result.logDirectory || 'missing')
        ];
        if (!result.logs.length) {
            lines.push('No topology logs found.');
            return lines.join('\n');
        }
        result.logs.forEach(log => {
            lines.push('', '== ' + log.runtime + ' ==', log.path, log.excerpt || '(empty)');
        });
        return lines.join('\n');
    },

    failureCatalog: function () {
        return [
            {
                code: 'node-version',
                signal: 'node --version is outside the supported engine range',
                fix: 'Install Node.js 22 or 24 and npm 10 or 11, then rerun doctor.'
            },
            {
                code: 'git-access',
                signal: 'git clone, fetch, or switch cannot reach the selected branch',
                fix: 'Check GitHub access, SSH keys, enterprise proxy, and --release.'
            },
            {
                code: 'dirty-repository',
                signal: 'Refusing to reuse dirty repository',
                fix: 'Commit, stash, or move local edits before installer reuse.'
            },
            {
                code: 'npm-install',
                signal: 'npm ci or npm install fails',
                fix: 'Check npm registry, proxy, lockfile health, and Node/npm versions.'
            },
            {
                code: 'runtime-prerequisite',
                signal: 'MongoDB, Redis, or Elasticsearch is unavailable',
                fix: 'Start the local service required by the selected topology, then rerun preflight.'
            },
            {
                code: 'busy-port',
                signal: 'preflight reports port-NNNN failed',
                fix: 'Stop the process holding the port or change the local topology port.'
            },
            {
                code: 'docker-daemon',
                signal: 'Docker CLI exists but docker info cannot reach the daemon',
                fix: 'Start Docker Desktop or set NODICS_DOCKER_BIN before Docker Local start.'
            },
            {
                code: 'wcms-import-records',
                signal: 'Import completed with record-level errors',
                fix: 'Open the listed import error artifact and inspect WCMS Staged logs.'
            },
            {
                code: 'media-reference-missing',
                signal: 'Media reference was not found or agoraComponentMediaData fails',
                fix: 'Import active media references before component-media, then rerun initialize.'
            }
        ];
    },

    troubleshootingStatus: function () {
        return {
            operation: 'local-setup-troubleshooting',
            ok: true,
            failures: this.failureCatalog()
        };
    },

    renderTroubleshooting: function (result) {
        const lines = ['Nodics Installer troubleshooting catalog'];
        result.failures.forEach(failure => {
            lines.push('', failure.code, 'signal: ' + failure.signal, 'fix: ' + failure.fix);
        });
        return lines.join('\n');
    },

    cleanGeneratedRuntime: function (options) {
        const topology = this.readTopologyStatus(options);
        if (this.topologyIsReady(topology.status)) {
            throw new Error('Refusing to clean generated runtime files while topology is running. Run --action=stop --yes first.');
        }
        const projectDescriptor = this.readProjectDescriptor(options);
        const targets = [];
        const stateDirectory = this.resolveTopologyStateDirectory(options, projectDescriptor);
        if (stateDirectory) {
            targets.push(stateDirectory);
        }
        const dockerGenerated = projectDescriptor &&
            projectDescriptor.containerEnvironments &&
            projectDescriptor.containerEnvironments.dockerLocal &&
            projectDescriptor.containerEnvironments.dockerLocal.generatedDirectory;
        if (dockerGenerated) {
            targets.push(path.join(options.application.projectPath, dockerGenerated));
        }
        const removed = [];
        Array.from(new Set(targets)).forEach(target => {
            if (fs.existsSync(target)) {
                fs.rmSync(target, { recursive: true, force: true });
                removed.push(target);
            }
        });
        return {
            operation: 'local-setup-clean',
            ok: true,
            removed
        };
    },

    versionInfo: function () {
        const packageJson = this.readJsonFile(path.resolve(__dirname, '..', 'package.json'));
        return {
            operation: 'local-installer-version',
            ok: true,
            packageName: packageJson.name,
            version: VERSION,
            packageVersion: packageJson.version,
            node: packageJson.engines && packageJson.engines.node,
            npm: packageJson.engines && packageJson.engines.npm,
            actions: Array.from(VALID_ACTIONS).sort(),
            mutatingActions: Array.from(MUTATING_ACTIONS).sort(),
            bootstrapCommand: 'npx github:Nodics/nodics.installer'
        };
    },

    renderVersion: function (info) {
        return [
            info.packageName + ' ' + info.version,
            'Bootstrap: ' + info.bootstrapCommand,
            'Node: ' + info.node,
            'npm: ' + info.npm,
            'Actions: ' + info.actions.join(', '),
            'Mutating actions require --yes: ' + info.mutatingActions.join(', ')
        ].join('\n');
    },

    executeSetup: async function (plan, options) {
        const evidence = this.refreshEvidenceContext(
            this.readEvidence(plan.evidencePath) || this.createEvidence(plan, options),
            plan,
            options
        );
        const runStage = (code, label, callback, stageVersion) => {
            if (this.stepCompleted(evidence, code, stageVersion)) {
                return;
            }
            const result = callback();
            this.recordStep(evidence, plan.evidencePath, { code, label, stageVersion, status: 'passed', result });
        };
        runStage('download', 'Download or reuse repositories', () => this.prepareRepositories(plan, options));
        runStage('rebrand', 'Apply application identity', () => this.rebrandGeneratedApplications(plan, options), REBRAND_STAGE_VERSION);
        if (options.executionLevel === 'download') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        runStage('install-framework', 'Install framework dependencies', () => this.installFrameworkDependencies(plan, options));
        runStage('configure', 'Configure application framework link', () => this.configureApplicationProject(plan, options));
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
        runStage('topology-preflight', 'Run application topology preflight', () => this.runTopologyPreflight(options));
        if (options.executionLevel === 'preflight') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        const startStatus = this.stepCompleted(evidence, 'start', START_STAGE_VERSION) ?
            this.readTopologyStatus(options).status : null;
        if (!this.topologyIsReady(startStatus)) {
            const startResult = await this.ensureTopologyStarted(options);
            this.recordStep(evidence, plan.evidencePath, {
                code: 'start',
                label: 'Start topology',
                stageVersion: START_STAGE_VERSION,
                status: 'passed',
                result: startResult
            });
        }
        if (options.executionLevel === 'start') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        if (options.accelerator !== 'common' || options.initialize || options.sampleData || options.freshData) {
            runStage('initialize', 'Run guided initialization', () => this.runGuidedInitialization(options));
        }
        if (options.executionLevel === 'initialize') {
            evidence.finishedAt = new Date().toISOString();
            this.writeEvidence(plan.evidencePath, evidence);
            return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
        }
        if (options.acceptance) {
            runStage('acceptance', 'Run acceptance checks', () => this.runAcceptanceChecks(options));
        }
        evidence.finishedAt = new Date().toISOString();
        this.writeEvidence(plan.evidencePath, evidence);
        return { operation: 'local-setup-execution', ok: true, evidencePath: plan.evidencePath, evidence };
    },

    printResult: function (options, result, textRenderer) {
        console.log(options.json ? JSON.stringify(result, null, 2) : textRenderer(result));
    },

    renderDoctor: function (result) {
        const lines = [
            'Nodics Installer doctor ' + (result.ok ? 'passed' : 'found items to review'),
            ''
        ];
        result.checks.forEach(check => {
            lines.push('- ' + check.code + ': ' + check.status + (check.version ? ' (' + check.version + ')' : ''));
            if (check.fix) {
                lines.push('  fix: ' + check.fix);
            }
            if (check.busy) {
                lines.push('  fix: stop the process using this local port, or change the local port configuration before start.');
            }
        });
        return lines.join('\n');
    },

    renderPreflight: function (result) {
        const lines = [
            'Nodics Installer preflight ' + (result.ok ? 'passed' : 'failed')
        ];
        result.checks.forEach(check => {
            lines.push('- ' + check.code + ': ' + check.status);
            if (check.fix) {
                lines.push('  fix: ' + check.fix);
            }
            if (check.busy) {
                lines.push('  fix: stop the process using this local port, or change the local port configuration before start.');
            }
        });
        return lines.join('\n');
    },

    renderOperationalAction: function (label, step) {
        const lines = [
            label + (step.status === 'passed' ? ' completed' : ' failed'),
            'Status: ' + step.status
        ];
        if (step.command) {
            lines.push('Command: ' + step.command);
        }
        if (step.exitCode !== undefined && step.exitCode !== null) {
            lines.push('Exit code: ' + step.exitCode);
        }
        if (step.diagnosis) {
            lines.push('', 'Diagnosis: ' + step.diagnosis.summary);
            if (step.diagnosis.evidence && step.diagnosis.evidence.length) {
                lines.push('', 'Evidence:');
                step.diagnosis.evidence.forEach(filePath => lines.push('- ' + filePath));
            }
            lines.push('', 'Next steps:');
            step.diagnosis.nextSteps.forEach(nextStep => lines.push('- ' + nextStep));
        }
        if (step.stderr) {
            const stderr = step.stderr.trim().split('\n').slice(-8).join('\n');
            if (stderr) {
                lines.push('', 'Last stderr lines:', stderr);
            }
        }
        return lines.join('\n');
    },

    run: async function (args, runtime) {
        if (this.hasFlag(args, '--help')) {
            console.log(this.usage());
            return true;
        }
        let options = this.parseOptions(args);
        if (options.action === 'version') {
            const result = this.versionInfo();
            this.printResult(options, result, version => this.renderVersion(version));
            return true;
        }
        if (options.action === 'questionnaire' || this.shouldRunStartupQuestionnaire(args, options, runtime)) {
            options = await this.runQuestionnaire(options);
        }
        const plan = this.createSetupPlan(options);
        if (options.action === 'status') {
            const result = this.setupStatus(plan, options);
            this.printResult(options, result, status => this.renderStatus(status));
            return true;
        }
        if (options.action === 'preflight') {
            const result = await this.preflight(plan, options);
            if (!result.ok) {
                process.exitCode = 1;
            }
            this.printResult(options, result, preflight => this.renderPreflight(preflight));
            return true;
        }
        if (options.action === 'doctor') {
            const result = await this.preflight(plan, options);
            this.printResult(options, result, doctor => this.renderDoctor(doctor));
            return true;
        }
        if (options.action === 'logs') {
            const result = this.logsStatus(options);
            this.printResult(options, result, logs => this.renderLogs(logs));
            return true;
        }
        if (options.action === 'troubleshooting') {
            const result = this.troubleshootingStatus();
            this.printResult(options, result, troubleshooting => this.renderTroubleshooting(troubleshooting));
            return true;
        }
        if (options.action === 'start') {
            const result = await this.ensureTopologyStarted(options);
            this.printResult(options, result, start => 'Nodics topology start completed\nStatus: ' + start.status);
            return true;
        }
        if (options.action === 'stop') {
            const result = this.stopTopology(options, false);
            this.printResult(options, result, stop => 'Nodics topology stop completed\n' + stop.command);
            return true;
        }
        if (options.action === 'restart') {
            const result = await this.restartTopology(options);
            this.printResult(options, result, restart => 'Nodics topology restart completed\n' +
                'Stop: ' + restart.stop.status + '\nStart: ' + restart.start.status);
            return true;
        }
        if (options.action === 'repair') {
            const result = this.repairSetup(plan, options);
            this.printResult(options, result, repair => 'Nodics Installer repair completed\nChanged files: ' + repair.changed.length);
            return true;
        }
        if (options.action === 'initialize') {
            const start = await this.ensureTopologyStarted(options);
            const initialize = this.runOperationalStep(options, 'initialize', () => this.runGuidedInitialization(options));
            const result = { operation: 'local-setup-initialize', ok: initialize.status === 'passed', start, initialize };
            if (!result.ok) {
                process.exitCode = 1;
            }
            this.printResult(options, result, init => this.renderOperationalAction('Nodics guided initialization', init.initialize));
            return true;
        }
        if (options.action === 'acceptance') {
            const start = await this.ensureTopologyStarted(options);
            const acceptance = this.runOperationalStep(options, 'acceptance', () => this.runAcceptanceChecks(options));
            const result = { operation: 'local-setup-acceptance', ok: acceptance.status === 'passed', start, acceptance };
            if (!result.ok) {
                process.exitCode = 1;
            }
            this.printResult(options, result, accepted => this.renderOperationalAction('Nodics acceptance', accepted.acceptance));
            return true;
        }
        if (options.action === 'clean') {
            const result = this.cleanGeneratedRuntime(options);
            this.printResult(options, result, clean => 'Nodics generated runtime clean completed\nRemoved: ' +
                (clean.removed.length ? clean.removed.join('\n') : 'nothing'));
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
