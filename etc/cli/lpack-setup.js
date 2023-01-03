/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

'use strict';

const path      = require('path'),
      utils     = require('./utils'),
      resolve   = require('resolve'),
      spawn     = require('child_process').spawn,
      spawnSync = require('child_process').spawnSync,
      lpack     = require('../../src'),
      isWin     = process.platform === "win32";

let cmd,
    wpCli,
    argz    = process.argv.slice(2),
    profile = 'default',
    script  = 'i',
    confs   = lpack.getAllConfigs();

if ( process.env.__IS_LPACK_SETUP__ ) {// ignore sub setup as another setup is running
	process.exit(0)
}

if ( argz[0] && /^\:.*$/.test(argz[0]) )
	profile = argz.shift().replace(/^\:(.*)$/, '$1');
if ( argz[0] )
	script = argz.shift();

if ( profile === "?" ) {
	console.info("Will run npm on all inherited layers.\n\nlpack-setup :[profile : default] [npm command : install]\n")
	return console.info(utils.printProfilesInfos(confs));
}

if ( !confs[profile] )
	return console.error("Can't find profile '" + profile + "' in the inherited packages\n" + utils.printProfilesInfos(confs));

//console.log(':::53: ', confs[profile]);

let toBeSetup = [].concat(confs[profile].allModuleRoots);
toBeSetup.shift();// head is already setup

toBeSetup.forEach(
	( root, i ) => {
		console.info('Setup layer "', confs[profile].allModId[i], '" ( ', path.relative(process.cwd(), root), " )");
		spawnSync(
			"npm" + (isWin ? ".cmd" : ""), [script],
			{
				cwd  : root,
				stdio: 'inherit',
				env  : { ...process.env, '__LPACK_PROFILE__': profile, '__IS_LPACK_SETUP__': true }
			}
		);
	}
)
