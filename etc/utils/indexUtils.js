/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file etc/utils/indexUtils.js
 *
 * Runtime helper injected into the virtual file system as `.___layerPackIndexUtils.js`.
 * Required by every glob virtual index file to build the nested export object from
 * slash-separated captured path segments.
 */
module.exports = {
	/**
	 * Set a value at a slash-delimited path inside a target object, creating
	 * intermediate objects as needed. Used by glob virtual files to build the default
	 * export tree, e.g. `"admin/Dashboard"` → `target.admin.Dashboard = module`.
	 *
	 * Merge behaviour:
	 *  - If the target slot is empty, assign directly.
	 *  - If the slot holds a plain (non-ES-module) object (a previously created
	 *    intermediate path node), merge the module into it so that siblings and
	 *    deeper entries are preserved.
	 *  - If the slot already holds an ES module, overwrite (handles HMR updates).
	 *
	 * @param {object} _target  - Root export accumulator object (`_exports`)
	 * @param {string} path     - Slash-separated path derived from the captured glob group
	 * @param {object} value    - The required module object
	 */
	walknSetExport( _target, path, value ) {
		let fPath  = path.split('/'),
		    target = _target, i, module;

		// Walk (and create) all intermediate path segments.
		i = 0;
		while ( i < fPath.length - 1 ) target = target[fPath[i]] = target[fPath[i]] || {}, i++;

		// Unwrap single-default-export ES modules for cleaner access (e.g. `admin.Dashboard`
		// instead of `admin.Dashboard.default`).
		module = Object.keys(value).length === 1 && value.default || value;

		if ( !target[fPath[i]] ) {
			target[fPath[i]] = module;
		}
		else if ( !target[fPath[i]].__esModule ) {
			// Slot holds a plain path-node object — merge module properties into it
			// so that sibling entries under the same path prefix are preserved.
			Object.assign(module, target[fPath[i]]);
			target[fPath[i]] = module;
		}
		else {
			// Slot holds an existing ES module (e.g. during HMR) — overwrite it.
			target[fPath[i]] = module;
		}
	}
};