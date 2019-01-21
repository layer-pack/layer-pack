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
 *  @contact : wpilabs@gmail.com
 */

/**
 * @author N.Braun
 */
var path = require('path');

const utils = require("./utils");
/**
 * Main wpi plugin
 *
 */
module.exports = function ( cfg, opts ) {
	let plugin;
	return plugin = {
		sassImporter: function () {
			return plugin._sassImporter(...arguments)
		},
		apply       : function ( compiler ) {
			var cache = {}, plugin = this;
			var roots              = opts.allRoots;
			var alias              = Object.keys(opts.extAliases || {}).map(
				( k ) => ([new RegExp(k), opts.extAliases[k]])),
			    internals          = [];
			
			var contextDependencies = [],
			    fileDependencies    = [],
			    availableExts       = [];
			
			
			// add resolve paths
			compiler.options.resolve         = compiler.options.resolve || {};
			compiler.options.resolve.modules = compiler.options.resolve.modules || [];
			compiler.options.resolve.modules.unshift(...opts.allModulePath);
			
			if ( compiler.options.resolve.modules.extensions ) {
				availableExts.push(...compiler.options.resolve.modules.extensions);
			}
			else availableExts = ["", ".webpack.js", ".web.js", ".js"];
			availableExts = availableExts.filter(ext => ((ext != '.')));
			availableExts.push(...availableExts.filter(ext => ext).map(ext => ('/index' + ext)));
			
			
			compiler.options.resolveLoader         = compiler.options.resolveLoader || {};
			compiler.options.resolveLoader.modules = compiler.options.resolveLoader.modules || [];
			compiler.options.resolveLoader.modules.unshift(...opts.allModulePath);
			
			
			function wpiResolve( data, cb ) {
				var vals,
				    requireOrigin = data.contextInfo.issuer,
				    tmpPath;
				
				for ( var i = 0; i < alias.length; i++ ) {
					if ( alias[i][0].test(data.request) ) {
						data.request = data.request.replace(alias[i][0], alias[i][1]);
						break;
					}
				}
				
				
				data.wpiOriginRrequest = data.request;
				
				
				// resolve inheritable relative
				if ( requireOrigin && /^\./.test(data.request) && (tmpPath = roots.find(r => path.resolve(path.dirname(requireOrigin) + '/' + data.request).startsWith(r))) ) {
					data.request = ("App" + path.resolve(path.dirname(requireOrigin) + '/' + data.request).substr(tmpPath.length)).replace(/\\/g, '/');
				}
				// glob resolving...
				if ( data.request.indexOf('*') != -1 ) {
					
					return utils.indexOf(
						compiler.inputFileSystem,
						roots,
						data.request,
						contextDependencies,
						fileDependencies,
						function ( e, filePath, content ) {
							data.path    = '/';
							data.request = filePath;
							data.file    = true;
							cb(e, data, content);
						}
					)
				}
				
				var resolve = function ( e, filePath, content ) {
					    while ( cache[key].length )
						    cache[key].pop()(e, filePath, content);
					    cache[key] = filePath || true;
				    },
				    apply   = ( e, r, content ) => {
					    if ( e && !r ) return cb(null, data, content);
					    data.request = r;
					    data.file    = true;
					
					    cb(null, data, content);
				    },
				    key;
				
				
				key = data.context + '##' + data.request;
				
				if ( /^\$super$/.test(data.request) ) {
					key = "$super<" + requireOrigin;
				}
				
				if ( cache[key] === true )
					return cb(null, data);
				
				
				if ( cache[key] instanceof Array ) {
					return cache[key].push(apply)
				}
				else if ( cache[key] ) {
					data.request = cache[key];
					data.file    = true;
					return cb(null, data)
				}
				cache[key] = [apply];
				
				// $super resolving..
				if ( /^\$super$/.test(data.request) ) {
					return utils.findParent(
						compiler.inputFileSystem,
						roots,
						requireOrigin,
						[path.extname(requireOrigin)],
						function ( e, filePath, file ) {
							if ( e ) {
								console.warn("Parent not found for " + requireOrigin);
								return resolve(e, "", "/* Parent not found for " + requireOrigin + '*/\n');
							}
							
							resolve(null, filePath);
						}
					);
				}
				// Inheritable root based resolving
				if ( /^App/.test(data.request) ) {
					return utils.findParentPath(
						compiler.inputFileSystem,
						roots,
						data.request.replace(/^App/ig, ''),
						0,
						availableExts,
						function ( e, filePath, file ) {
							if ( e ) {
								//console.log("find %s\t\t\t=> %s", data.request);
								console.error("File not found \n'%s' (required in '%s')",
								              data.request, requireOrigin);
								return resolve(404)
							}
							resolve(null, filePath);
						}
					);
				}
				resolve(null, data.request);
			}
			
			compiler.plugin("normal-module-factory", function ( nmf ) {
				                nmf.plugin("before-resolve", wpiResolve);
			                }
			);
			this._sassImporter = function ( url, prev, cb ) {
				if ( /^(\$|App\/)/.test(url) ) {
					wpiResolve(
						{
							contextInfo: {
								issuer: prev
							},
							request    : url
						},
						function ( e, found, contents ) {
							if ( found || contents ) {
								cb && cb(contents && { contents } || { file: found.request });
							}
							else {
								cb && cb({ file: url });
							}
							
						}
					)
				}
				else return null;
			};
			
			compiler.plugin('after-emit', ( compilation, cb ) => {
				// Add file dependencies if they're not already tracked
				fileDependencies.forEach(( file ) => {
					if ( compilation.fileDependencies.indexOf(file) == -1 ) {
						compilation.fileDependencies.push(file);
					}
				});
				
				// Add context dependencies if they're not already tracked
				contextDependencies.forEach(( context ) => {
					if ( compilation.contextDependencies.indexOf(context) == -1 ) {
						compilation.contextDependencies.push(context);
					}
				});
				cb()
				cache = {};
			});
		}
	}
		;
}
;
