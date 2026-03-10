/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

'use strict';

/**
 * @file etc/cli/lpack.js
 *
 * CLI entry point for `lpack`. Resolves the active profile, finds the correct webpack
 * binary (the one co-located with the webpack config in the active profile's package),
 * and spawns a webpack build with the layer-pack environment variables set:
 *
 *   __LPACK_PROFILE__ — the resolved profile ID
 *   __LPACK_HEAD__    — the head project directory (process.cwd() at invocation time)
 *
 * Usage:
 *   lpack                  # build with "default" profile
 *   lpack :api             # build with "api" profile
 *   lpack :?               # list available profiles
 *   lpack -v               # print layer-pack version
 *   lpack --watch          # pass webpack flags through (after profile arg)
 */

const path    = require('path'),
      utils   = require('./utils'),
      resolve = require('resolve'),
      fs      = require('fs'),
      spawn   = require('child_process').spawn,
      lpack   = require('../../src');

let cmd,
    wpCli,
    wpRootMod,
    argz     = process.argv.slice(2),
    profile  = 'default',
    nodeArgz = [],
    confs    = lpack.getAllConfigs();

if ( argz[0] === "-v" ) {
	console.info("layer-pack v" + JSON.parse(fs.readFileSync(path.join(__dirname, "../../package.json"))).version);
	process.exit();
}

while ( argz[0] && /^\-/.test(argz[0]) )
	nodeArgz.push(argz.shift());

if ( argz[0] && /^\:.*$/.test(argz[0]) )
	profile = argz.shift().replace(/^\:(.*)$/, '$1');

if ( profile === "?" )
	return console.info(utils.printProfilesInfos(confs));

if ( !confs[profile] )
	return console.error("Can't find profile '" + profile + "' in the inherited packages\n" + utils.printProfilesInfos(confs));

if ( profile && !confs[profile].allWebpackCfg.length )
	return console.error("Error : Can't find webpack cfg in the inherited packages using profile id '" + profile + "'\n\r" + utils.printProfilesInfos(confs));

// Resolve the webpack binary from the directory containing the active webpack config.
// This ensures we run the webpack version installed in the layer that owns the config,
// not whatever version happens to be in the head project's node_modules.
wpCli     = resolve.sync('webpack', { basedir: path.resolve(path.dirname(confs[profile].allWebpackCfg[0])) });
wpRootMod = wpCli.substr(0, wpCli.lastIndexOf("node_modules"));
wpCli     = path.join(wpRootMod, 'node_modules/webpack/bin/webpack.js');

console.info("Compile using profile id : ", profile, nodeArgz.length && nodeArgz || "");

cmd = spawn(
	"node", [...nodeArgz, wpCli, '--config', __dirname + '/../wp/webpack.config.js', ...argz],
	{
		cwd  : wpRootMod,
		stdio: 'inherit',
		env  : {
			...process.env,
			'__LPACK_PROFILE__': profile,
			'__LPACK_HEAD__'   : process.cwd()
		}
	}
);
process.on('SIGINT', e => cmd.kill()); // catch ctrl-c
process.on('SIGTERM', e => cmd.kill()); // catch kill
