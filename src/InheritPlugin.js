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
      is              = require('is'),
      fs              = require('fs'),
      resolve         = require('resolve'),
      utils           = require("./utils"),
      isBuiltinModule = require('is-builtin-module');

module.exports = function ( cfg, opts ) {
	let plugin;
	
	// find da good webpack ( the one where the wp cfg is set )
	let wp               = resolve.sync('webpack', { basedir: path.dirname(opts.allWebpackCfg[0] || ".") }),
	    webpack          = require(wp),
	    ExternalModule   = require(path.join(path.dirname(wp), 'ExternalModule')),
	
	    projectPkg       = fs.existsSync(path.normalize(opts.allModuleRoots[0] + "/package.json")) &&
		    JSON.parse(fs.readFileSync(path.normalize(opts.allModuleRoots[0] + "/package.json"))),
	
	    excludeExternals = opts.vars.externals,
	    constDef         = opts.vars.DefinePluginCfg || {},
	    currentProfile   = process.env.__WPI_PROFILE__ || 'default',
	    externalRE       = is.string(opts.vars.externals) && new RegExp(opts.vars.externals);
	
	return plugin = {
		/**
		 * Return a sass resolver fn
		 * @param next {function} resolver that will be called if wpi fail resolving the query
		 * @returns {function(*=, *=, *=): *}
		 */
		sassImporter: function ( next ) {
			return ( url, requireOrigin, cb ) =>
				plugin._sassImporter(url, requireOrigin, cb, next
				                                             ? e => next(url, requireOrigin, cb)
				                                             : null)
		},
		/**
		 * The main plugin fn
		 * @param compiler
		 */
		apply       : function ( compiler ) {
			let cache               = {},
			    plugin              = this,
			    RootAlias           = opts.vars.rootAlias || "App",
			    RootAliasRe         = new RegExp("^" + RootAlias, ''),
			    roots               = opts.allRoots,
			    contextDependencies = [],
			    fileDependencies    = [],
			    availableExts       = [],
			    buildTarget         = compiler.options.target || "web";
			
			// Add some wpi build vars...
			compiler.options.plugins.push(
				new webpack.DefinePlugin(
					{
						'__WPI_PROFILE__'    : currentProfile,
						'__WP_BUILD_TARGET__': buildTarget,
						...constDef
					}));
			
			// include node modules path allowing node executables to require external modules
			if ( /^(async-)?node$/.test(buildTarget) && excludeExternals ) {
				let buildToProjectPath = path.relative(compiler.options.output.path, opts.projectRoot);
				compiler.options.plugins.push(
					new webpack.BannerPlugin({
						                         banner: "/** wi externals **/\n" +
							                         "require('webpack-inherit/etc/node/loadModulePaths.js').loadPaths(" +
							                         "{" +
							                         "allModulePath:" + JSON.stringify(opts.allModulePath.map(p => path.relative(opts.projectRoot, p))) + "," +
							                         "cDir:__dirname+'/" + buildToProjectPath + "'" +
							                         "}," +
							                         JSON.stringify(path.relative(opts.projectRoot, compiler.options.output.path)) +
							                         ");/** /wi externals **/\n",
						                         raw   : true
					                         })
				)
			}
			;
			
			
			// add resolve paths
			compiler.options.resolve         = compiler.options.resolve || {};
			compiler.options.resolve.modules = compiler.options.resolve.modules || [];
			compiler.options.resolve.modules.unshift(...opts.allModulePath);
			compiler.options.resolveLoader         = compiler.options.resolveLoader || {};
			compiler.options.resolveLoader.modules = compiler.options.resolveLoader.modules || [];
			compiler.options.resolveLoader.modules.unshift(...opts.allModulePath);
			
			// detect resolvable ext
			if ( compiler.options.resolve.extensions ) {
				availableExts.push(...compiler.options.resolve.extensions);
			}
			else availableExts = ["", ".webpack.js", ".web.js", ".js"];
			availableExts = availableExts.filter(ext => ((ext != '.')));
			availableExts.push(...availableExts.filter(ext => ext).map(ext => ('/index' + ext)));
			availableExts.unshift('');
			
			
			/**
			 * The main resolver / glob mngr
			 */
			function wpiResolve( data, cb ) {
				let requireOrigin = data.contextInfo.issuer,
				    context       = data.context || path.dirname(requireOrigin),
				    tmpPath;
				
				data.wpiOriginRequest = data.request;
				
				// resolve inheritable & relative @todo
				if ( context && /^\./.test(data.request) && (tmpPath = roots.find(r => path.resolve(context + '/' + data.request).startsWith(r))) ) {
					data.request = (RootAlias + path.resolve(context + '/' + data.request).substr(tmpPath.length)).replace(/\\/g, '/');
				}
				
				let isSuper = /^\$super$/.test(data.request),
				    isGlob  = data.request.indexOf('*') != -1,
				    isRoot  = RootAliasRe.test(data.request);
				
				// glob resolving...
				if ( isGlob ) {
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
				
				if ( !isRoot && !isSuper ) { // let wp deal with it
					return cb(null, data)
				}
				
				// small caching system as we are hooking before resolve
				let resolve = function ( e, filePath, content ) {
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
				
				if ( isSuper ) {
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
				if ( isSuper ) {
					return utils.findParent(
						compiler.inputFileSystem,
						roots,
						requireOrigin,
						[''],
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
				if ( isRoot ) {
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
				
				                utils.addVirtualFile(
					                compiler.inputFileSystem,
					                path.normalize(roots[0] + '/.wpiConfig.json'),
					                JSON.stringify(
						                {
							                project    : {
								                name       : projectPkg.name,
								                description: projectPkg.description,
								                author     : projectPkg.author,
								                version    : projectPkg.version
							                },
							                buildDate  : Date.now(),
							                profile    : currentProfile,
							                projectRoot: opts.projectRoot,
							                vars       : opts.vars,
							                allCfg     : opts.allCfg,
							                allModId   : opts.allModId,
						                }
					                )
				                );
				
				                excludeExternals && nmf.plugin('factory', function ( factory ) {
					                return function ( data, callback ) {
						                let requireOrigin = data.contextInfo.issuer,
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
							                //console.warn("ext!", request);
							                return callback(null, new ExternalModule(
								                request,
								                opts.vars.externalMode || "commonjs"
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
				cb();
				cache = {};
			});
		}
	}
}

