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
const VENDOR_BOUNDARY_STAGE_VERSION = VERSION + ':vendor-boundary-v1';
const VALID_JOURNEYS = new Set(['reference', 'project']);
const VALID_MODES = new Set(['node', 'docker']);
const VALID_APPS = new Set(['axis']);
const VALID_ACCELERATORS = new Set(['common', 'apparel', 'electronics', 'telco', 'combined']);
const VALID_ACTIONS = new Set([
    'plan', 'questionnaire', 'preflight', 'doctor', 'execute', 'status', 'start', 'stop', 'restart', 'logs',
    'initialize', 'acceptance', 'repair', 'clean', 'add-environment', 'add-module', 'add-site',
    'inventory', 'support-bundle', 'upgrade-check', 'self-check', 'cleanup-workspace',
    'uninstall', 'troubleshooting', 'version'
]);
const MUTATING_ACTIONS = new Set([
    'execute', 'start', 'stop', 'restart', 'initialize', 'acceptance', 'repair', 'clean',
    'add-environment', 'add-module', 'add-site', 'support-bundle', 'cleanup-workspace', 'uninstall'
]);
const VALID_EXECUTION_LEVELS = new Set(['download', 'install', 'preflight', 'start', 'initialize', 'acceptance']);
const VALID_CLONE_MODES = new Set(['https', 'ssh', 'existing']);
const VALID_SITE_TYPES = new Set(['company', 'commerce']);
const VALID_ACCEPTANCE_PROFILES = new Set(['smoke', 'standard', 'full']);
const VALID_ENVIRONMENT_PROFILES = new Set(['local-dev', 'local-demo', 'local-qa', 'docker-local']);
const VALID_RELEASE_CHANNELS = new Set(['development', 'stable', 'explicit']);
const VALID_MODULE_PRESETS = new Set(['capability', 'data-pack', 'integration-adapter', 'api-facade', 'workflow-extension']);
const VENDOR_OWNED_REPOSITORIES = Object.freeze(['nodics.ai', 'nodics.axis']);

const SUPPORT_MATRIX = Object.freeze({
    node: Object.freeze({ minimumMajor: 22, maximumMajor: 24, recommended: '22.x or 24.x' }),
    npm: Object.freeze({ minimumMajor: 10, maximumMajor: 11, recommended: '10.x or 11.x' }),
    git: Object.freeze({ recommended: '2.40+' }),
    mongodb: Object.freeze({ recommended: '7.x or 8.x' }),
    redis: Object.freeze({ recommended: '7.x' }),
    elasticsearch: Object.freeze({ recommended: '8.x compatible HTTP endpoint' }),
    docker: Object.freeze({ recommended: 'Docker Desktop 4.x when --mode=docker is used' }),
    hardware: Object.freeze({ minimumMemoryGb: 8, recommendedMemoryGb: 16, minimumDiskGb: 10 })
});

const JSON_RESULT_CONTRACTS = Object.freeze({
    plan: 1,
    preflight: 1,
    execute: 1,
    status: 1,
    logs: 1,
    doctor: 1,
    inventory: 1,
    supportBundle: 1,
    upgradeCheck: 1,
    selfCheck: 1
});

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

const STARTER_TEMPLATE_REGISTRY = Object.freeze({
    [DEFAULT_REPOSITORIES.applicationTemplate.name]: Object.freeze({
        name: DEFAULT_REPOSITORIES.applicationTemplate.name,
        generatedProject: Object.freeze({
            documentationPacks: Object.freeze([]),
            routes: Object.freeze([]),
            expectDocumentation: false
        }),
        preservedIdentity: Object.freeze({
            documentationPacks: Object.freeze([
                Object.freeze({
                    code: 'kickoffDocumentation',
                    profileCode: 'kickoffdocs',
                    minimumRoutes: 4,
                    navigationComponent: 'kickoffDocumentationNavigation',
                    site: 'kickoffDocumentationSite',
                    path: '/docs/nodics-kickoff'
                })
            ]),
            routes: Object.freeze(['/docs/nodics-kickoff']),
            expectDocumentation: true
        })
    })
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
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
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

    toNodicsIdentifier: function (value, fallback) {
        const raw = String(value || fallback || '')
            .trim()
            .replace(/[^A-Za-z0-9]+/g, ' ');
        if (!raw) {
            return '';
        }
        const compact = raw.indexOf(' ') === -1 ? raw : raw.split(/\s+/g)
            .filter(Boolean)
            .map((word, index) => index === 0 ?
                word.charAt(0).toLowerCase() + word.slice(1) :
                word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
        return compact.charAt(0).toLowerCase() + compact.slice(1);
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

    isVendorOwnedName: function (value) {
        const slug = this.toApplicationSlug(value || '');
        return VENDOR_OWNED_REPOSITORIES.includes(slug);
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
        const identity = {
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
        Object.defineProperty(identity, 'sourceTemplate', {
            value: DEFAULT_REPOSITORIES.applicationTemplate.name
        });
        Object.defineProperty(identity, 'preservesSourceTemplateIdentity', {
            value: projectSlug === DEFAULT_REPOSITORIES.applicationTemplate.name
        });
        return identity;
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
            '  --action=cleanup-workspace --yes',
            '                             Remove only installer-created generated workspace roots.',
            '  --action=uninstall --yes   Stop topology and remove installer-created roots.',
            '  --action=inventory        List Nodics projects/sites/environments in a workspace.',
            '  --action=support-bundle --yes',
            '                             Export sanitized setup evidence and log excerpts.',
            '  --action=upgrade-check    Compare generated metadata with current installer rules.',
            '  --action=self-check       Validate installer package and local command readiness.',
            '  --action=add-environment --yes',
            '                             Add one explicit environment after first setup.',
            '  --action=add-module --yes Add one customer backend module after first setup.',
            '  --action=add-site --yes   Add one customer site after first setup.',
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
            '  --acceptance-profile=smoke|standard|full',
            '                                     Default: standard.',
            '  --environment-profile=local-dev|local-demo|local-qa|docker-local',
            '                                     Default follows --mode.',
            '  --release-channel=development|stable|explicit',
            '                                     Default: development.',
            '  --resume --retry-failed --from-step=start',
            '                                     Resume controls for failed setup evidence.',
            '  --alternate-ports                  Preview alternate local port guidance.',
            '  --support-bundle=/path/bundle      Custom sanitized support bundle path.',
            '  --proxy=http://host:port          Record enterprise proxy requirement.',
            '  --npm-registry=https://registry   Use npm registry while installing.',
            '  --offline-cache=/path             Record offline cache location.',
            '  --policy-pack=/path               Record enterprise policy pack location.',
            '  --runtime=platform                Select runtime for logs.',
            '  --lines=80                        Number of log lines to show. Default: 80.',
            '  --environment-name=acmeQa         Target environment for add-environment.',
            '  --from-environment=acmeLocal      Source environment to copy. Default: first local environment.',
            '  --module-name=acmeLoyalty         Target backend module for add-module.',
            '  --module-preset=capability|data-pack|integration-adapter|api-facade|workflow-extension',
            '                                     Default: capability.',
            '  --site-name=acme.electronics      Target site for add-site.',
            '  --site-type=commerce|company      Site template type for add-site. Default: commerce.',
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
        const rawEnvironmentName = this.readOption(args, '--environment-name', '');
        const rawFromEnvironment = this.readOption(args, '--from-environment', '');
        const rawModuleName = this.readOption(args, '--module-name', '');
        const modulePreset = this.readOption(args, '--module-preset', 'capability').toLowerCase();
        const rawSiteName = this.readOption(args, '--site-name', '');
        const accelerator = this.readOption(args, '--accelerator', 'common').toLowerCase();
        const rawMode = this.readOption(args, '--mode', 'node').toLowerCase();
        const defaultEnvironmentProfile = rawMode === 'docker' ? 'docker-local' : 'local-dev';
        const explicitApps = this.readOption(args, '--apps', null);
        const defaultApps = explicitApps === null ? ['axis'] : [];
        const requestedApps = this.readCsvOption(args, '--apps', defaultApps);
        const requiredApps = ACCELERATOR_PROFILES[accelerator] ? ACCELERATOR_PROFILES[accelerator].requiredApps : [];
        const apps = Array.from(new Set([...requestedApps, ...requiredApps]));
        const action = this.readOption(args, '--action', 'plan').toLowerCase();
        const releaseChannel = this.readOption(args, '--release-channel', 'development').toLowerCase();
        const explicitRelease = this.readOption(args, '--release', null);
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
            mode: rawMode,
            apps,
            commerceSite: !this.hasFlag(args, '--without-commerce-site') && !this.hasFlag(args, '--without-web'),
            companySite: !this.hasFlag(args, '--without-company-site'),
            accelerator,
            action,
            executionLevel: executionLevel.toLowerCase(),
            cloneMode: this.readOption(args, '--clone', 'https').toLowerCase(),
            release: explicitRelease || (releaseChannel === 'stable' ? 'master' : 'development'),
            sampleData: this.hasFlag(args, '--sample-data'),
            freshData: this.hasFlag(args, '--fresh-data'),
            acceptanceProfile: this.readOption(args, '--acceptance-profile', 'standard').toLowerCase(),
            environmentProfile: this.readOption(args, '--environment-profile', defaultEnvironmentProfile).toLowerCase(),
            releaseChannel,
            resume: this.hasFlag(args, '--resume'),
            retryFailed: this.hasFlag(args, '--retry-failed'),
            fromStep: this.readOption(args, '--from-step', ''),
            alternatePorts: this.hasFlag(args, '--alternate-ports'),
            supportBundlePath: this.readOption(args, '--support-bundle', ''),
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
            lines: Number(this.readOption(args, '--lines', '80')) || 80,
            rawEnvironmentName,
            rawFromEnvironment,
            rawModuleName,
            rawSiteName,
            environmentName: this.toNodicsIdentifier(rawEnvironmentName),
            fromEnvironment: this.toNodicsIdentifier(rawFromEnvironment),
            moduleName: this.toNodicsIdentifier(rawModuleName),
            modulePreset,
            siteName: rawSiteName ? this.toApplicationSlug(rawSiteName) : '',
            siteType: this.readOption(args, '--site-type', 'commerce').toLowerCase()
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
            errors.push('Unknown action `' + options.action + '`. Use plan, questionnaire, preflight, doctor, execute, status, start, stop, restart, logs, initialize, acceptance, repair, clean, cleanup-workspace, uninstall, inventory, support-bundle, upgrade-check, self-check, add-environment, add-module, add-site, troubleshooting, or version.');
        }
        if (!VALID_EXECUTION_LEVELS.has(options.executionLevel)) {
            errors.push('Unknown execution level `' + options.executionLevel + '`.');
        }
        if (!VALID_CLONE_MODES.has(options.cloneMode)) {
            errors.push('Unknown clone mode `' + options.cloneMode + '`. Use https, ssh, or existing.');
        }
        if (!VALID_ACCEPTANCE_PROFILES.has(options.acceptanceProfile)) {
            errors.push('Unknown acceptance profile `' + options.acceptanceProfile + '`. Use smoke, standard, or full.');
        }
        if (!VALID_ENVIRONMENT_PROFILES.has(options.environmentProfile)) {
            errors.push('Unknown environment profile `' + options.environmentProfile + '`. Use local-dev, local-demo, local-qa, or docker-local.');
        }
        if (!VALID_RELEASE_CHANNELS.has(options.releaseChannel)) {
            errors.push('Unknown release channel `' + options.releaseChannel + '`. Use development, stable, or explicit.');
        }
        if (options.releaseChannel === 'explicit' && !options.release) {
            errors.push('Explicit release channel requires --release=<branch-or-tag>.');
        }
        if (options.fromStep && !['download', 'rebrand', 'vendor-boundary', 'install-framework', 'configure', 'install', 'preflight', 'topology-preflight', 'start', 'initialize', 'acceptance'].includes(options.fromStep)) {
            errors.push('Unknown --from-step `' + options.fromStep + '`. Use a setup evidence step code.');
        }
        if (MUTATING_ACTIONS.has(options.action) && !options.yes) {
            errors.push('Action `' + options.action + '` requires --yes so the installer cannot mutate the machine by accident.');
        }
        if (options.journey === 'project') {
            errors.push('The custom project journey is documented but deferred until the reference local setup journey is stable.');
        }
        const validIdentifier = /^[a-z][A-Za-z0-9]*$/;
        if (options.action === 'add-environment' && !validIdentifier.test(options.environmentName)) {
            errors.push('add-environment requires --environment-name, for example --environment-name=acmeQa.');
        }
        if (options.action === 'add-module' && !validIdentifier.test(options.moduleName)) {
            errors.push('add-module requires --module-name, for example --module-name=acmeLoyalty.');
        }
        if (options.action === 'add-module' && !VALID_MODULE_PRESETS.has(options.modulePreset)) {
            errors.push('add-module requires --module-preset=capability, data-pack, integration-adapter, api-facade, or workflow-extension.');
        }
        if (options.action === 'add-module' && this.isVendorOwnedName(options.rawModuleName)) {
            errors.push('add-module cannot target vendor-owned repositories such as nodics.ai or nodics.axis.');
        }
        if (options.action === 'add-site') {
            if (!options.siteName || !validSlug.test(options.siteName)) {
                errors.push('add-site requires --site-name, for example --site-name=acme.electronics.');
            }
            if (!VALID_SITE_TYPES.has(options.siteType)) {
                errors.push('add-site requires --site-type=commerce or --site-type=company.');
            }
            if (this.isVendorOwnedName(options.rawSiteName)) {
                errors.push('add-site cannot target vendor-owned repositories such as nodics.ai or nodics.axis.');
            }
        }
        if (options.workspace === path.parse(options.workspace).root || options.workspace === os.homedir()) {
            errors.push('Workspace must be a dedicated folder, not the filesystem root or home directory.');
        }
        return { valid: errors.length === 0, errors };
    },

    environmentProfile: function (options) {
        const profiles = {
            'local-dev': {
                code: 'local-dev',
                intent: 'Developer workstation with direct Node.js processes.',
                retainedData: true,
                destructiveReset: false
            },
            'local-demo': {
                code: 'local-demo',
                intent: 'Repeatable local demo with sample accelerator data.',
                retainedData: true,
                destructiveReset: false
            },
            'local-qa': {
                code: 'local-qa',
                intent: 'Local QA validation with stronger acceptance gates.',
                retainedData: false,
                destructiveReset: Boolean(options.freshData)
            },
            'docker-local': {
                code: 'docker-local',
                intent: 'Container-only topology after installer bootstrap.',
                retainedData: true,
                destructiveReset: false
            }
        };
        return profiles[options.environmentProfile] || profiles['local-dev'];
    },

    acceptanceProfile: function (options) {
        const profiles = {
            smoke: {
                code: 'smoke',
                description: 'Fast route and bootstrap checks for a beginner first look.',
                gates: ['topology', 'public bootstrap', 'selected frontend routes']
            },
            standard: {
                code: 'standard',
                description: 'Default local acceptance with APIs, Axis smoke, process, media, and publishing readiness checks.',
                gates: ['topology', 'security', 'publishing readiness', 'media readiness', 'Axis smoke', 'process lifecycle']
            },
            full: {
                code: 'full',
                description: 'Extended local acceptance intended for enterprise qualification before handoff.',
                gates: ['standard gates', 'multi-domain checks', 'upgrade readiness', 'support bundle readiness']
            }
        };
        return profiles[options.acceptanceProfile] || profiles.standard;
    },

    portPlan: function (options) {
        return Object.entries(this.expectedUrls(options))
            .filter(([, value]) => value)
            .map(([code, url]) => ({
                code,
                url,
                port: Number(new URL(url).port),
                alternatePort: options.alternatePorts ? Number(new URL(url).port) + 100 : undefined
            }));
    },

    serviceDependencyGraph: function (options) {
        const graph = [
            { service: 'platform', dependsOn: [], reason: 'Owns common runtime APIs, module registry, and secured router metadata.' },
            { service: 'wcmsStaged', dependsOn: ['platform', 'mongodb', 'redis'], reason: 'Imports and validates staged WCMS/content data.' },
            { service: 'wcmsOnline', dependsOn: ['platform', 'mongodb', 'redis'], reason: 'Serves active online WCMS/content projections.' },
            { service: 'process', dependsOn: ['platform', 'mongodb', 'redis'], reason: 'Runs workflows, triggers, tasks, and cron handoff.' },
            { service: 'engagement', dependsOn: ['platform'], reason: 'Provides communication and engagement runtime APIs when enabled.' },
            { service: 'commerce', dependsOn: ['platform', 'mongodb', 'redis'], reason: 'Serves selected commerce accelerator APIs.' }
        ];
        if (options.apps.includes('axis')) {
            graph.push({ service: 'axis', dependsOn: ['platform', 'wcmsStaged', 'process'], reason: 'BackOffice UI consumes backend-published runtime capabilities.' });
        }
        if (options.companySite) {
            graph.push({ service: 'companySite', dependsOn: ['wcmsOnline'], reason: 'Company site renders online CMS content.' });
        }
        if (options.commerceSite) {
            graph.push({ service: 'commerceSite', dependsOn: ['commerce', 'wcmsOnline'], reason: 'Commerce site renders selected accelerator storefront data.' });
        }
        return graph;
    },

    customerCustomizationMap: function (options) {
        return {
            backendModules: path.join(options.application.projectName, 'modules'),
            environments: path.join(options.application.projectName, 'envs'),
            companySite: options.companySite ? options.application.companySiteName : undefined,
            commerceSite: options.commerceSite ? options.application.commerceSiteName : undefined,
            protectedVendorRoots: VENDOR_OWNED_REPOSITORIES
        };
    },

    dataSeedReadiness: function (options) {
        const manifestPath = path.join(options.application.projectPath, 'data', 'manifest.json');
        const moduleManifestCount = fs.existsSync(path.join(options.application.projectPath, 'modules')) ?
            this.collectFiles(path.join(options.application.projectPath, 'modules'),
                filePath => path.basename(filePath) === 'manifest.json' && filePath.includes(path.sep + 'data' + path.sep), 50).length : 0;
        return {
            status: fs.existsSync(manifestPath) || moduleManifestCount > 0 ? 'passed' : 'warning',
            rootManifest: fs.existsSync(manifestPath) ? manifestPath : undefined,
            moduleManifestCount,
            fix: fs.existsSync(manifestPath) || moduleManifestCount > 0 ? undefined :
                'Confirm starter data manifests before initialization, especially for selected accelerator data packs.'
        };
    },

    publishingReadiness: function (options) {
        return {
            status: 'planned',
            checks: [
                'mandatory approval workflow',
                'content catalogs',
                'media providers',
                'staged and online runtimes',
                'cross-enterprise rejection gates'
            ],
            command: options.mode === 'docker' ? 'npm run docker-local:acceptance' : 'npm run acceptance:local'
        };
    },

    mediaAssetReadiness: function (options) {
        const mediaRoots = [
            path.join(options.application.projectPath, 'data'),
            path.join(options.application.projectPath, 'modules')
        ];
        const mediaReferences = mediaRoots
            .filter(root => fs.existsSync(root))
            .flatMap(root => this.collectFiles(root, filePath => /media|asset/i.test(filePath), 50));
        return {
            status: mediaReferences.length ? 'passed' : 'warning',
            references: mediaReferences.map(filePath => path.relative(options.application.projectPath, filePath)),
            fix: mediaReferences.length ? undefined :
                'Verify selected accelerator media assets before publishing or storefront validation.'
        };
    },

    runtimeHealthPlan: function (plan) {
        return plan.portPlan.map(entry => ({
            code: entry.code,
            url: entry.url,
            expected: 'HTTP reachable after start'
        }));
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
        const runsAcceptance = options.executionLevel === 'acceptance' || options.acceptance;
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
            { stage: 'initialize', cwd: project, command: 'npm run acceptance:nexus-cms-media-seed', when: options.companySite,
                env: { NODICS_NEXUS_MEDIA_IMPORT_ONLINE: 'false' } },
            { stage: 'initialize', cwd: project, command: 'npm run acceptance:agora-cms-media-seed', when: options.accelerator !== 'common' },
            { stage: 'initialize', cwd: project, command: 'npm run acceptance:guided-initialization', when: options.accelerator !== 'common' },
            { stage: 'acceptance', cwd: project, command: 'npm run acceptance:local', when: runsAcceptance,
                env: {
                    AXIS_PROJECT: options.application.projectName,
                    NODICS_AXIS_ROOT: options.application.axisPath
                } },
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

    vendorRepositoryPolicy: function () {
        return {
            owner: 'Nodics',
            repositories: VENDOR_OWNED_REPOSITORIES,
            customerRule: 'Do not change partner or customer custom code inside vendor-owned repositories.',
            reason: 'Local changes under nodics.ai or nodics.axis make future Nodics upgrades and migrations difficult.',
            allowedWork: [
                'read source and documentation',
                'run documented local scripts',
                'sync to an approved release branch or tag',
                'report required changes upstream to Nodics'
            ],
            customWorkRoots: [
                'named customer backend project',
                'named customer company site',
                'named customer commerce sites',
                'customer-owned modules and environments'
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
        const acceptanceProfile = this.acceptanceProfile(options);
        const environmentProfile = this.environmentProfile(options);
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
                environmentProfile,
                acceptanceProfile,
                release: options.release,
                releaseChannel: options.releaseChannel,
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
            supportMatrix: SUPPORT_MATRIX,
            jsonContracts: JSON_RESULT_CONTRACTS,
            serviceDependencyGraph: this.serviceDependencyGraph(options),
            portPlan: this.portPlan(options),
            runtimeHealthPlan: this.runtimeHealthPlan({ portPlan: this.portPlan(options) }),
            databaseLifecyclePolicy: {
                retainedData: environmentProfile.retainedData,
                freshDataRequested: options.freshData,
                destructiveReset: environmentProfile.destructiveReset,
                rule: 'Retained-data acceptance verifies existing data through public APIs; destructive reset is only allowed through explicit fresh-data flows.'
            },
            installStrategy: {
                lockfilePreferred: true,
                lockfileCommand: 'npm ci',
                fallbackCommand: 'npm install',
                rule: 'Use npm ci when package-lock.json exists; otherwise use npm install and record the command in evidence.'
            },
            enterprisePolicy: {
                offlineCache: options.offlineCache || undefined,
                proxy: options.proxy || undefined,
                npmRegistry: options.npmRegistry || undefined,
                policyPack: options.policyPack || undefined,
                privacy: 'Console output, evidence, and support bundles must redact tokens, bearer headers, passwords, and secrets.',
                telemetry: 'Installer evidence records local timings and failure categories only; it does not send telemetry.'
            },
            recovery: {
                resume: options.resume,
                retryFailed: options.retryFailed,
                fromStep: options.fromStep || undefined,
                cleanupAction: 'cleanup-workspace',
                supportBundleAction: 'support-bundle'
            },
            customerCustomizationMap: this.customerCustomizationMap(options),
            generatedFilePolicy: {
                generated: ['.nodics-installer-identity.json', '.nodics-installer-lock.json', 'envs/*/generated'],
                customerOwned: ['named backend project modules', 'named environment overrides', 'named company and commerce sites'],
                vendorOwned: VENDOR_OWNED_REPOSITORIES
            },
            dataSeedReadiness: this.dataSeedReadiness(options),
            publishingReadiness: this.publishingReadiness(options),
            mediaAssetReadiness: this.mediaAssetReadiness(options),
            beginnerNextSteps: [
                'Open Axis at ' + (this.expectedUrls(options).axis || 'disabled') + '.',
                'Open the company site at ' + (this.expectedUrls(options).companySite || 'disabled') + '.',
                'Open the commerce site at ' + (this.expectedUrls(options).commerceSite || 'disabled') + '.',
                'Keep custom work inside the named customer project, modules, environments, and sites.',
                'Do not change nodics.ai or nodics.axis directly; report required framework or BackOffice changes upstream.'
            ],
            accelerator: {
                code: options.accelerator,
                domains: profile.domains,
                dataPacks: this.applicationDataPacks(options, profile),
                gates: profile.gates
            },
            initialProvisioning: this.initialProvisioning(options),
            vendorRepositoryPolicy: this.vendorRepositoryPolicy(),
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
                'Customer and partner customizations must stay out of nodics.ai and nodics.axis.',
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
        lines.push('', 'Vendor-owned repository boundary:');
        lines.push('- Do not customize: ' + plan.vendorRepositoryPolicy.repositories.join(', '));
        lines.push('- Custom work belongs in: ' + plan.vendorRepositoryPolicy.customWorkRoots.join(', '));
        lines.push('- Why: ' + plan.vendorRepositoryPolicy.reason);
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
            .replace(new RegExp(this.escapeRegExp(os.homedir()), 'g'), '[home]')
            .replace(/gh[pousr]_[A-Za-z0-9_]+/g, '[redacted-github-token]')
            .replace(/(authorization:\s*bearer\s+)[^\s]+/ig, '$1[redacted]')
            .replace(/((?:token|password|secret)=)[^\s&]+/ig, '$1[redacted]');
    },

    escapeRegExp: function (value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },

    sanitizeForSupportBundle: function (value) {
        if (Array.isArray(value)) {
            return value.map(item => this.sanitizeForSupportBundle(item));
        }
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value)
                .map(([key, entry]) => [key, this.sanitizeForSupportBundle(entry)]));
        }
        if (typeof value === 'string') {
            return this.sanitizeOutput(value);
        }
        return value;
    },

    runCommand: function (executable, args, options) {
        const startedAt = new Date().toISOString();
        const result = childProcess.spawnSync(executable, args || [], {
            cwd: options.cwd,
            env: options.env || process.env,
            encoding: 'utf8',
            shell: Boolean(options.shell)
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

    canWriteDirectory: function (directoryPath) {
        if (!fs.existsSync(directoryPath)) {
            return false;
        }
        const probePath = path.join(directoryPath, '.nodics-installer-write-test-' + process.pid + '-' + Date.now());
        try {
            fs.writeFileSync(probePath, 'ok');
            fs.rmSync(probePath, { force: true });
            return true;
        } catch (error) {
            return false;
        }
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

    parseMajorVersion: function (value) {
        const match = String(value || '').match(/v?(\d+)\./);
        return match ? Number(match[1]) : null;
    },

    supportedMajorStatus: function (value, support) {
        const major = this.parseMajorVersion(value);
        if (major === null) {
            return 'unknown';
        }
        return major >= support.minimumMajor && major <= support.maximumMajor ? 'passed' : 'warning';
    },

    commandPathCheck: function (command) {
        const resolved = String(process.env.PATH || '')
            .split(path.delimiter)
            .map(directory => path.join(directory, command))
            .find(candidate => fs.existsSync(candidate));
        return {
            code: 'path-' + command,
            required: false,
            status: resolved ? 'passed' : 'warning',
            path: resolved,
            fix: resolved ? undefined : 'Add `' + command + '` to PATH or install it before running full local setup.'
        };
    },

    diskSpaceCheck: function (targetPath) {
        const root = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
        const result = this.runCommand('df', ['-k', root], { cwd: process.cwd(), allowFailure: true });
        if (result.status !== 'passed') {
            return {
                code: 'disk-space',
                required: false,
                status: 'warning',
                fix: 'Ensure at least ' + SUPPORT_MATRIX.hardware.minimumDiskGb + 'GB free disk space before full setup.'
            };
        }
        const rows = result.stdout.trim().split(/\r?\n/);
        const columns = rows[rows.length - 1].split(/\s+/);
        const availableGb = Number(columns[3] || 0) / 1024 / 1024;
        return {
            code: 'disk-space',
            required: true,
            status: availableGb >= SUPPORT_MATRIX.hardware.minimumDiskGb ? 'passed' : 'failed',
            availableGb: Number(availableGb.toFixed(1)),
            fix: availableGb >= SUPPORT_MATRIX.hardware.minimumDiskGb ? undefined :
                'Free at least ' + SUPPORT_MATRIX.hardware.minimumDiskGb + 'GB before running setup.'
        };
    },

    machineProfileChecks: function (options) {
        const memoryGb = os.totalmem() / 1024 / 1024 / 1024;
        const checks = [
            {
                code: 'os',
                required: true,
                status: ['darwin', 'linux', 'win32'].includes(process.platform) ? 'passed' : 'warning',
                platform: process.platform,
                arch: process.arch,
                fix: ['darwin', 'linux', 'win32'].includes(process.platform) ? undefined :
                    'Use macOS, Linux, or Windows with a supported shell.'
            },
            {
                code: 'hardware-memory',
                required: false,
                status: memoryGb >= SUPPORT_MATRIX.hardware.minimumMemoryGb ? 'passed' : 'warning',
                memoryGb: Number(memoryGb.toFixed(1)),
                fix: memoryGb >= SUPPORT_MATRIX.hardware.minimumMemoryGb ? undefined :
                    'Use at least ' + SUPPORT_MATRIX.hardware.minimumMemoryGb + 'GB RAM; ' +
                    SUPPORT_MATRIX.hardware.recommendedMemoryGb + 'GB is recommended for full local topology.'
            },
            {
                code: 'shell',
                required: false,
                status: process.env.SHELL ? 'passed' : 'warning',
                shell: process.env.SHELL || '',
                fix: process.env.SHELL ? undefined : 'Run from a normal terminal shell so PATH can be detected.'
            },
            this.diskSpaceCheck(options.workspace)
        ];
        if (process.platform === 'darwin') {
            const brew = this.commandPathCheck('brew');
            checks.push({
                ...brew,
                code: 'homebrew',
                fix: brew.status === 'passed' ? undefined :
                    'Install Homebrew from https://brew.sh, then use brew install node git redis mongodb-community where appropriate.'
            });
        }
        return checks;
    },

    repositoryAccessChecks: function (plan, options) {
        return plan.repositories.map(repository => {
            const source = repository.repository;
            const result = this.runCommand('git', ['ls-remote', '--heads', '--tags', source, options.release],
                {
                cwd: process.cwd(),
                allowFailure: true
            });
            return {
                code: 'git-access-' + repository.code,
                required: false,
                status: result.status === 'passed' && result.stdout.trim() ? 'passed' : 'warning',
                repository: repository.name,
                release: options.release,
                fix: result.status === 'passed' && result.stdout.trim() ? undefined :
                    'Check GitHub access, SSH keys or HTTPS credentials, proxy, and that branch/tag `' + options.release + '` exists.'
            };
        });
    },

    existingRepositoryHealthChecks: function (plan) {
        return plan.repositories
            .filter(repository => fs.existsSync(repository.targetPath))
            .flatMap(repository => {
                const checks = [];
                if (this.isGitCheckout(repository.targetPath)) {
                    const status = this.runCommand('git', ['status', '--short'], {
                        cwd: repository.targetPath,
                        allowFailure: true
                    });
                    checks.push({
                        code: 'repository-drift-' + repository.code,
                        required: VENDOR_OWNED_REPOSITORIES.includes(repository.name),
                        status: status.status === 'passed' && !status.stdout.trim() ? 'passed' : 'warning',
                        repository: repository.name,
                        fix: status.status === 'passed' && !status.stdout.trim() ? undefined :
                            'Review local changes. Vendor-owned repositories should be clean before setup, upgrade, or support handoff.'
                    });
                }
                const packagePath = path.join(repository.targetPath, 'package.json');
                const lockPath = path.join(repository.targetPath, 'package-lock.json');
                if (fs.existsSync(packagePath)) {
                    checks.push({
                        code: 'dependency-strategy-' + repository.code,
                        required: false,
                        status: 'passed',
                        repository: repository.name,
                        strategy: fs.existsSync(lockPath) ? 'npm ci' : 'npm install',
                        fix: fs.existsSync(lockPath) ? undefined :
                            'No package-lock.json found; installer will use npm install and record the result.'
                    });
                }
                if (fs.existsSync(path.join(repository.targetPath, 'node_modules')) && fs.existsSync(lockPath)) {
                    checks.push({
                        code: 'dependency-cache-' + repository.code,
                        required: false,
                        status: 'passed',
                        repository: repository.name,
                        fix: undefined
                    });
                }
                return checks;
            });
    },

    frontendEnvironmentChecks: function (options) {
        const checks = [];
        const expectations = [
            options.apps.includes('axis') ? {
                code: 'axis',
                path: path.join(options.application.axisPath, '.env'),
                keys: { AXIS_PROJECT_CODE: options.application.projectName }
            } : null,
            options.companySite ? {
                code: 'company-site',
                path: path.join(options.application.companySitePath, '.env'),
                keys: { NEXUS_PLATFORM_BASE_URL: 'http://localhost:4300' }
            } : null,
            options.commerceSite ? {
                code: 'commerce-site',
                path: path.join(options.application.commerceSitePath, '.env'),
                keys: { VITE_STOREFRONT_COMMERCE_PROXY_TARGET: 'http://localhost:4350' }
            } : null
        ].filter(Boolean);
        expectations.forEach(expectation => {
            if (!fs.existsSync(expectation.path)) {
                checks.push({
                    code: 'frontend-env-' + expectation.code,
                    required: false,
                    status: 'warning',
                    path: expectation.path,
                    fix: 'Run repair or configure so frontend .env values match the generated backend ports.'
                });
                return;
            }
            const content = fs.readFileSync(expectation.path, 'utf8');
            const missing = Object.entries(expectation.keys)
                .filter(([key, value]) => !content.includes(key + '=' + value))
                .map(([key]) => key);
            checks.push({
                code: 'frontend-env-' + expectation.code,
                required: false,
                status: missing.length ? 'warning' : 'passed',
                path: expectation.path,
                missing,
                fix: missing.length ? 'Run --action=repair --yes to rewrite frontend local environment values.' : undefined
            });
        });
        return checks;
    },

    policyPackCheck: function (options) {
        if (!options.policyPack) {
            return {
                code: 'enterprise-policy-pack',
                required: false,
                status: 'skipped',
                fix: 'Use --policy-pack=/path when an enterprise policy pack must be validated.'
            };
        }
        return {
            code: 'enterprise-policy-pack',
            required: true,
            status: fs.existsSync(options.policyPack) ? 'passed' : 'failed',
            path: options.policyPack,
            fix: fs.existsSync(options.policyPack) ? undefined : 'Provide a readable enterprise policy pack path.'
        };
    },

    preflight: async function (plan, options) {
        const checks = this.machineProfileChecks(options);
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
            let status = result.status;
            let fix = result.status === 'passed' ? undefined : 'Install or make `' + executable + '` available on PATH.';
            if (result.status === 'passed' && prerequisite.code === 'node') {
                status = this.supportedMajorStatus(result.stdout, SUPPORT_MATRIX.node);
                fix = status === 'passed' ? undefined : 'Install Node.js ' + SUPPORT_MATRIX.node.recommended + '.';
            }
            if (result.status === 'passed' && prerequisite.code === 'npm') {
                status = this.supportedMajorStatus(result.stdout, SUPPORT_MATRIX.npm);
                fix = status === 'passed' ? undefined : 'Install npm ' + SUPPORT_MATRIX.npm.recommended + '.';
            }
            checks.push({
                code: prerequisite.code,
                required: prerequisite.required,
                status,
                version: result.stdout.trim() || result.stderr.trim(),
                fix
            });
        }
        ['node', 'npm', 'git'].forEach(command => checks.push(this.commandPathCheck(command)));
        const workspaceParent = path.dirname(options.workspace);
        checks.push({
            code: 'workspace-parent',
            required: true,
            status: fs.existsSync(workspaceParent) ? 'passed' : 'failed',
            path: workspaceParent,
            fix: fs.existsSync(workspaceParent) ? undefined : 'Create the parent folder or choose another --workspace path.'
        });
        checks.push({
            code: 'workspace-write',
            required: true,
            status: this.canWriteDirectory(workspaceParent) ? 'passed' : 'failed',
            path: workspaceParent,
            fix: this.canWriteDirectory(workspaceParent) ? undefined : 'Choose a writable workspace parent folder.'
        });
        checks.push(...this.repositoryAccessChecks(plan, options));
        checks.push(...this.existingRepositoryHealthChecks(plan));
        checks.push(...this.frontendEnvironmentChecks(options));
        checks.push(this.policyPackCheck(options));
        const ports = Object.values(plan.expectedUrls)
            .filter(Boolean)
            .map(value => Number(new URL(value).port))
            .filter(Boolean);
        for (const port of Array.from(new Set(ports))) {
            const busy = await this.portListening(port);
            checks.push({ code: 'port-' + port, required: true, status: busy ? 'failed' : 'passed', busy });
        }
        return {
            contractVersion: JSON_RESULT_CONTRACTS.preflight,
            operation: 'local-setup-preflight',
            supportMatrix: SUPPORT_MATRIX,
            portPlan: plan.portPlan,
            ok: checks.every(check => check.status === 'passed' || check.status === 'skipped' || check.status === 'warning' || !check.required),
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
            progress: {
                currentStep: undefined,
                completedSteps: 0,
                totalPlannedSteps: plan.setupSteps.length,
                lastCommand: undefined,
                nextStep: 'download'
            },
            localMetrics: {
                telemetrySent: false,
                stepCount: 0,
                failureCategories: []
            },
            steps: []
        };
    },

    refreshEvidenceContext: function (evidence, plan, options) {
        evidence.workspace = options.workspace;
        evidence.action = options.action;
        evidence.executionLevel = options.executionLevel;
        evidence.release = options.release;
        evidence.plan = plan;
        evidence.progress = evidence.progress || {
            completedSteps: evidence.steps ? evidence.steps.length : 0,
            totalPlannedSteps: plan.setupSteps.length
        };
        evidence.localMetrics = evidence.localMetrics || { telemetrySent: false, stepCount: 0, failureCategories: [] };
        evidence.finishedAt = undefined;
        return evidence;
    },

    prepareEvidenceForResume: function (evidence, options) {
        if (options.retryFailed) {
            evidence.steps = evidence.steps.filter(step => step.status !== 'failed');
        }
        if (options.fromStep) {
            const order = [
                'download', 'rebrand', 'vendor-boundary', 'install-framework', 'configure', 'install',
                'preflight', 'topology-preflight', 'start', 'initialize', 'acceptance'
            ];
            const startIndex = order.indexOf(options.fromStep);
            if (startIndex !== -1) {
                const rerun = new Set(order.slice(startIndex));
                evidence.steps = evidence.steps.filter(step => !rerun.has(step.code));
            }
        }
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
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
    },

    validateLocalBootstrapCapabilities: function (capabilities) {
        const errors = [];
        const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
        const requireString = (value, pathName) => {
            if (typeof value !== 'string' || !value.trim()) {
                errors.push(pathName + ' must be a non-empty string.');
            }
        };
        if (!isObject(capabilities)) {
            return ['acceptance.localBootstrap must be an object.'];
        }
        if (!Array.isArray(capabilities.documentationPacks)) {
            errors.push('acceptance.localBootstrap.documentationPacks must be an array.');
        } else {
            capabilities.documentationPacks.forEach((pack, index) => {
                const base = 'acceptance.localBootstrap.documentationPacks[' + index + ']';
                if (!isObject(pack)) {
                    errors.push(base + ' must be an object.');
                    return;
                }
                requireString(pack.code, base + '.code');
                requireString(pack.profileCode, base + '.profileCode');
                requireString(pack.navigationComponent, base + '.navigationComponent');
                requireString(pack.site, base + '.site');
                requireString(pack.path, base + '.path');
                if (typeof pack.path === 'string' && !pack.path.startsWith('/')) {
                    errors.push(base + '.path must start with /.');
                }
                if (!Number.isInteger(pack.minimumRoutes) || pack.minimumRoutes < 0) {
                    errors.push(base + '.minimumRoutes must be a non-negative integer.');
                }
            });
        }
        if (!Array.isArray(capabilities.contentPacks)) {
            errors.push('acceptance.localBootstrap.contentPacks must be an array.');
        }
        if (!isObject(capabilities.axisSmoke)) {
            errors.push('acceptance.localBootstrap.axisSmoke must be an object.');
            return errors;
        }
        ['expectModules', 'expectDocumentation', 'cronLifecycle', 'processLifecycle'].forEach(field => {
            if (typeof capabilities.axisSmoke[field] !== 'boolean') {
                errors.push('acceptance.localBootstrap.axisSmoke.' + field + ' must be true or false.');
            }
        });
        if (!Array.isArray(capabilities.axisSmoke.routes)) {
            errors.push('acceptance.localBootstrap.axisSmoke.routes must be an array.');
        } else {
            capabilities.axisSmoke.routes.forEach((route, index) => {
                if (typeof route !== 'string' || !route.startsWith('/')) {
                    errors.push('acceptance.localBootstrap.axisSmoke.routes[' + index + '] must start with /.');
                }
            });
        }
        return errors;
    },

    assertValidLocalBootstrapCapabilities: function (capabilities) {
        const errors = this.validateLocalBootstrapCapabilities(capabilities);
        if (errors.length) {
            throw new Error('Generated local acceptance capabilities are invalid:\n- ' + errors.join('\n- '));
        }
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
        if (step.replaceExisting) {
            evidence.steps = evidence.steps.filter(existing => existing.code !== step.code);
        }
        const { replaceExisting, ...recordedStep } = step;
        evidence.steps.push({
            ...recordedStep,
            timestamp: new Date().toISOString()
        });
        evidence.progress = evidence.progress || {};
        evidence.progress.currentStep = recordedStep.code;
        evidence.progress.completedSteps = evidence.steps.length;
        evidence.progress.lastCommand = recordedStep.result && recordedStep.result.command;
        evidence.progress.nextStep = undefined;
        evidence.localMetrics = evidence.localMetrics || { telemetrySent: false, failureCategories: [] };
        evidence.localMetrics.telemetrySent = false;
        evidence.localMetrics.stepCount = evidence.steps.length;
        if (recordedStep.status === 'failed' && recordedStep.result && recordedStep.result.diagnosis) {
            evidence.localMetrics.failureCategories = Array.from(new Set([
                ...(evidence.localMetrics.failureCategories || []),
                recordedStep.result.diagnosis.code
            ]));
        }
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

    vendorRepositoryPaths: function (options) {
        return VENDOR_OWNED_REPOSITORIES
            .map(repository => path.join(options.workspace, repository))
            .filter(repositoryPath => fs.existsSync(repositoryPath));
    },

    vendorBoundaryStatus: function (options) {
        const forbiddenFiles = ['.env', '.nodics-installer-identity.json'];
        const repositories = this.vendorRepositoryPaths(options).map(repositoryPath => {
            const result = {
                name: path.basename(repositoryPath),
                path: repositoryPath,
                gitCheckout: this.isGitCheckout(repositoryPath),
                forbiddenFiles: forbiddenFiles.filter(fileName => fs.existsSync(path.join(repositoryPath, fileName)))
            };
            if (result.gitCheckout) {
                const status = this.runCommand('git', ['status', '--short'], { cwd: repositoryPath, allowFailure: false });
                result.dirty = Boolean(status.stdout.trim());
            }
            return result;
        });
        const violations = repositories.filter(repository => repository.dirty || repository.forbiddenFiles.length > 0);
        if (violations.length > 0) {
            throw new Error('Vendor-owned repository boundary violation: ' + violations
                .map(repository => repository.name + (repository.forbiddenFiles.length ?
                    ' forbidden files: ' + repository.forbiddenFiles.join(', ') : ' dirty checkout'))
                .join('; '));
        }
        return {
            ok: true,
            repositories
        };
    },

    assertVendorRepositoriesUnmodified: function (options) {
        return this.vendorBoundaryStatus(options);
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

    axisRuntimeEnvironment: function (options) {
        return {
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
        };
    },

    axisRuntimeCommand: function (options) {
        return {
            command: 'npm',
            args: ['run', 'dev'],
            env: this.axisRuntimeEnvironment(options)
        };
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

    installerLock: function (plan, options) {
        return {
            contractVersion: 1,
            installer: {
                packageName: plan.installer.packageName,
                version: VERSION
            },
            generatedAt: new Date().toISOString(),
            application: {
                name: options.application.name,
                code: options.application.code,
                projectName: options.application.projectName,
                environment: this.initialProvisioning(options).environment,
                accelerator: options.accelerator,
                environmentProfile: options.environmentProfile,
                acceptanceProfile: options.acceptanceProfile
            },
            sourceTemplate: options.application.sourceTemplate,
            preservedSourceTemplateIdentity: options.application.preservesSourceTemplateIdentity,
            release: options.release,
            releaseChannel: options.releaseChannel,
            repositories: plan.repositories.map(repository => ({
                code: repository.code,
                name: repository.name,
                release: repository.release,
                path: repository.targetPath,
                vendorOwned: VENDOR_OWNED_REPOSITORIES.includes(repository.name)
            })),
            sites: {
                company: options.companySite ? options.application.companySiteName : undefined,
                commerce: options.commerceSite ? options.application.commerceSiteName : undefined
            },
            ownership: this.customerCustomizationMap(options)
        };
    },

    writeInstallerLock: function (rootPath, plan, options) {
        const lockPath = path.join(rootPath, '.nodics-installer-lock.json');
        this.writeJsonFile(lockPath, this.installerLock(plan, options));
        return lockPath;
    },

    readStarterTemplateDescriptor: function (options) {
        const descriptorPath = path.join(options.application.projectPath, 'nodics.installer.json');
        if (!fs.existsSync(descriptorPath)) {
            return null;
        }
        return this.readJsonFile(descriptorPath);
    },

    starterTemplateAcceptanceCapabilities: function (options) {
        const descriptor = fs.existsSync(options.application.projectPath) ?
            this.readStarterTemplateDescriptor(options) : null;
        const descriptorCapabilities = descriptor && descriptor.acceptance;
        if (descriptorCapabilities) {
            const capabilities = options.application.preservesSourceTemplateIdentity ?
                descriptorCapabilities.preservedIdentity : descriptorCapabilities.generatedProject;
            if (capabilities) {
                this.assertValidStarterTemplateCapabilities(capabilities);
                return capabilities;
            }
        }
        const template = STARTER_TEMPLATE_REGISTRY[options.application.sourceTemplate];
        if (!template) {
            return { documentationPacks: [], routes: [], expectDocumentation: false };
        }
        return options.application.preservesSourceTemplateIdentity ?
            template.preservedIdentity : template.generatedProject;
    },

    assertValidStarterTemplateCapabilities: function (capabilities) {
        const errors = [];
        if (!Array.isArray(capabilities.documentationPacks)) {
            errors.push('acceptance.generatedProject.documentationPacks must be an array.');
        }
        if (!Array.isArray(capabilities.routes)) {
            errors.push('acceptance.generatedProject.routes must be an array.');
        }
        if (typeof capabilities.expectDocumentation !== 'boolean') {
            errors.push('acceptance.generatedProject.expectDocumentation must be true or false.');
        }
        if (errors.length) {
            throw new Error('Starter template capability descriptor is invalid:\n- ' + errors.join('\n- '));
        }
    },

    localBootstrapAcceptanceCapabilities: function (options) {
        const documentationPacks = [
            {
                code: 'nodicsDocumentation',
                profileCode: 'frameworkdocs',
                minimumRoutes: 9,
                navigationComponent: 'nodicsDocumentationNavigation',
                site: 'nodicsDocumentationSite',
                path: '/docs/framework'
            },
            {
                code: 'axisDocumentation',
                profileCode: 'axisdocs',
                minimumRoutes: 14,
                navigationComponent: 'axisDocumentationNavigation',
                site: 'axisDocumentationSite',
                path: '/docs/nodics-axis'
            }
        ];
        const templateCapabilities = this.starterTemplateAcceptanceCapabilities(options);
        if (templateCapabilities.documentationPacks.length) {
            documentationPacks.push(...templateCapabilities.documentationPacks.map(pack => ({ ...pack })));
        }
        const smokeRoutes = [
            '/',
            '/docs',
            '/docs/framework',
            '/docs/nodics-axis',
            '/content',
            '/content/designer',
            '/media',
            '/process',
            '/process/definitions',
            '/process/tasks',
            '/process/triggers',
            '/process/designer',
            '/cron',
            '/system-integrations',
            '/registry',
            '/operations/imports-exports',
            '/docs/framework/process',
            '/docs/framework/process/visual-designer',
            '/docs/swaggers'
        ];
        if (templateCapabilities.routes.length) {
            smokeRoutes.splice(4, 0, ...templateCapabilities.routes);
        }
        const capabilities = {
            documentationPacks,
            contentPacks: [],
            axisSmoke: {
                expectModules: true,
                expectDocumentation: Boolean(templateCapabilities.expectDocumentation),
                cronLifecycle: true,
                processLifecycle: true,
                routes: smokeRoutes
            }
        };
        this.assertValidLocalBootstrapCapabilities(capabilities);
        return capabilities;
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
                cwd: '{workspaceRoot}/' + path.basename(options.application.axisPath),
                ...this.axisRuntimeCommand(options)
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
        projectJson.acceptance = projectJson.acceptance || {};
        const localBootstrap = this.localBootstrapAcceptanceCapabilities(options);
        if (JSON.stringify(projectJson.acceptance.localBootstrap) !== JSON.stringify(localBootstrap)) {
            projectJson.acceptance.localBootstrap = localBootstrap;
            changed = true;
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
        changed.push(this.writeInstallerLock(options.application.projectPath, plan, options));
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

    runProjectCommand: function (options, script, commandArgs, allowFailure, env) {
        return this.runCommand('npm', ['run', script, ...(commandArgs || [])], {
            cwd: options.application.projectPath,
            allowFailure: Boolean(allowFailure),
            env: env ? Object.assign({}, process.env, env) : undefined
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
        const commands = [];
        if (options.companySite) {
            commands.push(this.runProjectCommand(options, 'acceptance:nexus-cms-media-seed', [], false, {
                NODICS_NEXUS_MEDIA_IMPORT_ONLINE: 'false'
            }));
        }
        if (options.accelerator !== 'common') {
            commands.push(this.runProjectCommand(options, 'acceptance:agora-cms-media-seed', [], false));
            commands.push(this.runProjectCommand(options, 'acceptance:guided-initialization', [], false));
        }
        return {
            status: 'passed',
            operation: 'guided-initialization',
            commands,
            finishedAt: new Date().toISOString()
        };
    },

    runAcceptanceChecks: function (options) {
        return options.mode === 'docker' ?
            this.runProjectCommand(options, 'docker-local:acceptance', [], false) :
            this.runProjectCommand(options, 'acceptance:local', [], false, {
                AXIS_PROJECT: options.application.projectName,
                NODICS_AXIS_ROOT: options.application.axisPath,
                NODICS_ACCEPTANCE_PROFILE: options.acceptanceProfile
            });
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

    updateProjectDescriptor: function (options, updater) {
        const projectJsonPath = path.join(options.application.projectPath, 'nodics.project.json');
        const projectJson = fs.existsSync(projectJsonPath) ? this.readJsonFile(projectJsonPath) : {};
        const changed = updater(projectJson);
        if (!changed) {
            return [];
        }
        this.writeJsonFile(projectJsonPath, projectJson);
        return [projectJsonPath];
    },

    appendUniqueValue: function (values, value) {
        const nextValues = Array.isArray(values) ? values : [];
        if (!nextValues.includes(value)) {
            nextValues.push(value);
            return true;
        }
        return false;
    },

    expansionEvidencePath: function (options) {
        return path.join(options.workspace, '.nodics-installer', 'expansion-evidence.json');
    },

    requireSetupEvidence: function (plan, options) {
        const evidence = this.readEvidence(plan.evidencePath);
        if (!evidence) {
            throw new Error('Expansion requires existing setup evidence. Run first setup before using ' + options.action + '.');
        }
        return evidence;
    },

    writeExpansionEvidence: function (options, entry) {
        const evidencePath = this.expansionEvidencePath(options);
        const evidence = this.readEvidence(evidencePath) || {
            contractVersion: 1,
            operation: 'local-expansion-evidence',
            workspace: options.workspace,
            application: options.application,
            entries: []
        };
        evidence.workspace = options.workspace;
        evidence.application = options.application;
        evidence.entries.push({
            ...entry,
            timestamp: new Date().toISOString()
        });
        this.writeEvidence(evidencePath, evidence);
        return evidencePath;
    },

    assertProjectReadyForExpansion: function (options) {
        if (!fs.existsSync(options.application.projectPath)) {
            throw new Error('Customer project is missing: ' + options.application.projectPath);
        }
        this.assertVendorRepositoriesUnmodified(options);
    },

    copyDirectory: function (sourcePath, targetPath) {
        if (!fs.existsSync(sourcePath)) {
            throw new Error('Source path is missing: ' + sourcePath);
        }
        if (fs.existsSync(targetPath)) {
            throw new Error('Target path already exists: ' + targetPath);
        }
        fs.cpSync(sourcePath, targetPath, {
            recursive: true,
            filter: source => path.basename(source) !== 'node_modules'
        });
        return [targetPath];
    },

    collectPackageJsonFiles: function (rootPath) {
        const files = [];
        const visit = currentPath => {
            const entries = fs.existsSync(currentPath) ? fs.readdirSync(currentPath, { withFileTypes: true }) : [];
            entries.forEach(entry => {
                const entryPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name !== 'node_modules' && entry.name !== '.git') {
                        visit(entryPath);
                    }
                    return;
                }
                if (entry.isFile() && entry.name === 'package.json') {
                    files.push(entryPath);
                }
            });
        };
        visit(rootPath);
        return files;
    },

    nextEnvironmentIndexBase: function (options, targetPath) {
        const envsPath = path.join(options.application.projectPath, 'envs');
        const bases = this.collectPackageJsonFiles(envsPath)
            .filter(filePath => {
                const relativePath = path.relative(targetPath, filePath);
                return relativePath.startsWith('..') || path.isAbsolute(relativePath);
            })
            .map(filePath => {
                try { return Math.floor(Number(this.readJsonFile(filePath).index)); } catch { return 0; }
            })
            .filter(index => Number.isInteger(index) && index > 0);
        return bases.length ? Math.max(...bases) + 1 : 1001;
    },

    reindexEnvironmentModules: function (targetPath, options) {
        const nextBase = this.nextEnvironmentIndexBase(options, targetPath);
        const changed = [];
        this.collectPackageJsonFiles(targetPath).forEach(filePath => {
            const packageJson = this.readJsonFile(filePath);
            if (packageJson.index === undefined || packageJson.index === null) {
                return;
            }
            const currentIndex = String(packageJson.index);
            const numericIndex = Number(currentIndex);
            if (!Number.isFinite(numericIndex)) {
                return;
            }
            const suffix = currentIndex.includes('.') ? currentIndex.slice(currentIndex.indexOf('.')) : '';
            const nextIndex = String(nextBase) + suffix;
            if (currentIndex !== nextIndex) {
                packageJson.index = nextIndex;
                this.writeJsonFile(filePath, packageJson);
                changed.push(filePath);
            }
        });
        return changed;
    },

    nextCustomerModuleIndex: function (options) {
        const modulesPath = path.join(options.application.projectPath, 'modules');
        const indexes = this.collectPackageJsonFiles(modulesPath)
            .map(filePath => {
                try { return Number(this.readJsonFile(filePath).index); } catch { return 0; }
            })
            .filter(index => Number.isFinite(index) && index > 0);
        const nextIndex = (indexes.length ? Math.max(...indexes) : 3100.13) + 0.01;
        return nextIndex.toFixed(2);
    },

    updateProjectExpansionMetadata: function (options, key, value) {
        return this.updateProjectDescriptor(options, projectJson => {
            projectJson.expansions = projectJson.expansions || {};
            projectJson.expansions[key] = projectJson.expansions[key] || [];
            return this.appendUniqueValue(projectJson.expansions[key], value);
        });
    },

    addEnvironment: function (plan, options) {
        this.requireSetupEvidence(plan, options);
        this.assertProjectReadyForExpansion(options);
        const sourceEnvironment = options.fromEnvironment || this.initialProvisioning(options).environment;
        const sourcePath = path.join(options.application.projectPath, 'envs', sourceEnvironment);
        const targetPath = path.join(options.application.projectPath, 'envs', options.environmentName);
        const changed = this.copyDirectory(sourcePath, targetPath);
        changed.push(...this.collectRebrandableFiles(targetPath)
            .filter(filePath => this.replaceTextInFile(filePath, [[sourceEnvironment, options.environmentName]])));
        changed.push(...this.reindexEnvironmentModules(targetPath, options));
        changed.push(...this.updateProjectExpansionMetadata(options, 'environments', {
            name: options.environmentName,
            source: sourceEnvironment,
            mode: options.mode
        }));
        const evidencePath = this.writeExpansionEvidence(options, {
            action: 'add-environment',
            environmentName: options.environmentName,
            fromEnvironment: sourceEnvironment,
            changed: Array.from(new Set(changed)).map(filePath => path.relative(options.workspace, filePath))
        });
        return {
            operation: 'local-expansion-add-environment',
            ok: true,
            environmentName: options.environmentName,
            fromEnvironment: sourceEnvironment,
            changed: Array.from(new Set(changed)).map(filePath => path.relative(options.workspace, filePath)),
            evidencePath
        };
    },

    addModule: function (plan, options) {
        this.requireSetupEvidence(plan, options);
        this.assertProjectReadyForExpansion(options);
        const modulePath = path.join(options.application.projectPath, 'modules', options.moduleName);
        if (fs.existsSync(modulePath)) {
            throw new Error('Module already exists: ' + modulePath);
        }
        fs.mkdirSync(path.join(modulePath, 'config'), { recursive: true });
        fs.mkdirSync(path.join(modulePath, 'src', 'service'), { recursive: true });
        this.writeJsonFile(path.join(modulePath, 'package.json'), {
            name: options.moduleName,
            index: this.nextCustomerModuleIndex(options),
            description: this.toDisplayTitle(options.moduleName, options.moduleName) + ' customer capability module.',
            homepage: 'http://www.nodics.com/',
            keywords: [
                options.moduleName
            ],
            author: 'Nodics',
            main: 'nodics.js',
            version: '0.0.0',
            private: true,
            license: 'SEE LICENSE IN LICENSE',
            repository: {
                type: 'git',
                url: 'https://github.com/Nodics/' + options.application.projectName + '.git'
            },
            dependencies: {},
            nodics: {
                kind: options.modulePreset,
                owner: options.application.projectName,
                runtimeModule: true,
                loadableByNodicsModuleLoader: true,
                owns: [
                    'configuration',
                    'llm'
                ],
                runtime: {
                    router: false,
                    publish: false,
                    web: false
                },
                displayName: this.toDisplayTitle(options.moduleName, options.moduleName)
            }
        });
        fs.writeFileSync(path.join(modulePath, 'nodics.js'), [
            "'use strict';",
            '',
            'module.exports = {',
            '    init: function () {',
            '        return Promise.resolve(true);',
            '    },',
            '    postInit: function () {',
            '        return Promise.resolve(true);',
            '    }',
            '};',
            ''
        ].join('\n'));
        fs.writeFileSync(path.join(modulePath, 'README.md'), [
            '# ' + options.moduleName,
            '',
            'Customer module for ' + options.application.name + '.',
            '',
            'This module was added by `nodics.installer` after the first local setup.',
            ''
        ].join('\n'));
        fs.writeFileSync(path.join(modulePath, 'AGENTS.md'), [
            '# ' + options.moduleName + ' Agent Guide',
            '',
            'This is a customer-owned Nodics module inside `' + options.application.projectName + '`.',
            'Read the project root `AGENTS.md` before changing this module.',
            ''
        ].join('\n'));
        ['properties.js', 'prescripts.js', 'postscripts.js'].forEach(fileName => {
            fs.writeFileSync(path.join(modulePath, 'config', fileName), "'use strict';\n\nmodule.exports = {};\n");
        });
        const changed = [
            path.join(modulePath, 'package.json'),
            path.join(modulePath, 'nodics.js'),
            path.join(modulePath, 'README.md'),
            path.join(modulePath, 'AGENTS.md'),
            path.join(modulePath, 'config', 'properties.js'),
            path.join(modulePath, 'config', 'prescripts.js'),
            path.join(modulePath, 'config', 'postscripts.js')
        ];
        changed.push(...this.updateProjectExpansionMetadata(options, 'modules', {
            name: options.moduleName,
            kind: 'customer-module',
            preset: options.modulePreset
        }));
        const relativeChanged = Array.from(new Set(changed)).map(filePath => path.relative(options.workspace, filePath));
        const evidencePath = this.writeExpansionEvidence(options, {
            action: 'add-module',
            moduleName: options.moduleName,
            changed: relativeChanged
        });
        return {
            operation: 'local-expansion-add-module',
            ok: true,
            moduleName: options.moduleName,
            modulePreset: options.modulePreset,
            modulePath,
            changed: relativeChanged,
            evidencePath
        };
    },

    siteTemplateForType: function (siteType) {
        return siteType === 'company' ? FRONTEND_REPOSITORIES.companySiteTemplate :
            FRONTEND_REPOSITORIES.applicationWebTemplate;
    },

    prepareExpansionSiteRepository: function (options) {
        const template = this.siteTemplateForType(options.siteType);
        const targetPath = path.join(options.workspace, options.siteName);
        if (fs.existsSync(targetPath)) {
            throw new Error('Site already exists: ' + targetPath);
        }
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        if (options.cloneMode === 'existing') {
            const sourcePath = path.join(options.workspace, template.name);
            if (this.isGitCheckout(sourcePath)) {
                this.assertCleanCheckout(sourcePath);
            }
            return this.copyDirectory(sourcePath, targetPath);
        }
        this.runCommand('git', ['clone', '--branch', options.release, this.resolveRepositoryUrl(template, options), targetPath],
            { cwd: options.workspace, allowFailure: false });
        return [targetPath];
    },

    nextFrontendPort: function (projectJson) {
        const frontends = projectJson &&
            projectJson.topology &&
            projectJson.topology.groups &&
            Array.isArray(projectJson.topology.groups.frontends) ?
            projectJson.topology.groups.frontends : [];
        const ports = frontends
            .map(frontend => Number(frontend.port))
            .filter(port => Number.isInteger(port) && port > 0);
        return ports.length ? Math.max(...ports) + 100 : 3100;
    },

    addFrontendToProjectDescriptor: function (options, port) {
        const siteCode = this.toLowerCamelIdentifier(options.siteName) + 'Site';
        const label = this.toDisplayTitle(options.siteName, options.siteName);
        return this.updateProjectDescriptor(options, projectJson => {
            projectJson.topology = projectJson.topology || {};
            projectJson.topology.groups = projectJson.topology.groups || {};
            projectJson.topology.groups.frontends = projectJson.topology.groups.frontends || [];
            const frontends = projectJson.topology.groups.frontends;
            if (frontends.some(frontend => frontend.cwd === '{workspaceRoot}/' + options.siteName ||
                frontend.code === siteCode)) {
                return false;
            }
            frontends.push({
                code: siteCode,
                label,
                type: options.siteType + '-site',
                command: 'npm',
                args: options.siteType === 'commerce' ?
                    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)] :
                    ['run', 'dev'],
                cwd: '{workspaceRoot}/' + options.siteName,
                port,
                readyPath: '/'
            });
            return true;
        });
    },

    appendProjectEnvRoot: function (options, sitePath) {
        const envPath = path.join(options.application.projectPath, '.env');
        const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
        const key = 'NODICS_ADDITIONAL_SITE_ROOTS';
        const relativeSite = '../' + path.basename(sitePath);
        const match = existing.match(new RegExp('^' + key + '=(.*)$', 'm'));
        const values = match && match[1] ? match[1].split(',').map(value => value.trim()).filter(Boolean) : [];
        if (!values.includes(relativeSite)) {
            values.push(relativeSite);
        }
        return this.upsertEnvFile(envPath, { [key]: values.join(',') }, path.join(options.application.projectPath, '.env.example'));
    },

    addSite: function (plan, options) {
        this.requireSetupEvidence(plan, options);
        this.assertProjectReadyForExpansion(options);
        const targetPath = path.join(options.workspace, options.siteName);
        const changed = this.prepareExpansionSiteRepository(options);
        const title = this.toDisplayTitle(options.siteName, options.siteName);
        const frontendPort = this.nextFrontendPort(this.readProjectDescriptor(options));
        changed.push(...this.updatePackageName(targetPath, options.siteName, title));
        changed.push(this.writeInstallerIdentity(targetPath, {
            kind: options.siteType + '-site',
            applicationName: options.application.name,
            siteName: options.siteName,
            siteTitle: title,
            accelerator: options.siteType === 'commerce' ? options.accelerator : undefined
        }));
        const replacements = options.siteType === 'company' ? [
            ['nodics.nexus', options.siteName],
            ['Nodics Nexus', title],
            ['Nexus', title]
        ] : [
            ['nodics.agora', options.siteName],
            ['Nodics Agora', title],
            ['Agora', title]
        ];
        ['README.md', 'index.html', '.env.example'].forEach(fileName => {
            const filePath = path.join(targetPath, fileName);
            if (this.replaceTextInFile(filePath, replacements)) {
                changed.push(filePath);
            }
        });
        if (options.siteType === 'commerce') {
            changed.push(this.upsertEnvFile(path.join(targetPath, '.env'), {
                AGORA_SOLUTION: options.accelerator === 'common' ? 'commerce' : options.accelerator,
                VITE_STOREFRONT_COMMERCE_PROXY_TARGET: 'http://localhost:4350'
            }, path.join(targetPath, '.env.example')));
        } else {
            changed.push(this.upsertEnvFile(path.join(targetPath, '.env'), {
                NEXUS_AXIS_BASE_URL: 'http://localhost:3100',
                NEXUS_PLATFORM_BASE_URL: 'http://localhost:4300',
                NEXUS_ENTERPRISE_CODE: 'default',
                NEXUS_DEFAULT_LOCALE: 'en',
                NEXUS_CHANNEL: 'web',
                NEXUS_DEV_HOST: '0.0.0.0',
                NEXUS_DEV_PORT: String(frontendPort),
                NEXUS_STRICT_PORT: 'true'
            }, path.join(targetPath, '.env.example')));
        }
        changed.push(...this.addFrontendToProjectDescriptor(options, frontendPort));
        const install = this.packageInstallCommand(targetPath, options);
        changed.push(...this.updateProjectExpansionMetadata(options, 'sites', {
            name: options.siteName,
            type: options.siteType,
            accelerator: options.siteType === 'commerce' ? options.accelerator : undefined
        }));
        changed.push(this.appendProjectEnvRoot(options, targetPath));
        const relativeChanged = Array.from(new Set(changed)).map(filePath => path.relative(options.workspace, filePath));
        const evidencePath = this.writeExpansionEvidence(options, {
            action: 'add-site',
            siteName: options.siteName,
            siteType: options.siteType,
            changed: relativeChanged
        });
        return {
            operation: 'local-expansion-add-site',
            ok: true,
            siteName: options.siteName,
            siteType: options.siteType,
            sitePath: targetPath,
            frontendPort,
            install,
            changed: relativeChanged,
            evidencePath
        };
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
        const structureAudit = this.auditGeneratedProjectStructure(options);
        let vendorBoundary;
        try {
            vendorBoundary = this.vendorBoundaryStatus(options);
        } catch (error) {
            vendorBoundary = { ok: false, error: error.message };
        }
        return {
            contractVersion: JSON_RESULT_CONTRACTS.status,
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
            structureAudit,
            aiOnboarding: this.aiOnboardingStatus(options),
            vendorBoundary,
            customizationMap: this.customerCustomizationMap(options),
            dataSeedReadiness: this.dataSeedReadiness(options),
            publishingReadiness: this.publishingReadiness(options),
            mediaAssetReadiness: this.mediaAssetReadiness(options),
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
        if (status.structureAudit) {
            lines.push('', 'Project structure audit: ' + status.structureAudit.status);
        }
        lines.push('', 'Customer customization map:');
        Object.entries(status.customizationMap).forEach(([key, value]) => {
            lines.push('- ' + key + ': ' + (Array.isArray(value) ? value.join(', ') : value || 'disabled'));
        });
        return lines.join('\n');
    },

    renderInventory: function (result) {
        const lines = ['Nodics workspace inventory', 'Workspace: ' + result.workspace];
        result.items.forEach(item => {
            lines.push('- ' + item.name + ': ' + item.kind +
                (item.vendorOwned ? ' vendor-owned' : '') +
                (item.projectCode ? ' project=' + item.projectCode : '') +
                (item.environment ? ' env=' + item.environment : ''));
        });
        return lines.join('\n');
    },

    renderUpgradeCheck: function (result) {
        const lines = ['Nodics upgrade readiness ' + (result.ok ? 'passed' : 'needs review')];
        if (!result.findings.length) {
            lines.push('No upgrade drift found.');
            return lines.join('\n');
        }
        result.findings.forEach(finding => {
            lines.push('- ' + finding.code + ': ' + finding.severity + (finding.fix ? ' - ' + finding.fix : ''));
        });
        return lines.join('\n');
    },

    renderSelfCheck: function (result) {
        const lines = [
            'Nodics Installer self-check ' + (result.ok ? 'passed' : 'failed'),
            result.packageName + ' ' + result.version,
            'npm/npx review: ' + result.npmNpxReview.status
        ];
        result.files.forEach(file => lines.push('- file ' + file.path + ': ' + file.status));
        result.commandChecks.forEach(check => lines.push('- command ' + check.code + ': ' + check.status));
        return lines.join('\n');
    },

    renderSupportBundle: function (result) {
        return [
            'Nodics support bundle created',
            'Bundle: ' + result.bundleRoot,
            'Archive: ' + (result.archivePath || result.archiveStatus),
            'Privacy: ' + result.privacy
        ].join('\n');
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

    auditGeneratedProjectStructure: function (options) {
        const projectPath = options.application.projectPath;
        const required = [
            'package.json',
            'nodics.js',
            'nodics.project.json',
            'AGENTS.md',
            'README.md',
            'llm/contracts/README.md',
            'llm/examples/README.md',
            'modules',
            'envs',
            '.nodics-installer-identity.json',
            '.nodics-installer-lock.json'
        ];
        const missing = required.filter(relativePath => !fs.existsSync(path.join(projectPath, relativePath)));
        const moduleNames = [
            options.application.coreModuleName,
            options.application.apiModuleName,
            options.application.integrationModuleName
        ];
        moduleNames.forEach(moduleName => {
            ['package.json', 'nodics.js', 'AGENTS.md', 'README.md'].forEach(fileName => {
                const relativePath = path.join('modules', moduleName, fileName);
                if (!fs.existsSync(path.join(projectPath, relativePath))) {
                    missing.push(relativePath);
                }
            });
        });
        const environmentPath = path.join('envs', this.initialProvisioning(options).environment);
        if (!fs.existsSync(path.join(projectPath, environmentPath))) {
            missing.push(environmentPath);
        }
        return {
            status: missing.length ? 'warning' : 'passed',
            checkedRoot: projectPath,
            missing,
            fix: missing.length ? 'Run --action=repair --yes or regenerate the missing customer-owned files.' : undefined
        };
    },

    aiOnboardingStatus: function (options) {
        const roots = [
            options.application.projectPath,
            path.join(options.application.projectPath, 'modules'),
            path.join(options.application.projectPath, 'envs'),
            options.companySite ? options.application.companySitePath : null,
            options.commerceSite ? options.application.commerceSitePath : null
        ].filter(Boolean);
        const missing = roots
            .filter(root => fs.existsSync(root))
            .filter(root => !fs.existsSync(path.join(root, 'AGENTS.md')))
            .map(root => path.relative(options.workspace, root));
        return {
            status: missing.length ? 'warning' : 'passed',
            rootsChecked: roots.map(root => path.relative(options.workspace, root)),
            missingAgents: missing,
            protectedVendorRoots: VENDOR_OWNED_REPOSITORIES,
            guidance: 'AI tools should read AGENTS.md and keep edits inside customer-owned roots unless a Nodics source change is explicitly approved.'
        };
    },

    workspaceInventory: function (options) {
        const entries = fs.existsSync(options.workspace) ?
            fs.readdirSync(options.workspace, { withFileTypes: true }).filter(entry => entry.isDirectory()) : [];
        const items = entries.map(entry => {
            const root = path.join(options.workspace, entry.name);
            const identityPath = path.join(root, '.nodics-installer-identity.json');
            const lockPath = path.join(root, '.nodics-installer-lock.json');
            const descriptorPath = path.join(root, 'nodics.project.json');
            const identity = fs.existsSync(identityPath) ? this.readJsonFile(identityPath) : null;
            const lock = fs.existsSync(lockPath) ? this.readJsonFile(lockPath) : null;
            const descriptor = fs.existsSync(descriptorPath) ? this.readJsonFile(descriptorPath) : null;
            return {
                name: entry.name,
                path: root,
                kind: identity && identity.kind || (descriptor ? 'project' : 'repository'),
                generated: Boolean(identity),
                vendorOwned: VENDOR_OWNED_REPOSITORIES.includes(entry.name),
                applicationName: identity && identity.applicationName,
                siteName: identity && identity.siteName,
                projectCode: descriptor && descriptor.projectCode,
                environment: descriptor && descriptor.topology && descriptor.topology.environment,
                installerVersion: lock && lock.installer && lock.installer.version
            };
        });
        return {
            contractVersion: JSON_RESULT_CONTRACTS.inventory,
            operation: 'local-workspace-inventory',
            ok: true,
            workspace: options.workspace,
            items
        };
    },

    upgradeCheck: function (plan, options) {
        const lockPath = path.join(options.application.projectPath, '.nodics-installer-lock.json');
        const lock = fs.existsSync(lockPath) ? this.readJsonFile(lockPath) : null;
        const expectedCapabilities = this.localBootstrapAcceptanceCapabilities(options);
        const descriptor = this.readProjectDescriptor(options);
        const findings = [];
        if (!lock) {
            findings.push({
                code: 'missing-installer-lock',
                severity: 'warning',
                fix: 'Run --action=repair --yes to write generated metadata before an upgrade.'
            });
        } else {
            if (lock.installer && lock.installer.version !== VERSION) {
                findings.push({
                    code: 'installer-version-drift',
                    severity: 'info',
                    current: VERSION,
                    installed: lock.installer.version,
                    fix: 'Review generated files before applying a newer installer.'
                });
            }
            if (lock.application && lock.application.accelerator !== options.accelerator) {
                findings.push({
                    code: 'accelerator-drift',
                    severity: 'warning',
                    expected: options.accelerator,
                    actual: lock.application.accelerator,
                    fix: 'Use the original accelerator or intentionally add a new site/module through expansion commands.'
                });
            }
        }
        if (descriptor && JSON.stringify(descriptor.acceptance && descriptor.acceptance.localBootstrap) !== JSON.stringify(expectedCapabilities)) {
            findings.push({
                code: 'local-bootstrap-capability-drift',
                severity: 'warning',
                fix: 'Run --action=repair --yes to align acceptance.localBootstrap with current installer rules.'
            });
        }
        return {
            contractVersion: JSON_RESULT_CONTRACTS.upgradeCheck,
            operation: 'local-upgrade-check',
            ok: !findings.some(finding => finding.severity === 'error'),
            lockPath,
            findings
        };
    },

    selfCheck: function (plan, options) {
        const packageJson = this.readJsonFile(path.resolve(__dirname, '..', 'package.json'));
        const requiredFiles = ['package.json', 'bin/nodics-installer.js', 'src/installer.js', 'README.md', 'AGENTS.md'];
        const files = requiredFiles.map(relativePath => ({
            path: relativePath,
            status: fs.existsSync(path.resolve(__dirname, '..', relativePath)) ? 'passed' : 'failed'
        }));
        const commandChecks = ['node', 'npm', 'git'].map(command => this.commandPathCheck(command));
        return {
            contractVersion: JSON_RESULT_CONTRACTS.selfCheck,
            operation: 'local-installer-self-check',
            ok: files.every(file => file.status === 'passed') &&
                commandChecks.every(check => check.status === 'passed' || check.status === 'warning'),
            packageName: packageJson.name,
            version: VERSION,
            npmNpxReview: {
                currentBootstrapCommand: 'npx github:Nodics/nodics.installer',
                npmPackageCommand: 'npx @nodics/installer',
                status: 'review-only',
                rule: 'Do not change package identity, bin, publishConfig, tags, or publish flow without explicit plan approval.'
            },
            files,
            commandChecks,
            jsonContracts: JSON_RESULT_CONTRACTS
        };
    },

    supportBundle: function (plan, options) {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const bundleRoot = options.supportBundlePath ?
            path.resolve(options.supportBundlePath) :
            path.join(options.workspace, '.nodics-installer', 'support-bundle-' + stamp);
        const evidence = this.readEvidence(plan.evidencePath);
        const status = this.setupStatus(plan, options);
        const logs = this.logsStatus(options);
        fs.mkdirSync(bundleRoot, { recursive: true });
        this.writeJsonFile(path.join(bundleRoot, 'support.json'), {
            contractVersion: JSON_RESULT_CONTRACTS.supportBundle,
            operation: 'local-support-bundle',
            createdAt: new Date().toISOString(),
            privacy: 'Sanitized local evidence only; no telemetry was sent.',
            evidence: this.sanitizeForSupportBundle(evidence),
            status: this.sanitizeForSupportBundle(status),
            logs: this.sanitizeForSupportBundle(logs)
        });
        const archivePath = bundleRoot + '.tar.gz';
        const tar = this.runCommand('tar', ['-czf', archivePath, '-C', path.dirname(bundleRoot), path.basename(bundleRoot)], {
            cwd: options.workspace,
            allowFailure: true
        });
        return {
            contractVersion: JSON_RESULT_CONTRACTS.supportBundle,
            operation: 'local-support-bundle',
            ok: true,
            bundleRoot,
            archivePath: tar.status === 'passed' ? archivePath : undefined,
            archiveStatus: tar.status,
            privacy: 'Secrets are redacted by the installer sanitizer before evidence and logs are included.'
        };
    },

    cleanupWorkspace: function (plan, options) {
        const topology = fs.existsSync(options.application.projectPath) ? this.readTopologyStatus(options) : null;
        if (topology && this.topologyIsReady(topology.status)) {
            throw new Error('Refusing to cleanup workspace while topology is running. Run --action=stop --yes first.');
        }
        const protectedRoots = new Set(VENDOR_OWNED_REPOSITORIES);
        const candidates = plan.repositories
            .filter(repository => !protectedRoots.has(repository.name))
            .map(repository => repository.targetPath)
            .filter(root => fs.existsSync(root))
            .filter(root => fs.existsSync(path.join(root, '.nodics-installer-identity.json')) ||
                fs.existsSync(path.join(root, '.nodics-installer-lock.json')));
        const removed = [];
        candidates.forEach(root => {
            fs.rmSync(root, { recursive: true, force: true });
            removed.push(root);
        });
        const evidenceRoot = path.join(options.workspace, '.nodics-installer');
        if (fs.existsSync(evidenceRoot)) {
            fs.rmSync(evidenceRoot, { recursive: true, force: true });
            removed.push(evidenceRoot);
        }
        return {
            operation: 'local-workspace-cleanup',
            ok: true,
            removed,
            protectedRoots: Array.from(protectedRoots)
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
                excerpt: this.readLastLines(filePath, options.lines),
                signals: this.logSignals(this.readLastLines(filePath, options.lines))
            }));
        return {
            contractVersion: JSON_RESULT_CONTRACTS.logs,
            operation: 'local-setup-logs',
            ok: logs.length > 0,
            runtime: runtime || undefined,
            lines: options.lines,
            logDirectory: this.resolveTopologyStateDirectory(options),
            logs
        };
    },

    logSignals: function (excerpt) {
        const signals = [];
        const text = String(excerpt || '');
        if (/EADDRINUSE|address already in use|port .*already/i.test(text)) {
            signals.push({ code: 'port-conflict', fix: 'Stop the process holding the port or select an alternate port pack.' });
        }
        if (/ECONNREFUSED|connection refused/i.test(text)) {
            signals.push({ code: 'dependency-not-listening', fix: 'Start the dependent service and rerun status or acceptance.' });
        }
        if (/Import completed with record-level errors|Media reference was not found/i.test(text)) {
            signals.push({ code: 'data-import-error', fix: 'Inspect import error artifacts and rerun initialization after correcting data order.' });
        }
        if (/Error|Exception|UnhandledPromiseRejection|failed/i.test(text)) {
            signals.push({ code: 'runtime-error', fix: 'Read the last error block above and run support-bundle if help is needed.' });
        }
        return signals;
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
            if (log.signals.length) {
                lines.push('Signals:');
                log.signals.forEach(signal => lines.push('- ' + signal.code + ': ' + signal.fix));
            }
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
        const evidence = this.prepareEvidenceForResume(this.refreshEvidenceContext(
            this.readEvidence(plan.evidencePath) || this.createEvidence(plan, options),
            plan,
            options
        ), options);
        const runStage = (code, label, callback, stageVersion) => {
            if (this.stepCompleted(evidence, code, stageVersion)) {
                return;
            }
            const result = callback();
            this.recordStep(evidence, plan.evidencePath, { code, label, stageVersion, status: 'passed', result });
        };
        runStage('download', 'Download or reuse repositories', () => this.prepareRepositories(plan, options));
        runStage('rebrand', 'Apply application identity', () => this.rebrandGeneratedApplications(plan, options), REBRAND_STAGE_VERSION);
        runStage('vendor-boundary', 'Verify vendor repository boundary', () => this.assertVendorRepositoriesUnmodified(options), VENDOR_BOUNDARY_STAGE_VERSION);
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
                result: startResult,
                replaceExisting: true
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
        if (options.executionLevel === 'acceptance' || options.acceptance) {
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
        if (options.action === 'inventory') {
            const result = this.workspaceInventory(options);
            this.printResult(options, result, inventory => this.renderInventory(inventory));
            return true;
        }
        if (options.action === 'upgrade-check') {
            const result = this.upgradeCheck(plan, options);
            this.printResult(options, result, upgrade => this.renderUpgradeCheck(upgrade));
            return true;
        }
        if (options.action === 'self-check') {
            const result = this.selfCheck(plan, options);
            this.printResult(options, result, check => this.renderSelfCheck(check));
            return true;
        }
        if (options.action === 'support-bundle') {
            const result = this.supportBundle(plan, options);
            this.printResult(options, result, bundle => this.renderSupportBundle(bundle));
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
        if (options.action === 'cleanup-workspace') {
            const result = this.cleanupWorkspace(plan, options);
            this.printResult(options, result, cleanup => 'Nodics generated workspace cleanup completed\nProtected: ' +
                cleanup.protectedRoots.join(', ') + '\nRemoved: ' + (cleanup.removed.length ? cleanup.removed.join('\n') : 'nothing'));
            return true;
        }
        if (options.action === 'uninstall') {
            const stop = fs.existsSync(options.application.projectPath) ? this.stopTopology(options, true) : { status: 'skipped' };
            const cleanup = this.cleanupWorkspace(plan, options);
            const result = { operation: 'local-workspace-uninstall', ok: true, stop, cleanup };
            this.printResult(options, result, uninstall => 'Nodics local uninstall completed\nStop: ' +
                uninstall.stop.status + '\nRemoved: ' + (uninstall.cleanup.removed.length ? uninstall.cleanup.removed.join('\n') : 'nothing'));
            return true;
        }
        if (options.action === 'add-environment') {
            const result = this.addEnvironment(plan, options);
            this.printResult(options, result, expansion => 'Nodics environment added\nEnvironment: ' +
                expansion.environmentName + '\nEvidence: ' + expansion.evidencePath);
            return true;
        }
        if (options.action === 'add-module') {
            const result = this.addModule(plan, options);
            this.printResult(options, result, expansion => 'Nodics module added\nModule: ' +
                expansion.moduleName + '\nEvidence: ' + expansion.evidencePath);
            return true;
        }
        if (options.action === 'add-site') {
            const result = this.addSite(plan, options);
            this.printResult(options, result, expansion => 'Nodics site added\nSite: ' +
                expansion.siteName + '\nEvidence: ' + expansion.evidencePath);
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
