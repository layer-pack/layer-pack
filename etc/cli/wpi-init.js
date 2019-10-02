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


var path             = require('path'),
    mustache         = require('mustache'),
    fs               = require('fs-extra'),
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
    wpi              = require('../../src');

if ( !argz.length )
	vars.h = true;
if ( argz[0] && /^[\w\-_\.]+$/.test(argz[0]) ) {
	projectName = argz[0];
	projectId   = projectName.replace(/[^\w]/ig, '-')
	argz.shift();
}
if ( argz[0] && iniRe.test(argz[0]) ) {
	tmp              = argz[0].match(iniRe);
	originTemplateId = tmp[3] || originTemplateId;
	originProfile    = tmp[2] || originProfile;
	originPackage    = tmp[1];
	argz.shift();
}
vars = {
	...vars, ...require('minimist')(process.argv.slice(2)),
	projectId,
	projectName,
	originTemplateId,
	originProfile,
	originPackage
};
if ( vars.h || vars.help ) {
	console.info("Create a new project using wpi :");
	console.info("Syntax : wpi-init project_name inheritedPackage::profileId:templateId");
	console.info(" ( Or ): wpi-init project_name inheritedPackage (using default profile & default template");
	return;
}


projectDir = path.join(cDir, vars.projectName);
stdIoOpts  = { stdio: 'inherit', env: { '__WPI_PROFILE__': originProfile }, cwd: projectDir };

console.info("Init using : ", originPackage, originProfile, originTemplateId, vars);
console.info("Init in : ", projectDir);

fs.mkdirSync(projectDir);
execSync('npm init -y', stdIoOpts);
execSync('npm i ' + originPackage + ' -s', stdIoOpts);
//execSync('npm link ' + originPackage, stdIoOpts);

process.chdir(projectDir);
configs = wpi.getAllConfigs(path.join(projectDir, 'node_modules', originPackage));

if ( !configs[originProfile] )
	throw new Error("Can't find originProfile '" + originProfile + "' in " + originPackage);

if ( !configs[originProfile].allTemplates[originTemplateId] )
{
	throw new Error("Can't find originTemplateId '" + originTemplateId + "' in " + originPackage);
}

vars.originPackage = JSON.parse(fs.readFileSync(path.join(projectDir, 'node_modules', originPackage, "package.json")).toString());

console.info("Init using : ", configs[originProfile].allTemplates[originTemplateId], vars);

let baseTplPath = configs[originProfile].allTemplates[originTemplateId];

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