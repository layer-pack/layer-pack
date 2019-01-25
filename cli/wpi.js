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
 *  @contact : caipilabs@gmail.com
 */

'use strict';


var path     = require('path'),
    util     = require('util'),
    resolve  = require('resolve'),
    execSync = require('child_process').execSync,
    cmd,
    wpCli,
    argz     = process.argv.slice(2),
    profile  = 'default';

var wpi = require('../src');
//try {
	if ( argz[0] && /^\:.*$/.test(argz[0]) )
		profile = argz.shift().replace(/^\:(.*)$/, '$1');
	
	if ( !wpi.getConfig(profile) )
		throw new Error("Can't find profile '" + profile + "' in the inherited packages");
	
	// find da good webpack
	wpCli = resolve.sync('webpack', { basedir: path.dirname(wpi.getConfig(profile).allWebpackCfg[0]) });
	wpCli = path.join(wpCli.substr(0, wpCli.lastIndexOf("node_modules")), 'node_modules/.bin/webpack');
	
	console.info("Compile using profile id : ", profile);
	
	cmd = execSync(wpCli + (process.platform == 'win32'
	                        ? '.cmd'
	                        : '') + ' --config ' + wpi.getConfig(profile).allWebpackCfg[0] + ' ' +
		               argz.join(' '), { stdio: 'inherit' });
//} catch ( e ) {
//	console.warn('\n\nFail with err : ' + e + '\n\n');
//	process.exit();
//}
