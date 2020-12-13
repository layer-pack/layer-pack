/*
 * The MIT License (MIT)
 * Copyright (c) 2019. Wise Wild Web
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 *  @author : Nathanael Braun
 *  @contact : n8tz.js@gmail.com
 */
const Module = require('module').Module,
      path   = require('path');
(function () {
	let modPath        = [],
	    allRoots       = [],
	    baseDir        = false,
	    rootModule     = __non_webpack_require__.main,
	    __initialPaths = [].concat(rootModule.paths),
	    __oldNMP       = Module._nodeModulePaths;
	
	
	Module._nodeModulePaths = function ( from ) {
		let paths, rootMod;
		if (// if require is emited from the build ( doesn't seems to happen anymore ? )
			from === baseDir
		) {
			paths = [].concat(modPath).concat(__oldNMP(from));
			return paths;
		}
		else {
			paths   = __oldNMP(from).filter(
				dir => modPath.find(path => (dir.startsWith(path)))
			);
			rootMod = paths.pop();// keep inherited order if not sub node_modules
			paths.push(...modPath, ...__oldNMP(path.resolve(path.join(rootMod, '..'))));// add normal parents node_modules from head
			return paths;
		}
	};
	
	return function loadPaths( { allModulePath, cDir }, dist ) {
		modPath = allModulePath.map(p => path.join(cDir, p));
		baseDir = path.join(cDir, dist);
		
		rootModule.paths.length = 0;
		rootModule.paths.push(...modPath, ...__initialPaths);
	}
})