/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

'use strict';

/**
 * @file etc/cli/lpack-setup.js
 *
 * CLI entry point for `lpack-setup`. Installs `devDependencies` for every inherited
 * layer package that is not already fully set up.
 *
 * Problem: npm does not install `devDependencies` of dependencies. When a layer package
 * is in `node_modules`, its devDeps (webpack plugins, loaders, etc.) are absent even
 * though the webpack config in that layer requires them.
 *
 * Solution:
 *  - For packages installed in `node_modules` (read-only symlink or copy): installs
 *    devDeps into a `.layer_modules/` sub-directory inside the package, so npm's own
 *    `npm install` in the head project doesn't wipe them. Temporarily hides the
 *    package's `node_modules` during setup to prevent npm from touching it.
 *  - For locally-linked packages (not inside a `node_modules/` path): runs `npm install`
 *    directly in the layer root.
 *
 * Usage:
 *   lpack-setup              # install devDeps for "default" profile layers
 *   lpack-setup :www         # install for "www" profile layers
 *   lpack-setup :www ci      # use "npm ci" instead of "npm install"
 *   lpack-setup :?           # list available profiles
 *
 * The `__IS_LPACK_SETUP__` env variable prevents recursive setups if a layer's
 * own postinstall script calls lpack-setup again.
 */

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

			if (!/\/node_modules\/[^\/]+$/.test(realpathSync(root))) {
				// Locally-linked layer (e.g. via libsPath or npm link) — run npm directly.
				console.info('Setup linked layer "', confs[profileToSetup].allModId[i], '" ( ', path.relative(process.cwd(), root), " )");
				spawnSync(
					"npm" + (isWin ? ".cmd" : ""), [script],
					{
						cwd  : realpathSync(root),
						stdio: 'inherit',
						env  : { ...process.env, '__LPACK_PROFILE__': profile, '__IS_LPACK_SETUP__': true }
					}
				);
			}
			else {
				// Package installed in node_modules. Install devDeps into .layer_modules/
				// so a subsequent `npm install` in the head project doesn't remove them.
				let lModPath = root + "/.layer_modules";
				if ( !fs.existsSync(lModPath) ) {
					fs.mkdirSync(lModPath);
				}
				if ( !fs.existsSync(lModPath + '/package.json') ) {
					// Copy package.json into .layer_modules/ so npm has something to install from.
					fs.copyFileSync(root + '/package.json', lModPath + '/package.json');
				}
				if ( fs.existsSync(root + "/node_modules") ) {
					// Temporarily hide the existing node_modules so npm doesn't touch it.
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
