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

'use strict';


var path     = require('path'),
    util     = require('util'),
    resolve  = require('resolve'),
    execSync = require('child_process').execSync,
    cmd,
    argz     = process.argv.slice(2),
    profile  = 'default',
    script   = 'run',
    wpi      = require('../../src');

if ( argz[0] && /^\:.*$/.test(argz[0]) )
	profile = argz.shift().replace(/^\:(.*)$/, '$1');
if ( argz[0] )
	script = argz.shift();

if ( profile == "?" ) {
	console.info("Here the available profiles :")
	let confs = wpi.getAllConfigs();
	Object.keys(confs)
	      .forEach(
		      p => {
			      console.info(p + " using rootAlias '" + confs[p].vars.rootAlias + "' inheriting : ",
			                   confs[p].allModId[0] + ":" + (confs[p].allCfg[0].basedOn || p))
		      }
	      )
	return;
}

if ( !wpi.getConfig(profile) )
	throw new Error("Can't find profile '" + profile + "' in the inherited packages");

cmd = wpi.getConfig(profile).allScripts[script];

if ( cmd ) {
	console.info("Running " + profile + "::" + script);
	
	execSync(
		'"' + process.execPath + '" ' + cmd + ' ' + argz.join(' '),
		{
			stdio: 'inherit',
			env  : { '__WPI_PROFILE__': profile }
		});
}
else {
	console.info("Script not found " + profile + "::" + script);
}

