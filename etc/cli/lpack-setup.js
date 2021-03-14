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

//console.log(':::53: ', confs[profile]);

let toBeSetup = [].concat(confs[profile].allModuleRoots);
toBeSetup.shift();// head is already setup

toBeSetup.forEach(
	( root, i ) => {
		console.info('Setup layer "', confs[profile].allModId[i], '" ( ', path.relative(process.cwd(), root), " )");
		spawnSync(
			"npm" + (isWin ? ".cmd" : ""), ["install"],
			{
				cwd  : root,
				stdio: 'inherit',
				env  : { ...process.env, '__LPACK_PROFILE__': profile }
			}
		);
	}
)
