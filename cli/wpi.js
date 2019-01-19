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
 *  @contact : caipilabs@gmail.com
 */
'use strict';

var program = require('commander');
var grunt   = require('grunt'),
    packageCfg,
    pDir    = program.dir || process.cwd(),
    path    = require("path"),
    project;

//
//try {
//	packageCfg = JSON.parse(require('fs').readFileSync(__dirname + '/../../package.json'))
//} catch ( e ) {
//}

console.log("Caipi CLI ", packageCfg.version);
program
	.version(packageCfg.version)
	.option('-b, --break [port]', 'start debug on port, & w8 debugger')
	.option('--noSSHR', 'noSSHR in dev mode')
	.option('-p, --port [port]', 'Port number')
	.option('-d, --dir [path]', 'Project path')
	.command('help [cmd]', 'Get usage help')
	.parse(process.argv);
