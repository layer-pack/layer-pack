/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
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

