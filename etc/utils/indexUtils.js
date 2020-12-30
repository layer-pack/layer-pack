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
	}
};