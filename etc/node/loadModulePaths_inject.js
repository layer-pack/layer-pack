/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file etc/node/loadModulePaths_inject.js
 *
 * Runtime bootstrap injected into Node build bundles when `vars.externals` is enabled.
 *
 * The problem: when a Node bundle is built with external requires (e.g. `require('express')`
 * kept as-is), the bundled code must be able to find those packages at runtime. But the
 * bundle's output directory may be far from any `node_modules`, and dependencies may be
 * spread across multiple inherited layer `node_modules` directories.
 *
 * The solution: this file exports an IIFE factory. The `layerPackPlugin` injects a call
 * to that factory as the very first code in the bundle entry point. The factory:
 *  1. Patches `Module.prototype.require` to intercept non-relative `require()` calls
 *     from within the bundle or its transitive children.
 *  2. Builds a priority-ordered search path across all layer `node_modules` directories,
 *     preferring the layer whose `dependencies` explicitly lists the requested package.
 *  3. Pre-resolves the path using `__non_webpack_require__.resolve` and delegates to the
 *     original require with the resolved absolute path.
 *
 * Uses `__non_webpack_require__` (webpack's alias for the real Node `require`) to avoid
 * webpack trying to bundle this resolution logic at build time.
 */
const Module = require('module').Module,
      path   = require('path');
(function () {
	let modPath        = [],
	    allRoots       = [],
	    allRootDeps    = [],
	    baseDir        = false,
	    rootModule     = __non_webpack_require__.main,
	    __initialPaths = [].concat(rootModule.paths),
	    __oldNMP       = Module._nodeModulePaths,
	    __oldReq       = Module.prototype.require;
	
	/**
	 * Patched `Module.prototype.require`. Intercepts named package imports from the
	 * bundle and its transitive require children, redirecting them through the
	 * layer-aware module search path.
	 *
	 * Passes through unchanged:
	 *   - Relative/absolute paths (start with `.`, `/`, or a Windows drive letter)
	 *   - Any require NOT issued from within the bundle or its children
	 */
	Module.prototype.require = function ( id ) {
		let paths,
		    rootMod,
		    from     = this.filename,
		    fromPath = this.path,
		    resolved;
		id           = id && (id + "");

		// Relative and absolute requires bypass this logic entirely.
		if ( /^(\.|\/|[\w\W]+\:\\)/.test(id) )
			return __oldReq.call(this, id);

		let packageName        = id.match(/^(\@[^\\\/]+[\\\/][^\\\/]+|[^\\\/]+)/i)[0],
		    isBuildChild, node = this;
		if ( !packageName )
			return __oldReq.call(this, id);

		if ( from === __filename ) {
			// Require issued directly from the bundle entry point.
			// Build a search path that checks custom lib dirs first, then layers that
			// explicitly list the package in their `dependencies`, then the rest.
			paths = [
				...modPath.filter(p => !allRoots.includes(p)),
				...allRoots.filter(
					( p, i ) => allRootDeps[i].includes(packageName)
				),
				...allRoots.filter(
					( p, i ) => !allRootDeps[i].includes(packageName)
				),
				...__oldNMP(path.resolve(path.join(allRoots[0], '..', '..')))
			];
		}
		else {
			// Walk up the parent chain to see if this require originates from within
			// the bundle (a transitive child of the bundle entry).
			while ( node = node.parent ) {
				if ( node.filename === __filename ) {
					isBuildChild = true;
					break;
				}
			}
			if ( isBuildChild ) {
				// Require from a bundled module's sub-dependency. Start with that module's
				// own hierarchical paths (capped to layer roots), then append the layer chain.
				paths   = __oldNMP(fromPath).filter(
					dir => modPath.find(path => (dir.startsWith(path)))
				);
				rootMod = paths.pop(); // keep the owning layer's root as last resort
				paths.push(
					...allRoots.filter(
						( p, i ) => allRootDeps[i].includes(packageName)
					),
					...allRoots.filter(
						( p, i ) => !allRootDeps[i].includes(packageName)
					)
				);
			}
			else {
				// Require from completely outside the bundle — let Node handle it normally.
				return __oldReq.call(this, id);
			}
		}
		resolved = __non_webpack_require__.resolve(id, { paths: paths });
		return __oldReq.call(this, resolved);
	};
	
	
	/**
	 * Initialise the runtime module path resolver. Called once at bundle startup with
	 * the layer configuration serialised into the bundle by `layerPackPlugin`.
	 *
	 * @param {object}     opts                - Serialised layer config
	 * @param {string[]}   opts.allModulePath  - Relative paths to layer node_modules dirs
	 * @param {string[]}   opts.allModuleRoots - Relative paths to layer node_modules roots
	 * @param {string[][]} opts.allDeps        - `dependencies` keys for each layer
	 * @param {string}     opts.cDir           - Absolute path of the bundle's __dirname
	 * @param {string}     dist                - Relative path from cDir to output directory
	 */
	return function loadPaths( { allModulePath, allModuleRoots, allDeps, cDir }, dist ) {
		modPath     = allModulePath.map(p => path.join(cDir, p));
		allRoots    = allModuleRoots.map(p => path.join(cDir, p));
		allRootDeps = allDeps;
		baseDir     = path.join(cDir, dist);
	}
})
