/*
    Nodics - Enterprise Micro-Services Management Framework

    Copyright (c) 2026 Nodics All rights reserved.

    This software is governed by the Nodics Source-Available Commercial License.
    You may use, copy, modify, deploy, or distribute it only as permitted by the
    root LICENSE file or a separate written agreement with Nodics.

 */

/**
 * @module nodics.installer/NodicsInstallerRoot
 * @description Declares the standalone installer repository as a standard Nodics module-shaped, non-runtime tooling package.
 * @layer installer-root
 * @owner nodics.installer
 * @override Do not add runtime module behavior here. The installer bootstraps local source checkouts and delegates runtime work to nodics.ai, nodics.kickoff, and nodics.exp after they exist locally.
 */
module.exports = {
    /**
     * Keeps the installer root compatible with the standard Nodics lifecycle shape.
     *
     * @param {Object} options Optional caller context.
     * @returns {Promise<boolean>} Resolves true because the installer has no runtime startup behavior.
     */
    init: function (options) {
        return Promise.resolve(true);
    },

    /**
     * Keeps the installer root compatible with the standard Nodics lifecycle shape.
     *
     * @param {Object} options Optional caller context.
     * @returns {Promise<boolean>} Resolves true because the installer has no runtime post-startup behavior.
     */
    postInit: function (options) {
        return Promise.resolve(true);
    },

    /**
     * Provides a no-op clean hook for module-shape compatibility.
     *
     * @param {Object} options Optional caller context.
     * @returns {Promise<boolean>} Resolves true because generated setup evidence is not cleaned by the package root.
     */
    cleanAll: function (options) {
        return Promise.resolve(true);
    },

    /**
     * Provides a no-op build hook for module-shape compatibility.
     *
     * @param {Object} options Optional caller context.
     * @returns {Promise<boolean>} Resolves true because the installer CLI is source-run JavaScript.
     */
    buildAll: function (options) {
        return Promise.resolve(true);
    }
};
