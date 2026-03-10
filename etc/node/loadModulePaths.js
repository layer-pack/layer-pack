/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file etc/node/loadModulePaths.js
 *
 * Patches Node.js's module resolution at build time so that webpack itself can find
 * modules installed across multiple layer `node_modules` directories when loading
 * webpack configs from inherited layer packages.
 *
 * Problem: webpack configs often live in parent layer packages (e.g. `lpack-react`).
 * When webpack requires that config, Node uses normal hierarchical resolution starting
 * from the config file's directory — it will NOT look in the head project's
 * `node_modules` or sibling layer `node_modules`.
 *
 * Solution: monkey-patch `Module._nodeModulePaths` so that:
 *  - Paths that originate from inside a layer root or from `baseDir` get all layer
 *    `node_modules` prepended (highest precedence).
 *  - All other paths (third-party modules) use standard resolution but filtered to
 *    paths inside the known layer module roots, then fall through to parent directories.
 *
 * Two entry points:
 *  - `loadPaths`   — used by `lpack-run` to patch resolution for a running Node script
 *  - `loadWpPaths` — used by `index.js` to patch resolution while loading a webpack config
 */
let Module         = require('module').Module,
    path           = require('path'),
    modPath        = [],
    allRoots       = [],
    allWpRoots     = [],
    baseDir        = false,
    rootModule     = require.main,
    __initialPaths = [].concat(rootModule.paths),
    __oldNMP       = Module._nodeModulePaths;


/**
 * Override Node's built-in module path builder. Called whenever a module is required
 * from directory `from`.
 *
 * If `from` is the build output directory or inside a known layer root, prepend all
 * layer module paths so layer dependencies take priority over system node_modules.
 *
 * Otherwise, use standard resolution but strip paths outside the known layer roots
 * to avoid accidentally picking up incompatible versions from unrelated directories,
 * then append the webpack config root's parent paths as a fallback.
 */
Module._nodeModulePaths = function ( from ) {
	let paths, pPaths, rootMod;

	if (
		from === baseDir
		||
		allRoots.find(path => (from.substr(0, path.length) === path))
	) {
		// Inside a layer root or the build output dir: prepend layer module paths.
		paths = [].concat(modPath).concat(__oldNMP(from));
		return paths;
	}
	else {
		paths = __oldNMP(from);
		if ( modPath.length ) {
			// Restrict to paths that are subdirectories of known layer module roots.
			paths  = paths.filter(
				dir => modPath.find(path => (dir.startsWith(path)))
			);
			// Append parent-directory paths of the first module root as a final fallback.
			pPaths = __oldNMP(path.resolve(path.join(modPath[0], '..')));
			pPaths.shift();
			paths.push(...allWpRoots, ...pPaths);
		}
		return paths;
	}
};

module.exports = {
	/**
	 * Activate layer-aware resolution for a Node script launched via `lpack-run`.
	 * Patches both `Module._nodeModulePaths` (handled above) and `require.main.paths`
	 * so top-level requires in the script resolve correctly.
	 *
	 * @param {object}   opts               - Config from `getConfigByProfiles`
	 * @param {string[]} opts.allModulePath  - Absolute layer module paths (head-first)
	 * @param {string}   opts.cDir           - Absolute path of the project root
	 * @param {string}   dist               - Relative path to the build output directory
	 */
	loadPaths  : function ( { allModulePath, cDir }, dist ) {
		modPath = allModulePath.map(p => path.join(cDir, p));
		baseDir = path.join(cDir, dist);

		require.main.paths.length = 0;
		require.main.paths.push(...modPath, ...__initialPaths);
	},
	/**
	 * Activate layer-aware resolution while webpack loads its config from an inherited
	 * layer package. Does not patch `require.main.paths` — only the `_nodeModulePaths`
	 * override above is active.
	 *
	 * @param {string[]} allModulePath - Absolute layer module paths (head-first)
	 * @param {string[]} allWpPaths    - Absolute paths to the webpack package node_modules
	 */
	loadWpPaths: function ( allModulePath, allWpPaths ) {
		modPath    = allModulePath;
		allWpRoots = allWpPaths;
		baseDir    = false;
	}
};
