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

const path            = require('path'),
      packageCfg      = JSON.parse(require('fs').readFileSync(__dirname + '/../package.json')),
      exec            = require('child_process').exec,
      kill            = require('fkill'),
      Browser         = require('zombie'),
      isPortReachable = require('is-port-reachable');

let appServer,
    projectDir = path.normalize(__dirname + "/../");

describe(packageCfg.name + "@" + packageCfg.version + " : ", () => {
	
	describe('Build', function () {
		it('it build correctly ', function ( done ) {
			this.timeout(Infinity);
			
			exec('npm run build',
			     {
				     cwd: projectDir,
			     },
			     function ( code, outLog ) {
				     code && console.warn('build fail : ' + code + '\n\n');
				     done(code);
			     }
			);
			
			
		});
		it('it run correctly ', function ( done ) {
			this.timeout(Infinity);
			
			appServer = exec('npm run start',
			                 {
				                 cwd: projectDir,
			                 },
			                 function ( code, outLog ) {
				                 code && console.warn('Start fail : ' + code + '\n\n' + outLog);
			                 }
			);
			
			isPortReachable(8080, { host: 'localhost', timeout: 10000 })
				.then(e => setTimeout(tm => done(), 5000))
				.catch(e => done(new Error("Can't connect :( " + e)))
			
		});
	});
	
	Browser.localhost('localhost', 8080);
	
	const browser = new Browser();
	describe('Rendering', function () {
		
		before(function () {
			this.timeout(Infinity);
			return browser.visit('/');
		});
		after(function () {
			this.timeout(Infinity);
			return kill([appServer.pid, ":8080"], { tree: true, force: true, silent: true });
		});
		
		it('should have all the ep', function () {
			browser.assert.text('#ep1', 'ep 1: ok');
			browser.assert.text('#ep2', 'ep 2: ok');
			browser.assert.text('#ep3', 'ep 3: ok');
		});
	});
	
});