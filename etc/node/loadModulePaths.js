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
	let paths, rootMod;
	//if (
	//	from === baseDir
	//	||
	//	allRoots.find(path => (from.substr(0, path.length) === path))
	//) {
	//	paths = [].concat(modPath).concat(__oldNMP(from));
	//	return paths;
	//}
	//else {
	paths = __oldNMP(from);
	if ( modPath.length ) {
		paths = paths.filter(
			dir => modPath.find(path => (dir.startsWith(path)))
		);
		
		
		//if ( !paths.length )
		//	return [...__oldNMP(from)];
		// node_modules from head
		rootMod = paths.pop();// keep inherited order if not sub node_modules
		//console.log('::_nodeModulePaths:27: ', from, modPath, paths);
		paths.push(...allWpRoots, ...__oldNMP(path.resolve(path.join(modPath[0], '..'))), ...__oldNMP(from));// add
	                                                                                                         // normal
	                                                                                                         // parents
	}
	return paths;
	//}
};

module.exports = {
	loadPaths  : function ( { allModulePath, cDir }, dist ) {
		modPath = allModulePath.map(p => path.join(cDir, p));
		baseDir = path.join(cDir, dist);
		
		require.main.paths.length = 0;
		require.main.paths.push(...modPath, ...__initialPaths);
	},
	loadWpPaths: function ( allModulePath, allWpPaths ) {
		//console.log('exports::loadWpPaths:62: ', allModulePath);
		modPath    = allModulePath;
		allWpRoots = allWpPaths;
		baseDir    = false;
		//require.main.paths.length = 0;
		//require.main.paths.push(...modPath, ...__initialPaths);
	}
};