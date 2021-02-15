/*
 *   The MIT License (MIT)
 *   Copyright (c) 2020. Nathanael Braun
 *
 *   Permission is hereby granted, free of charge, to any person obtaining a copy
 *   of this software and associated documentation files (the "Software"), to deal
 *   in the Software without restriction, including without limitation the rights
 *   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *   copies of the Software, and to permit persons to whom the Software is
 *   furnished to do so, subject to the following conditions:
 *
 *   The above copyright notice and this permission notice shall be included in all
 *   copies or substantial portions of the Software.
 *
 *   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 *   SOFTWARE.
 *
 *   @author : Nathanael Braun
 *   @contact : n8tz.js@gmail.com
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
			!this.parent
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