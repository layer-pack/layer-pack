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
    path           = require('path'),
    modPath        = [],
    allRoots       = [],
    baseDir        = false,
    __initialPaths = [].concat(module.parent.paths),
    __oldNMP       = Module._nodeModulePaths;


Module._nodeModulePaths = function ( from ) {
	let paths;
	if (
		from === baseDir
		||
		allRoots.find(path => (from.substr(0, path.length) === path))
	) {
		paths = [].concat(modPath).concat(__oldNMP(from)).filter(function ( el, i, arr ) {
			return arr.indexOf(el) === i;
		});
		return paths;
	}
	else {
		return [path.join(from, 'node_modules'), path.resolve(from, '..'), ...modPath];
	}
};
module.exports          = function ( paths, roots, dist ) {
	modPath                    = paths;
	allRoots                   = roots;
	baseDir                    = dist;
	module.parent.paths.length = 0;
	module.parent.paths.push(...paths, ...__initialPaths);
}