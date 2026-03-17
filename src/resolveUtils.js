/*
 * Copyright 2023 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file resolveUtils.js
 *
 * Shared helpers for module resolution across build-time (layerPackPlugin)
 * and runtime (loadModulePaths_inject). Eliminates duplicated patterns for:
 *   - Layer module path building (.layer_modules/node_modules + node_modules)
 *   - Dependency-based filtering of layers
 *   - Array deduplication
 *   - Context dependency tracking for HMR
 */

const path = require('path');
const fs   = require('fs');

const LAYER_MODULES = '.layer_modules';

/**
 * Return both possible module directories for a layer root:
 * `.layer_modules/node_modules` (used by lpack-setup) and `node_modules`.
 *
 * @param {string} layerRoot - Absolute path to the layer's package root
 * @returns {string[]} - Two paths: [.layer_modules/node_modules, node_modules]
 */
function layerModulePaths( layerRoot ) {
	return [
		path.join(layerRoot, LAYER_MODULES, 'node_modules'),
		path.join(layerRoot, 'node_modules')
	];
}

/**
 * Build a flat list of candidate node_modules directories from layers,
 * filtered by whether the package is (or isn't) in their `dependencies`.
 *
 * @param {string[]}  allModuleRoots - Layer root directories (head-first)
 * @param {object[]}  allPackageCfg  - Parsed package.json per layer
 * @param {string}    packageName    - Bare package name being resolved
 * @param {boolean}   hasDep         - true = keep layers WITH the dep, false = WITHOUT
 * @param {string}    [depField='dependencies'] - Which field to check
 * @returns {string[]} - Candidate node_modules directories
 */
function filterLayerPaths( allModuleRoots, allPackageCfg, packageName, hasDep, depField ) {
	depField = depField || 'dependencies';
	return allModuleRoots.reduce(( list, p, i ) => {
		const deps = allPackageCfg[i][depField];
		const has  = deps && deps[packageName];
		if ( hasDep ? has : !has ) {
			list.push(
				path.join(p, LAYER_MODULES, 'node_modules'),
				path.join(p, 'node_modules')
			);
		}
		return list;
	}, []);
}

/**
 * Deduplicate an array preserving first-occurrence order.
 * O(n) via Set, replacing the O(n²) indexOf pattern.
 *
 * @param {any[]} arr
 * @returns {any[]}
 */
function dedupe( arr ) {
	return [...new Set(arr)];
}

/**
 * Register a glob UID against a directory in the contextDependencies map.
 * Used by HMR watch to know which virtual files to regenerate when a
 * directory's contents change.
 *
 * @param {object} deps    - { [dirPath]: string[] } map
 * @param {string} dir     - Directory to watch
 * @param {string} globUid - Unique identifier for the glob request
 */
function addContextDep( deps, dir, globUid ) {
	if ( !deps[dir]?.includes(globUid) ) {
		if ( deps[dir] ) {
			deps[dir].push(globUid);
		}
		else {
			deps[dir] = [globUid];
		}
	}
}

/**
 * Resolve the effective node_modules path for a layer, preferring
 * `.layer_modules/node_modules` if it exists.
 *
 * @param {string} rootPath - Layer root directory
 * @returns {string} - Normalized absolute path to the modules directory
 */
function resolveModulePath( rootPath ) {
	const layerModules = path.normalize(path.join(rootPath, LAYER_MODULES, 'node_modules'));
	return fs.existsSync(layerModules)
	       ? layerModules
	       : path.normalize(path.join(rootPath, 'node_modules'));
}

module.exports = {
	LAYER_MODULES,
	layerModulePaths,
	filterLayerPaths,
	dedupe,
	addContextDep,
	resolveModulePath
};
