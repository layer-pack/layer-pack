/*
 *
 * Copyright (C) 2019 Nathanael Braun
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

var Module         = require('module').Module,
    modPath        = [],
    allRoots       = [],
    baseDir        = false,
    __initialPaths = module.parent.paths,
    __oldRF        = Module._resolveFilename,
    __oldNMP       = Module._nodeModulePaths;


Module._nodeModulePaths = function ( from ) {
	let paths;
	if (
		baseDir && from.substr(0, baseDir.length) === baseDir
		||
		allRoots.find(path => (from.substr(0, path.length) === path))
	) {
		
		paths = [].concat(modPath).concat(__oldNMP(from)).filter(function ( el, i, arr ) {
			return arr.indexOf(el) === i;
		});
		return paths;
	}
	else return __oldNMP.call(this, from);
};
module.exports          = function ( paths, roots, dist ) {
	modPath             = paths;
	allRoots            = roots;
	baseDir             = dist;
	module.parent.paths = [].concat(paths).concat(__initialPaths);
}