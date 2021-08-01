/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

'use strict';


var path             = require('path'),
	mustache         = require('mustache'),
	fs               = require('fs-extra'),
	minimist         = require('minimist'),
	execSync         = require('child_process').execSync,
	cDir             = process.cwd(),
	projectDir,
	tmp,
	argz             = process.argv.slice(2),
	projectName      = 'newProject',
	projectId        = 'new-project',
	originTemplateId = 'default',
	glob             = require('fast-glob'),
	originPackage    = '.',
	iniRe            = /^([^\:]+)(?:\:\:([^\:]*))?(?:\:([^\:]*))?$/,
	vars             = {},
	configs          = {},
	originProfile    = 'default',
	stdIoOpts,
	lpack            = require('../../src');

if ( !argz.length )
	vars.h = true;
if ( argz[ 0 ] && /^[\w\-_\.]+$/.test(argz[ 0 ]) ) {
	projectName = argz[ 0 ];
	projectId   = projectName.replace(/[^\w]/ig, '-')
	argz.shift();
}
if ( argz[ 0 ] && iniRe.test(argz[ 0 ]) ) {
	tmp              = argz[ 0 ].match(iniRe);
	originTemplateId = tmp[ 3 ] || originTemplateId;
	originProfile    = tmp[ 2 ] || originProfile;
	originPackage    = tmp[ 1 ];
	argz.shift();
}
vars = {
	...vars, ...minimist(process.argv.slice(2)),
	projectId,
	projectName,
	originTemplateId,
	originProfile,
	originPackage
};
if ( vars.h || vars.help ) {
	console.info("Create a new project using lpack :");
	console.info("Syntax : lpack-init project_name inheritedPackage::profileId:templateId");
	console.info(" ( Or ): lpack-init project_name inheritedPackage (using default profile & default template");
	return;
}


projectDir = path.join(cDir, vars.projectName);
stdIoOpts  = {
	stdio: 'inherit',
	env  : { '__LPACK_PROFILE__': originProfile },
	cwd  : projectDir
};

console.info("Init using : ", originPackage, originProfile, originTemplateId, vars);
console.info("Init in : ", projectDir);

fs.mkdirSync(projectDir);
execSync('npm init -y', stdIoOpts);
execSync('npm i ' + originPackage + ' -s', stdIoOpts);
//execSync('npm link ' + originPackage, stdIoOpts);

process.chdir(projectDir);
configs = lpack.getAllConfigs(path.join(projectDir, 'node_modules', originPackage));

if ( !configs[ originProfile ] )
	throw new Error("Can't find originProfile '" + originProfile + "' in " + originPackage);

if ( !configs[ originProfile ].allTemplates[ originTemplateId ] ) {
	throw new Error("Can't find originTemplateId '" + originTemplateId + "' in " + originPackage);
}

vars.originPackage = JSON.parse(fs.readFileSync(path.join(projectDir, 'node_modules', originPackage, "package.json")).toString());

console.info("Init using : ", configs[ originProfile ].allTemplates[ originTemplateId ], vars);

let baseTplPath = configs[ originProfile ].allTemplates[ originTemplateId ];

glob.sync(
	[
		baseTplPath + '/**',
		baseTplPath + '/**/.*'
	])
	.forEach(
		file => {
			let dir        = path.dirname(path.join(projectDir, file.substr(baseTplPath.length + 1))),
				targetFile = path.join(projectDir, file.substr(baseTplPath.length + 1));
			try {
				fs.ensureDirSync(dir);
				fs.writeFileSync(targetFile, mustache.render(fs.readFileSync(file).toString(), vars, undefined, ['{%', '%}']));
				console.log('created :' + targetFile)
			} catch ( e ) {
				console.warn('fail :' + targetFile, e + '')
			}
		}
	)

execSync('npm i', stdIoOpts);


console.log("Project isinited at : " + projectDir);