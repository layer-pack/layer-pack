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

var path    = require('path'),
    is      = require('is'),
    resolve = require('resolve');

const utils           = require("./utils");
const isBuiltinModule = require('is-builtin-module');
/**
 * Main wpi plugin
 *
 */
module.exports = function ( cfg, opts ) {
	let plugin;
	
	// find da good webpack
	let wp               = resolve.sync('webpack', { basedir: path.dirname(opts.allWebpackCfg[0]) }),
	    ExternalModule   = require(path.join(path.dirname(wp), 'ExternalModule')),
	    excludeExternals = opts.vars.externals,
	    externalRE       = is.string(opts.vars.externals) && new RegExp(opts.vars.externals);
	
	return plugin = {
		sassImporter: function ( next ) {
			return ( url, requireOrigin, cb ) =>
				plugin._sassImporter(url, requireOrigin, cb, next
				                                             ? e => next(url, requireOrigin, cb)
				                                             : null)
		},
		apply       : function ( compiler ) {
			var cache               = {},
			    plugin              = this,
			    RootAlias           = opts.vars.rootAlias || "App",
			    RootAliasRe         = new RegExp("^" + RootAlias, 'g'),
			    roots               = opts.allRoots,
			    alias               = Object.keys(opts.extAliases || {})
			                                .map(( k ) => ([new RegExp(k), opts.extAliases[k]])),
			    contextDependencies = [],
			    fileDependencies    = [],
			    availableExts       = [];
			
			
			// add resolve paths
			compiler.options.resolve         = compiler.options.resolve || {};
			compiler.options.resolve.modules = compiler.options.resolve.modules || [];
			compiler.options.resolve.modules.unshift(...opts.allModulePath);
			compiler.options.resolveLoader         = compiler.options.resolveLoader || {};
			compiler.options.resolveLoader.modules = compiler.options.resolveLoader.modules || [];
			compiler.options.resolveLoader.modules.unshift(...opts.allModulePath);
			
			// detect resolvable ext
			if ( compiler.options.resolve.modules.extensions ) {
				availableExts.push(...compiler.options.resolve.modules.extensions);
			}
			else availableExts = ["", ".webpack.js", ".web.js", ".js"];
			availableExts = availableExts.filter(ext => ((ext != '.')));
			availableExts.push(...availableExts.filter(ext => ext).map(ext => ('/index' + ext)));
			
			
			/**
			 * The main resolver / glob mngr
			 */
			function wpiResolve( data, cb ) {
				var requireOrigin = data.contextInfo.issuer,
				    context       = data.context || path.dirname(requireOrigin),
				    tmpPath;
				
				data.wpiOriginRequest = data.request;
				
				for ( var i = 0; i < alias.length; i++ ) {
					if ( alias[i][0].test(data.request) ) {
						data.request = data.request.replace(alias[i][0], alias[i][1]);
						break;
					}
				}
				
				// resolve inheritable & relative @todo
				if ( context && /^\./.test(data.request) && (tmpPath = roots.find(r => path.resolve(context + '/' + data.request).startsWith(r))) ) {
					data.request = (RootAlias + path.resolve(context + '/' + data.request).substr(tmpPath.length)).replace(/\\/g, '/');
				}
				
				// glob resolving...
				if ( data.request.indexOf('*') != -1 ) {
					return (/\.s?css$/.test(requireOrigin) ? utils.indexOfScss : utils.indexOf)(
						compiler.inputFileSystem,
						roots,
						data.request,
						contextDependencies,
						fileDependencies,
						RootAlias,
						RootAliasRe,
						function ( e, filePath, content ) {
							data.path    = '/';
							data.request = filePath;
							data.file    = true;
							cb(e, data, content);
						}
					)
				}
				
				// small caching system as we are hooking before resolve
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
				
				if ( cache[key] instanceof Array ) {// deal with concurrent query
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
							
							if ( e ) {// silently deal when there is no parents
								console.warn("Parent not found for " + requireOrigin);
								return resolve(e, "", "/* Parent not found for " + requireOrigin + '*/\n');
							}
							
							resolve(null, filePath);
						}
					);
				}
				
				// Inheritable root based resolving
				if ( RootAliasRe.test(data.request) ) {
					return utils.findParentPath(
						compiler.inputFileSystem,
						roots,
						data.request.replace(RootAliasRe, ''),
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
			
			
			// sass resolver
			this._sassImporter = function ( url, requireOrigin, cb, next ) {
				let tmpPath;
				if ( requireOrigin &&
					/^\./.test(url) &&
					(tmpPath = roots.find(r => path.resolve(path.dirname(requireOrigin) + '/' + url).startsWith(r))) ) {
					
					url = (RootAlias + path.resolve(path.dirname(requireOrigin) + '/' + url).substr(tmpPath.length)).replace(/\\/g, '/');
				}
				
				if ( RootAliasRe.test(url) || url[0] === '$' || url[0] === '.' ) {
					wpiResolve(
						{
							contextInfo: {
								issuer: requireOrigin
							},
							request    : path.normalize(url)
						},
						( e, found, contents ) => {
							if ( found || contents ) {
								cb && cb(contents && { contents } || { file: found.request });
							}
							else {
								next && next()
							}
							
						}
					)
				}
				else return cb(url, requireOrigin, cb);
			};
			
			// wp hook
			compiler.plugin("normal-module-factory",
			                function ( nmf ) {
				
				
				                excludeExternals && nmf.plugin('factory', function ( factory ) {
					                return function ( data, callback ) {
						                var requireOrigin = data.contextInfo.issuer,
						                    context       = data.context || path.dirname(requireOrigin),
						                    request       = data.wpiOriginRequest || data.request,
						                    mkExt         = isBuiltinModule(data.request),
						                    isInRoot;
						
						                if ( data.contextInfo.issuer === '' )// entry points ?
							                return factory(data, callback);
						
						                if ( !mkExt ) {
							                //console.log(data.request, context, roots)
							                // is it external ? @todo
							                mkExt = !(
								                context &&
								                /^\./.test(data.request)
								                ? (isInRoot = roots.find(r => path.resolve(context + '/' + data.request).startsWith(r)))
								                : (isInRoot = roots.find(r => path.resolve(data.request).startsWith(r)))
							                );
						                }
						
						                if ( mkExt &&
							                (
								                !externalRE
								                || externalRE.test(data.request)
							                )
							                &&
							                !(!isInRoot && /^\./.test(data.request)) // so it's relative to an internal
						                ) {
							                //console.warn("ext!", data)
							                return callback(null, new ExternalModule(
								                data.request,
								                compiler.options.output.libraryTarget
							                ));
							
						                }
						                else {
							                //if ( mkExt && !(!isInRoot && /^\./.test(data.request)) )
							                //console.warn(data.request)
							                return factory(data, callback);
						                }
						
					                };
				                });
				                nmf.plugin("before-resolve", wpiResolve);
			                }
			);
			
			// should deal with hot reload watched files & dirs
			compiler.plugin('after-emit', ( compilation, cb ) => {
				compilation.fileDependencies    = compilation.fileDependencies || [];
				compilation.contextDependencies = compilation.contextDependencies || [];
				if ( compilation.fileDependencies.concat ) {
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
				}
				else {// webpack 4
					// Add file dependencies if they're not already tracked
					fileDependencies.forEach(( file ) => {
						compilation.fileDependencies.add(file);
					});
					
					// Add context dependencies if they're not already tracked
					contextDependencies.forEach(( context ) => {
						compilation.contextDependencies.add(context);
					});
				}
				cb()
				cache = {};
			});
		}
	}
}
