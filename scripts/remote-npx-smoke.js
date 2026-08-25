#!/usr/bin/env node
'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const workspace = path.resolve(process.env.NODICS_REMOTE_SMOKE_WORKSPACE ||
    process.argv.find(argument => argument.startsWith('--workspace='))?.slice('--workspace='.length) ||
    fs.mkdtempSync(path.join(os.tmpdir(), 'nodics-remote-smoke-')));
const packageSpec = process.env.NODICS_REMOTE_SMOKE_PACKAGE || 'github:Nodics/nodics.installer';
const common = [
    '--workspace=' + workspace,
    '--application-name=Remote Smoke',
    '--project-name=remote-smoke.startio',
    '--company-site-name=remote-smoke.web',
    '--commerce-site-name=remote-smoke.apparel',
    '--accelerator=apparel',
    '--apps=axis',
    '--json'
];
const actions = [
    ['version', ['--json']],
    ['self-check', common],
    ['plan', common],
    ['preflight', common]
];

function parseJsonFromOutput(output) {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        return null;
    }
    try {
        return JSON.parse(output.slice(start, end + 1));
    } catch {
        return null;
    }
}

const results = actions.map(([action, args]) => {
    const result = childProcess.spawnSync('npx', ['--yes', packageSpec, '--action=' + action, ...args], {
        cwd: process.cwd(),
        encoding: 'utf8',
        shell: false
    });
    const parsed = parseJsonFromOutput(result.stdout);
    return {
        action,
        status: result.status === 0 ? 'passed' : 'failed',
        exitCode: result.status,
        ok: parsed && parsed.ok,
        operation: parsed && parsed.operation,
        stderr: result.stderr.trim().split(/\r?\n/).slice(-8).join('\n')
    };
});

const report = {
    operation: 'remote-npx-smoke',
    packageSpec,
    workspace,
    ok: results.every(result => result.status === 'passed' && result.ok !== false),
    results
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
    process.exitCode = 1;
}
