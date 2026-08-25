#!/usr/bin/env node
/*
    Nodics - Enterprise Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is governed by the Nodics Source-Available Commercial License.
    You may use, copy, modify, deploy, or distribute it only as permitted by the
    root LICENSE file or a separate written agreement with Nodics.

 */

'use strict';

const installer = require('../src/installer');

Promise.resolve(installer.run(process.argv.slice(2))).catch(error => {
    const args = process.argv.slice(2);
    const message = error && error.message ? error.message : String(error);
    if (args.includes('--json')) {
        console.error(JSON.stringify({
            operation: 'local-installer-error',
            ok: false,
            error: message
        }, null, 2));
    } else {
        console.error('Nodics Installer failed');
        console.error(message);
    }
    process.exitCode = 1;
});
