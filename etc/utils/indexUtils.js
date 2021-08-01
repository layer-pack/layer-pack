/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
module.exports = {
	/**
	 * Walk & set executables from globs requires
	 * @param _target
	 * @param path
	 * @param value
	 */
	walknSetExport( _target, path, value ) {
		let fPath  = path.split('/'),
		    target = _target, i, module;
		
		i = 0;
		while ( i < fPath.length - 1 ) target = target[fPath[i]] = target[fPath[i]] || {}, i++;
		
		module = Object.keys(value).length === 1 && value.default || value;
		
		if ( !target[fPath[i]] ) {
			target[fPath[i]] = module;
		}
		else if ( !target[fPath[i]].__esModule ) {// if this is simple path obj write over
			Object.assign(module, target[fPath[i]]);
			target[fPath[i]] = module;
		}
		else {// when we are in hot reload this may delete some sub modules... @todo
			target[fPath[i]] = module;
		}
	}
};