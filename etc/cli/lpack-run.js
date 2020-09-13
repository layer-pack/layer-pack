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

const path    = require('path'),
      utils   = require('./utils'),
      resolve = require('resolve'),
      spawn   = require('child_process').spawn,
      lpack     = require('../../src');

let cmd,
    wpCli,
    argz    = process.argv.slice(2),
    profile = 'default',
    script  = 'run',
    confs   = lpack.getAllConfigs();

if ( argz[0] && /^\:.*$/.test(argz[0]) )
	profile = argz.shift().replace(/^\:(.*)$/, '$1');
if ( argz[0] )
	script = argz.shift();

if ( profile === "?" )
	return console.info(utils.printProfilesInfos(confs));

if ( !confs[profile] )
	return console.error("Can't find profile '" + profile + "' in the inherited packages\n" + utils.printProfilesInfos(confs));


cmd = confs[profile].allScripts[script];

if ( cmd ) {
	console.info("Running " + profile + "::" + script);
	
	cmd = spawn(
		"node", [cmd, ...argz],
		{
			stdio: 'inherit',
			env  : { ...process.env, '__LPACK_PROFILE__': profile }
		}
	);
	process.on('SIGINT', e => cmd.kill()); // catch ctrl-c
	process.on('SIGTERM', e => cmd.kill()); // catch kill
}
else {
	console.info("Script not found " + profile + "::" + script);
}

