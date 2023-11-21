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
      fs      = require('fs'),
      spawn   = require('child_process').spawn,
      lpack   = require('../../src');

let cmd,
    wpCli,
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

// find da good webpack
wpCli = resolve.sync('webpack-cli', { basedir: path.resolve(path.dirname(confs[profile].allWebpackCfg[0])) });
wpCli = path.join(wpCli.substr(0, wpCli.lastIndexOf("node_modules")), 'node_modules/webpack-cli/bin/cli.js');

console.info("Compile using profile id : ", profile, nodeArgz.length && nodeArgz || "");

cmd = spawn(
	"node", [...nodeArgz, wpCli, '--config', __dirname + '/../wp/webpack.config.js', ...argz],
	{
		stdio: 'inherit',
		env  : { ...process.env, '__LPACK_PROFILE__': profile }
	}
);
process.on('SIGINT', e => cmd.kill()); // catch ctrl-c
process.on('SIGTERM', e => cmd.kill()); // catch kill
