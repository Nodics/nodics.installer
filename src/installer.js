/*
    Nodics - Enterprise Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is governed by the Nodics Source-Available Commercial License.
    You may use, copy, modify, deploy, or distribute it only as permitted by the
    root LICENSE file or a separate written agreement with Nodics.

 */

'use strict';

const os = require('node:os');
const path = require('node:path');

const VALID_JOURNEYS = new Set(['reference', 'project']);
const VALID_MODES = new Set(['node', 'docker']);
const VALID_APPS = new Set(['axis', 'nexus', 'agora']);
const VALID_ACCELERATORS = new Set(['common', 'apparel', 'electronics', 'telco', 'combined']);

const DEFAULT_REPOSITORIES = Object.freeze({
    framework: { code: 'framework', name: 'nodics.ai', repository: 'https://github.com/Nodics/nodics.ai.git' },
    kickoff: { code: 'kickoff', name: 'nodics.kickoff', repository: 'https://github.com/Nodics/nodics.kickoff.git' },
    experience: { code: 'experience', name: 'nodics.exp', repository: 'https://github.com/Nodics/nodics.exp.git' }
});

const FRONTEND_REPOSITORIES = Object.freeze({
    axis: { code: 'axis', name: 'nodics.axis', repository: 'https://github.com/Nodics/nodics.axis.git', type: 'backoffice' },
    nexus: { code: 'nexus', name: 'nodics.nexus', repository: 'https://github.com/Nodics/nodics.nexus.git', type: 'corporate' },
    agora: { code: 'agora', name: 'nodics.agora', repository: 'https://github.com/Nodics/nodics.agora.git', type: 'storefront' }
});

module.exports = {
    /** Reads a command-line option in `--name=value` form. */
    readOption: function (args, name, defaultValue) {
        const prefix = name + '=';
        const match = (args || []).find(argument => argument.startsWith(prefix));
        return match ? match.slice(prefix.length) : defaultValue;
    },

    /** Returns whether an option flag is present. */
    hasFlag: function (args, name) {
        return (args || []).includes(name);
    },

    /** Parses a comma-separated option into lower-case values. */
    readCsvOption: function (args, name, defaultValue) {
        const value = this.readOption(args, name, '');
        return (value ? value.split(',') : defaultValue)
            .map(item => String(item).trim().toLowerCase())
            .filter(Boolean);
    },

    /** Prints command usage. */
    usage: function () {
        return [
            'Nodics Installer',
            '',
            'Usage:',
            '  npx github:Nodics/nodics.installer [options]',
            '  npm start -- [options]',
            '',
            'Options:',
            '  --journey=reference|project      Beginner journey. Default: reference',
            '  --workspace=/absolute/path       Target workspace. Default: ~/Nodics/nodicsRoot',
            '  --mode=node|docker               Local runtime mode. Default: node',
            '  --apps=axis,nexus,agora          Selected frontend apps. Default: axis,nexus,agora',
            '  --accelerator=common|apparel|electronics|telco|combined',
            '                                  Starter business experience. Default: common',
            '  --action=plan                    Current supported action. Default: plan',
            '  --json                           Print structured JSON.',
            '  --help                           Show this help.',
            '',
            'Current status:',
            '  This MVP creates a dry-run setup plan only. It does not clone, install, start,',
            '  reset, or write setup evidence yet.'
        ].join('\n');
    },

    /** Parses beginner setup options. */
    parseOptions: function (args) {
        const workspace = this.readOption(args, '--workspace', path.join(os.homedir(), 'Nodics', 'nodicsRoot'));
        const options = {
            journey: this.readOption(args, '--journey', 'reference').toLowerCase(),
            workspace: path.resolve(workspace),
            mode: this.readOption(args, '--mode', 'node').toLowerCase(),
            apps: this.readCsvOption(args, '--apps', ['axis', 'nexus', 'agora']),
            accelerator: this.readOption(args, '--accelerator', 'common').toLowerCase(),
            action: this.readOption(args, '--action', 'plan').toLowerCase(),
            json: this.hasFlag(args, '--json')
        };
        return options;
    },

    /** Validates beginner setup options. */
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
        if (options.action !== 'plan') {
            errors.push('Current nodics.installer MVP supports --action=plan only.');
        }
        if (options.journey === 'project') {
            errors.push('The custom project journey is documented but deferred until the reference local setup journey is stable.');
        }
        return { valid: errors.length === 0, errors };
    },

    /** Returns selected repositories for the setup plan. */
    selectedRepositories: function (options) {
        const repositories = [DEFAULT_REPOSITORIES.framework, DEFAULT_REPOSITORIES.kickoff];
        if (options.apps.length > 0) {
            repositories.push(DEFAULT_REPOSITORIES.experience);
            options.apps.forEach(app => repositories.push(FRONTEND_REPOSITORIES[app]));
        }
        return repositories.map(repository => ({
            ...repository,
            targetPath: repository.type ?
                path.join(options.workspace, 'nodics.exp', repository.name) :
                path.join(options.workspace, repository.name)
        }));
    },

    /** Builds the direct Node local command sequence. */
    nodeCommands: function (options) {
        const kickoff = path.join(options.workspace, 'nodics.kickoff');
        const exp = path.join(options.workspace, 'nodics.exp');
        const apps = options.apps.join(',');
        const commands = [
            { cwd: kickoff, command: 'cp .env.example .env', when: '.env is absent' },
            { cwd: kickoff, command: 'set NODICS_FRAMEWORK_ROOT=../nodics.ai in .env', manual: true },
            { cwd: kickoff, command: 'npm run configure:framework' },
            { cwd: path.join(options.workspace, 'nodics.ai'), command: 'npm ci' },
            { cwd: kickoff, command: 'npm ci' },
            { cwd: exp, command: 'npm run apps:fetch -- --apps=' + apps, when: options.apps.length > 0 },
            ...options.apps.map(app => ({
                cwd: path.join(exp, FRONTEND_REPOSITORIES[app].name),
                command: 'npm ci',
                when: 'frontend app `' + app + '` is selected'
            })),
            { cwd: exp, command: 'npm run apps:verify -- --apps=' + apps, when: options.apps.length > 0 },
            { cwd: kickoff, command: 'npm run topology:preflight' },
            { cwd: kickoff, command: 'npm run topology:start:all', when: options.apps.length > 0 },
            { cwd: kickoff, command: 'npm run topology:start', when: options.apps.length === 0 },
            { cwd: kickoff, command: 'npm run acceptance:guided-initialization', when: options.accelerator !== 'common' }
        ];
        return commands.filter(command => command.when !== false);
    },

    /** Builds the Docker Local command sequence. */
    dockerCommands: function (options) {
        const kickoff = path.join(options.workspace, 'nodics.kickoff');
        const commands = [
            { cwd: kickoff, command: 'cp .env.example .env', when: '.env is absent' },
            { cwd: kickoff, command: 'set NODICS_FRAMEWORK_ROOT=../nodics.ai in .env', manual: true },
            { cwd: kickoff, command: 'npm run configure:framework' },
            { cwd: kickoff, command: 'npm ci' },
            { cwd: kickoff, command: 'npm run docker-local:preflight' },
            { cwd: kickoff, command: 'npm run docker-local:build' },
            { cwd: kickoff, command: 'npm run docker-local:start' },
            { cwd: kickoff, command: 'npm run docker-local:acceptance', when: options.accelerator !== 'common' }
        ];
        return commands.filter(command => command.when !== false);
    },

    /** Creates a dry-run local setup plan. */
    createSetupPlan: function (options) {
        const validation = this.validateOptions(options);
        if (!validation.valid) {
            const error = new Error('Nodics Installer options need correction:\n- ' + validation.errors.join('\n- '));
            error.validation = validation;
            throw error;
        }
        const repositories = this.selectedRepositories(options);
        return {
            contractVersion: 0,
            operation: 'local-setup-plan',
            dryRun: true,
            writePerformed: false,
            executionSupported: false,
            installer: {
                packageName: 'nodics.installer',
                version: '0.1.0',
                bootstrapCommand: 'npx github:Nodics/nodics.installer'
            },
            beginnerChoices: {
                journey: 'Run Nodics locally with the reference Kickoff project',
                workspace: options.workspace,
                localMode: options.mode === 'docker' ? 'Docker Local production-simulation' : 'Direct Node.js local processes',
                apps: options.apps,
                accelerator: options.accelerator
            },
            prerequisites: [
                { code: 'node', check: 'Node.js must satisfy repository engine constraints.' },
                { code: 'npm', check: 'npm must satisfy repository engine constraints.' },
                { code: 'git', check: 'Git must be available for repository clone or status checks.' },
                { code: 'docker', check: 'Docker Engine must be available only when Docker Local is selected.',
                    required: options.mode === 'docker' }
            ],
            repositories,
            setupSteps: [
                'Inspect machine prerequisites.',
                'Resolve and protect the selected workspace.',
                'Download or reuse required Nodics repositories.',
                'Configure Kickoff framework links.',
                'Install dependencies in framework, project, and selected frontend apps.',
                'Run local preflight before starting services.',
                'Start the selected backend and frontend topology.',
                'Run guided initialization when sample or accelerator data is selected.',
                'Write setup evidence without secret values.'
            ],
            commands: options.mode === 'docker' ? this.dockerCommands(options) : this.nodeCommands(options),
            safetyRules: [
                'No clone, install, start, reset, or write is performed by this plan.',
                'Execution must require explicit approval in a later work package.',
                'Dirty existing repositories must never be overwritten automatically.',
                'Secrets must not be printed in setup summaries or ordinary logs.',
                'Production certification must not be claimed from local setup evidence.'
            ],
            expectedUrls: options.mode === 'docker' ? {
                axis: options.apps.includes('axis') ? 'http://localhost:4100' : undefined,
                nexus: options.apps.includes('nexus') ? 'http://localhost:4200' : undefined,
                platform: 'http://localhost:5300',
                wcmsStaged: 'http://localhost:5312',
                wcmsOnline: 'http://localhost:5314',
                process: 'http://localhost:5330',
                engagement: 'http://localhost:5340',
                commerce: 'http://localhost:5350'
            } : {
                axis: options.apps.includes('axis') ? 'http://localhost:3100' : undefined,
                nexus: options.apps.includes('nexus') ? 'http://localhost:3200' : undefined,
                agora: options.apps.includes('agora') ? 'http://localhost:3300' : undefined,
                platform: 'http://localhost:4300',
                wcmsStaged: 'http://localhost:4312',
                wcmsOnline: 'http://localhost:4314',
                process: 'http://localhost:4330',
                engagement: 'http://localhost:4340',
                commerce: 'http://localhost:4350'
            }
        };
    },

    /** Renders a beginner-readable setup plan. */
    renderTextPlan: function (plan) {
        const lines = [
            'Nodics Installer setup plan',
            '',
            'Bootstrap command: ' + plan.installer.bootstrapCommand,
            'Workspace: ' + plan.beginnerChoices.workspace,
            'Mode: ' + plan.beginnerChoices.localMode,
            'Apps: ' + plan.beginnerChoices.apps.join(', '),
            'Starter experience: ' + plan.beginnerChoices.accelerator,
            '',
            'This is a dry run. No files were changed.',
            '',
            'Repositories:'
        ];
        plan.repositories.forEach(repository => {
            lines.push('- ' + repository.name + ' -> ' + repository.targetPath);
        });
        lines.push('', 'Steps:');
        plan.setupSteps.forEach((step, index) => lines.push(String(index + 1) + '. ' + step));
        lines.push('', 'Planned commands:');
        plan.commands.forEach(command => {
            const suffix = command.when ? ' (' + command.when + ')' : '';
            lines.push('- [' + command.cwd + '] ' + command.command + suffix);
        });
        lines.push('', 'Expected URLs:');
        Object.entries(plan.expectedUrls).filter(([, value]) => value).forEach(([key, value]) => {
            lines.push('- ' + key + ': ' + value);
        });
        return lines.join('\n');
    },

    /** Runs the installer CLI. */
    run: function (args) {
        if (this.hasFlag(args, '--help')) {
            console.log(this.usage());
            return true;
        }
        const options = this.parseOptions(args);
        const plan = this.createSetupPlan(options);
        console.log(options.json ? JSON.stringify(plan, null, 2) : this.renderTextPlan(plan));
        return true;
    }
};
