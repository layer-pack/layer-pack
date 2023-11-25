/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
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


Module._nodeModulePaths = function ( from ) {
	let paths, pPaths, rootMod;
	
	if (
		from === baseDir
		||
		allRoots.find(path => (from.substr(0, path.length) === path))
	) {
		paths = [].concat(modPath).concat(__oldNMP(from));
		return paths;
	}
	else {
		paths = __oldNMP(from);
		if ( modPath.length ) {
			paths  = paths.filter(
				dir => modPath.find(path => (dir.startsWith(path)))
			);
			pPaths = __oldNMP(path.resolve(path.join(modPath[0], '..')));
			pPaths.shift();
			paths.push(...allWpRoots, ...pPaths);
		}
		return paths;
	}
};

module.exports = {
	loadPaths  : function ( { allModulePath, cDir }, dist ) {
		modPath = allModulePath.map(p => path.join(cDir, p));
		baseDir = path.join(cDir, dist);
		
		require.main.paths.length = 0;
		require.main.paths.push(...modPath, ...__initialPaths);
	},
	loadWpPaths: function ( allModulePath, allWpPaths ) {
		modPath    = allModulePath;
		allWpRoots = allWpPaths;
		baseDir    = false;
	}
};
