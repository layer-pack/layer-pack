/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
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
	
	Module.prototype.require = function ( id ) {
		let paths, rootMod, from = this.filename, resolved;
		if ( /^(\.|\/|[\w\W]+\:\\)/.test(id) )
			return __oldReq.call(this, id);
		
		let packageName = id.match(/^(\@[^\\\/]+[\\\/][^\\\/]+|[^\\\/]+)/i)[0];
		if ( !packageName )
			return __oldReq.call(this, id);
		
		if (// if require is emited from the build
			from === __filename
		) {
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
			let isBuildChild, node = this;// if require is emited from a child require of the build
			while ( node = node.parent ) {
				if ( node.filename === __filename ) {
					isBuildChild = true;
					break;
				}
			}
			if ( isBuildChild ) {
				paths   = __oldNMP(from).filter(
					dir => modPath.find(path => (dir.startsWith(path)))
				);
				rootMod = paths.pop();// keep inherited order if not sub node_modules
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
				return __oldReq.call(this, id);
			}
		}
		resolved = __non_webpack_require__.resolve(id, { paths: paths });
		return __oldReq.call(this, resolved);
	};
	
	
	return function loadPaths( { allModulePath, allModuleRoots, allDeps, cDir }, dist ) {
		modPath                 = allModulePath.map(p => path.join(cDir, p));
		allRoots                = allModuleRoots.map(p => path.join(cDir, p));
		allRootDeps             = allDeps;
		baseDir                 = path.join(cDir, dist);
		rootModule.paths.length = 0;
		rootModule.paths.push(...modPath, ...__initialPaths);
	}
})
