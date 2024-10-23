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
      fs        = require('fs'),
      spawn     = require('child_process').spawn,
      spawnSync = require('child_process').spawnSync,
      lpack     = require('../../src'),
      isWin     = process.platform === "win32";

let cmd,
    wpCli,
    originInstallDir = process.env.INIT_CWD,
    argz             = process.argv.slice(2),
    profile,
    script           = 'i',
    confs;
//console.log(':::26: ', originInstallDir, process.env.__IS_LPACK_SETUP__);
try {
	confs = lpack.getAllConfigs(originInstallDir)
} catch ( e ) {
	console.warn("No .layers.json found on the original setup directory ! Skipping layer-pack packages setup...");
	process.exit(0);
}

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

//if ( !confs[profile] )
//	return console.error("Can't find profile '" + profile + "' in the inherited packages\n" +
// utils.printProfilesInfos(confs));

function realpathSync( p ) {
	try {
		return fs.realpathSync(path.normalize(p))
	} catch ( e ) {
		return path.normalize(p);
	}
}
let profilesToSetup = profile && confs[profile] ? [profile] : Object.keys(confs),
    setupsCompleted = [];

for ( let profileToSetup of profilesToSetup ) {
	let toBeSetup = [].concat(confs[profileToSetup].allModuleRoots);
	toBeSetup.shift();// head is already setup
	
	toBeSetup.forEach(
		( root, i ) => {
			let haveNM;
			if ( setupsCompleted.includes(root) )
				return;
			setupsCompleted.push(root);
			
			if (!/\/node_modules\/[^\/]+$/.test(realpathSync(root)))
			{
				console.info('Setup linked layer "', confs[profileToSetup].allModId[i], '" ( ', path.relative(process.cwd(), root), " )");
				spawnSync(
					"npm" + (isWin ? ".cmd" : ""), [script],
					{
						cwd  : realpathSync(root),
						stdio: 'inherit',
						env  : { ...process.env, '__LPACK_PROFILE__': profile, '__IS_LPACK_SETUP__': true }
					}
				);
			}else {
				
				let lModPath = root + "/.layer_modules";
				if ( !fs.existsSync(lModPath) ) {
					fs.mkdirSync(lModPath);
				}
				if ( !fs.existsSync(lModPath + '/package.json') ) {// setup in .layer_modules avoid npm to rm deps on install other packages...
					fs.copyFileSync(root + '/package.json', lModPath + '/package.json');
				}
				if ( fs.existsSync(root + "/node_modules") ) {
					fs.renameSync(root + "/node_modules", root + "/node_modules.tmp");
					haveNM = true;
				}
				console.info('Setup layer "', confs[profileToSetup].allModId[i], '" ( ', path.relative(process.cwd(), root), " )");
				spawnSync(
					"npm" + (isWin ? ".cmd" : ""), [script],
					{
						cwd  : lModPath,
						stdio: 'inherit',
						env  : { ...process.env, '__LPACK_PROFILE__': profile, '__IS_LPACK_SETUP__': true }
					}
				);
				if ( haveNM )
					fs.renameSync(root + "/node_modules.tmp", root + "/node_modules");
			}
		}
	)
}
