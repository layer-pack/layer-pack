/*
 * Copyright 2023 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const path                 = require('path'),
      is                   = require('is'),
      fs                   = require('fs'),
      resolve              = require('resolve'),
      utils                = require("./utils"),
      InjectPlugin         = require("webpack-inject-plugin").default,
      ENTRY_ORDER          = require("webpack-inject-plugin").ENTRY_ORDER,
      isBuiltinModule      = require('is-builtin-module'),
      VirtualModulesPlugin = require('webpack-virtual-modules'),
      Watchpack            = require("watchpack");

const RE = {
	winSlash     : /\\/g,
	localPath    : /^\./,
	sassSuffix   : /[\?\#][^\/\\]+$/,
	getSassSuffix: /^(.*)([\?\#][^\/\\]+$)/,
	isSuper      : /^\$super$/,
	isSass       : /\.s?css$/,
	packageName  : /^(\@[^\\\/]+[\\\/][^\\\/]+|[^\\\/]+)(.*)$/i
};

module.exports = function ( cfg, opts ) {
	let plugin;
	
	// find da good webpack ( the one where the wp cfg is set )
	let wp               = resolve.sync('webpack', { basedir: path.dirname(opts.allWebpackCfg[0] || ".") }),
	    wpEr             = resolve.sync('enhanced-resolve', { basedir: path.dirname(opts.allWebpackCfg[0] || ".") }),
	    webpack          = require(wp),
	    ExternalModule   = require(path.join(path.dirname(wp), 'ExternalModule')),
	    getPaths         = require(path.join(path.dirname(wpEr), 'getPaths')),
	    forEachBail      = require(path.join(path.dirname(wpEr), 'forEachBail')),
	    
	    projectPkg       = fs.existsSync(path.normalize(opts.allModuleRoots[0] + "/package.json")) &&
		    JSON.parse(fs.readFileSync(path.normalize(opts.allModuleRoots[0] + "/package.json"))),
	    
	    excludeExternals = opts.vars.externals,
	    constDef         = opts.vars.DefinePluginCfg || {},
	    currentProfile   = process.env.__LPACK_PROFILE__ || 'default',
	    externalRE       = is.string(opts.vars.externals) && new RegExp(opts.vars.externals),
	    vMod             = new VirtualModulesPlugin(),
	    globDirWatcher;
	
	return plugin = {
		/**
		 * Return a sass resolver fn
		 * @param next {function} resolver that will be called if lPack fail resolving
		 *     the query
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
		apply: function ( compiler ) {
			let cache               = {},
			    plugin              = this,
			    RootAlias           = opts.vars.rootAlias || "App",
			    RootAliasRe         = new RegExp("^" + RootAlias, ''),
			    roots               = opts.allRoots,
			    modulesPathByLength = [...opts.allModulePath]
				    .sort(( a, b ) => b.length - a.length),
			    contextDependencies = {},
			    fileDependencies    = [],
			    availableExts       = [],
			    activeGlobs         = { scss: {}, jsx: {} },
			    activeIgnoredFiles  = [],
			    buildTarget         = compiler.options.target || "web",
			    useHotReload        = !!compiler.options.devServer,
			    isNodeBuild         = /^(async-)?node$/.test(buildTarget),
			    startBuildTm        = Date.now();
			
			compiler.options.watchOptions = compiler.options.watchOptions || {};
			// virtual module plugin
			compiler.options.plugins.push(vMod);
			
			// Add some lPack build vars...
			compiler.options.plugins.push(
				new webpack.DefinePlugin(
					{
						'__LPACK_PROFILE__'  : currentProfile,
						'__WP_BUILD_TARGET__': buildTarget,
						...constDef
					}));
			
			// add the resolvers plugins
			compiler.options.resolve         = compiler.options.resolve || {};
			compiler.options.resolve.cache   = false;
			compiler.options.resolve.plugins = compiler.options.resolve.plugins || [];
			
			// resolver for intra App requires
			compiler.options.resolve.plugins.push(
				{
					target: "after-described-resolve",
					source: "parsed-resolve",
					apply( resolver ) {
						const target = resolver.ensureHook(this.target);
						resolver
							.getHook(this.source)
							.tapAsync("layer-pack", ( request, resolveContext, callback ) => {
								//console.log('after-described-resolve', request.request);
								lPackResolve(
									request,
									( err, req, data ) => {
										callback(err, req)
									})
							});
					}
				}
			);
			let resolveCache    = {},
			    resolvingQueues = {};
			// resolver for deps & deps of deps
			// here is the big complex pbm: make work node_modules dir & inherited modules dirs
			// main pbm is deps of deps may be in parents dir or in other layers modules dirs
			// In some cases this can cause duplicates of compatible imports versions
			// there probably some optims & cache options
			compiler.options.resolve.plugins.push(
				{
					target: "module",
					source: "raw-module",
					apply( resolver ) {
						const target = resolver.ensureHook(this.target);
						resolver
							.getHook(this.source)
							.tapAsync(
								'layer-pack',
								( request, resolveContext, callback ) => {// based on enhanced resolve ModulesInHierachicDirectoriesPlugin
									const fs                            = resolver.fileSystem,
									      isInternal                    = roots.find(r => path.resolve(request.path).startsWith(r));
									let addrs                           = [],
									    rootModPath,
									    [, packageName, packageSubPath] = request.request.match(RE.packageName),
									    key                             = request.path + "!|!" + request.request;
									
									if ( resolveCache[key] ) {
										//console.log('Use cache ', key);
										return callback(resolveCache[key].err,
										                resolveCache[key].res ?
										                {
											                ...resolveCache[key].res,
											                context: request.context
										                } : null);
									}
									resolvingQueues[key] = resolvingQueues[key] || [];
									resolvingQueues[key].push(
										( err, res ) => {
											callback(
												err,
												res && res.path
												? { ...res, context: request.context }
												: null
											)
										}
									)
									if ( resolvingQueues[key].length > 1 ) {
										return;
									}
									if ( !!isInternal ) {
										addrs.push(
											...opts.allModulePath.filter(// custom lib dir
											                             ( p, i ) => !opts.allModuleRoots.find(mp => (path.join(mp, "node_modules") === p))
											),
											...opts.allModuleRoots.filter(// priorize defined deps to avoid "shared" deps
											                              ( p, i ) => (
												                              opts.allPackageCfg[i].dependencies
												                              && opts.allPackageCfg[i].dependencies[packageName]
											                              )
											).map(p => {
												return resolver.join(p, "node_modules")
											}),
											...opts.allModuleRoots.filter(
												( p, i ) => !(
													opts.allPackageCfg[i].dependencies
													&& opts.allPackageCfg[i].dependencies[packageName]
												)
											).map(p => {
												return resolver.join(p, "node_modules")
											}),
											...getPaths(opts.allLayerRoot[0]) // add mods from head layer parents dir
												.paths.map(p => {
													return resolver.join(p, "node_modules")
												})
										);
										//console.log(':::183: ', packageName, request.request, addrs);
									}
									else {
										// get all possible sub node_modules until the current layer's node_modules
										addrs       = getPaths(request.path)
											.paths.map(p => {
												return resolver.join(p, "node_modules")
											});
										rootModPath = modulesPathByLength.find(r => addrs[0].startsWith(r))
										if ( rootModPath )
											addrs = addrs.filter(
												addr => addr.startsWith(rootModPath)
											);
										else
											addrs = [];
										
										addrs.pop();//rm origin mods root
										
										addrs.push(
											...opts.allModuleRoots.filter(// prefer layer where its defined in deps
											                              ( p, i ) => (
												                              opts.allPackageCfg[i].dependencies
												                              && opts.allPackageCfg[i].dependencies[packageName]
											                              )
											).map(p => {
												return resolver.join(p, "node_modules")
											}),
											...opts.allModuleRoots.filter(// if not defined try shared deps ( not formally defined in deps )
											                              ( p, i ) => !(
												                              opts.allPackageCfg[i].dependencies
												                              && opts.allPackageCfg[i].dependencies[packageName]
											                              )
											).map(p => {
												return resolver.join(p, "node_modules")
											}),
											...getPaths(opts.allLayerRoot[0]) // add mods from head layer parents dir
												.paths.map(p => {
													return resolver.join(p, "node_modules")
												})
										)
									}
									addrs = addrs.filter(( path, i ) => addrs.indexOf(path) === i);
									
									forEachBail(
										addrs,
										( addr, callback ) => {
											fs.stat(addr, ( err, stat ) => {
												if ( !err && stat && stat.isDirectory() ) {
													const obj = {
														...request,
														path   : addr,
														request: "./" + request.request,
														module : false
													};
													
													const message = "looking for modules in " + addr;
													return resolver.doResolve(
														target,
														obj,
														message,
														resolveContext,
														( err, res ) => {
															callback(err, res)
														}
													);
												}
												if ( resolveContext.log )
													resolveContext.log(
														addr + " doesn't exist or is not a directory"
													);
												if ( resolveContext.missingDependencies )
													resolveContext.missingDependencies.add(addr);
												return callback();
											});
										},
										( err, res ) => {
											
											resolveCache[key] = { err, res };
											while ( resolvingQueues[key].length )
												resolvingQueues[key].pop()(err, res);
											delete resolvingQueues[key];
											//callback
										}
									);
								}
							)
					}
				}
			);
			// resolvers for the loaders
			compiler.options.resolveLoader         = compiler.options.resolveLoader || {};
			compiler.options.resolveLoader.plugins = compiler.options.resolveLoader.plugins || [];
			compiler.options.resolveLoader.plugins.push(
				{
					target: "module",
					source: "raw-module",
					apply( resolver ) {
						const target = resolver.ensureHook(this.target);
						resolver
							.getHook(this.source)
							.tapAsync(
								'layer-pack',
								( request, resolveContext, callback ) => {// based on enhanced resolve ModulesInHierachicDirectoriesPlugin
									const fs         = resolver.fileSystem;
									const addrs      = [],
									      innerPaths = getPaths(request.path)
										      .paths.map(p => {
											      return resolver.join(p, "node_modules")
										      });
									let packageName  = request.request.match(RE.packageName)[0];
									addrs.push(
										//...innerPaths,
										...opts.allModuleRoots.filter(
											( p, i ) => (
												opts.allPackageCfg[i].devDependencies
												&& opts.allPackageCfg[i].devDependencies[packageName]
											)
										).map(p => {
											return resolver.join(p, "node_modules")
										}),
										...opts.allModuleRoots.filter(
											( p, i ) => !(
												opts.allPackageCfg[i].devDependencies
												&& opts.allPackageCfg[i].devDependencies[packageName]
											)
										).map(p => {
											return resolver.join(p, "node_modules")
										})
										//...getPaths(roots[0]) // add mods from head layer parents dir
										//	.paths.map(p => {
										//		return resolver.join(p, "node_modules")
										//	})
									)
									addrs.push(path.normalize(opts.allWebpackRoot[0] + '/node_modules'));//origin
									
									forEachBail(
										addrs,
										( addr, callback ) => {
											fs.stat(addr, ( err, stat ) => {
												//console.log(':::187: ', addr);
												if ( !err && stat && stat.isDirectory() ) {
													const obj = {
														...request,
														path   : addr,
														request: "./" + request.request,
														module : false
													};
													
													const message = "looking for modules in " + addr;
													return resolver.doResolve(
														target,
														obj,
														message,
														resolveContext,
														callback
													);
												}
												if ( resolveContext.log )
													resolveContext.log(
														addr + " doesn't exist or is not a directory"
													);
												if ( resolveContext.missingDependencies )
													resolveContext.missingDependencies.add(addr);
												return callback();
											});
										},
										callback
									);
								}
							)
					}
				}
			);
			
			// Add required code & info to resolve bundled mods (may fail & require install sub deps manually)
			if ( isNodeBuild && excludeExternals ) {
				compiler.options.plugins.push(
					new InjectPlugin(function () {
						return "" +
							"/** layer pack externals modules loader **/\n" +
							fs.readFileSync(path.join(__dirname,
							                          '../etc/node/loadModulePaths_inject.js')) +
							`()( {
							 allModulePath:${JSON.stringify(opts.allModulePath.map(p => path.normalize(path.relative(opts.projectRoot, p)).replace(/\\/g, '/')))},
							 allModuleRoots:${JSON.stringify(opts.allModuleRoots.map(p => path.normalize(path.relative(opts.projectRoot, p + "/node_modules")).replace(/\\/g, '/')))},
							 allDeps:${JSON.stringify(opts.allModuleRoots.map(
								( p, i ) => (
									opts.allPackageCfg[i].dependencies ?
									Object.keys(opts.allPackageCfg[i].dependencies)
									                                   :
									[]
								)
							))},
							 cDir:path.join(__dirname,${
								JSON.stringify(path.normalize(path.relative(compiler.options.output.path,
								                                            opts.projectRoot)).replace(/\\/g, '/'))
							})
							},
							${JSON.stringify(path.relative(opts.projectRoot, compiler.options.output.path).replace(/\\/g, '/'))}
							);` +
							(is.string(compiler.options.devtool) &&
							 compiler.options.devtool.includes("source-map")
							 ? "/** layer pack externals sourcemaps**/\n" +
								 "require('source-map-support').install();\n"
							 : "")
					}, ENTRY_ORDER.First))
			}
			
			// required for $super resolving
			compiler.options.resolve.cacheWithContext = true;
			
			// possibly useless
			compiler.options.resolveLoader         = compiler.options.resolveLoader || {};
			compiler.options.resolveLoader.modules = compiler.options.resolveLoader.modules || [];
			compiler.options.resolveLoader.modules.unshift(...opts.allModulePath);
			
			// detect resolvable ext
			if ( compiler.options.resolve.extensions ) {
				availableExts.push(...compiler.options.resolve.extensions);
			}
			else availableExts = ["", ".webpack.js", ".web.js", ".js"];
			availableExts = availableExts.filter(ext => ((ext !== '.')));
			availableExts.push(...availableExts.filter(ext => ext).map(ext => ('/index' + ext)));
			availableExts.unshift('');
			
			/**
			 * The main resolver / glob mngr
			 */
			function lPackResolve( data, cb, proxy ) {
				let requireOrigin   = data.context && data.context.issuer,
				    context         = requireOrigin && path.dirname(requireOrigin),// || data.path,
				    reqPath         = data.request,
				    isRelative,
				    relativeAbsPath = path.resolve(path.join(context || "", reqPath)),
				    tmpPath, suffix = "";
				//console.log('lPackResolve::lPackResolve:437: ', reqPath,data.lPackOriginRequest);
				// do not re resolve
				if ( data.lPackOriginRequest ) {
					return cb();
				}
				
				// sass may send windows paths
				reqPath = reqPath.replace(RE.winSlash, '/');
				
				// sass may send suffix with the uri
				if ( RE.sassSuffix.test(reqPath) ) {
					let tmp = reqPath.match(RE.getSassSuffix);
					suffix  = tmp[2];
					reqPath = tmp[1];
				}
				
				// keep original request
				data.lPackOriginRequest = reqPath;
				isRelative              = context
					&& RE.localPath.test(reqPath)
					&& !!(tmpPath = roots.find(r => relativeAbsPath.startsWith(r)));
				//console.log('lPackResolve::lPackResolve:417: ', reqPath, context, isRelative,
				//            !!context
				//	            ,!!RE.localPath.test(reqPath)
				//	            ,!!(tmpPath = roots.find(r => relativeAbsPath.startsWith(r)))
				//            )
				//;
				// if this is a relative require find & add the right root path
				if ( isRelative ) {
					//console.warn('lPackResolve::lPackResolve:417: !!!!!', reqPath);
					reqPath = (RootAlias + relativeAbsPath.substr(tmpPath.length))
						.replace(RE.winSlash, '/');
					//console.log('lPackResolve::lPackResolve:417: ', reqPath);
				}
				
				let isSuper = RE.isSuper.test(reqPath),
				    isGlob  = reqPath.indexOf('*') !== -1,
				    isRoot  = RootAliasRe.test(reqPath);
				
				// glob resolving...
				if ( isGlob ) {
					if ( RE.isSass.test(requireOrigin) )
						activeGlobs.scss[reqPath] = false;
					else
						activeGlobs.jsx[reqPath] = false;
					//if ( activeIgnoredFiles.indexOf(reqPath) === -1 )
					//	activeIgnoredFiles.push(reqPath);
					
					return (RE.isSass.test(requireOrigin)
					        ? utils.indexOfScss
					        : utils.indexOf)(
						vMod,
						compiler.inputFileSystem,
						roots,
						reqPath,
						contextDependencies,
						fileDependencies,
						RootAlias,
						RootAliasRe,
						useHotReload,
						function ( e, filePath, content ) {
							//console.warn("glob", filePath, data)
							let req = {
								...data,
								//internal:true,
								path    : filePath,
								resource: filePath
							};
							activeIgnoredFiles.push(filePath);
							cb(e, req, content);
						}
					)
				}
				
				if ( !isRoot && !isSuper ) { // let wp deal with it
					return cb()
				}
				
				// $super resolving..
				if ( isSuper ) {
					return utils.findParent(
						compiler.inputFileSystem,
						roots,
						requireOrigin,
						[''],
						fileDependencies,
						function ( e, filePath, file ) {
							if ( e && !filePath ) {
								console.error("Parent not found \n'%s'",
								              requireOrigin);
								return cb(null, {
									...data,
									path: false// ignored
								});
							}
							cb(null, {
								...data,
								path        : filePath,
								relativePath: undefined,
								//request     : filePath,
								resource: filePath,
								module  : false,
								file    : true
							});
						}
					);
				}
				
				// Inheritable root based resolving
				if ( isRoot ) {
					return utils.findParentPath(
						compiler.inputFileSystem,
						roots,
						reqPath.replace(RootAliasRe, ''),
						0,
						availableExts,
						fileDependencies,
						function ( e, filePath, file ) {
							if ( e ) {
								console.error("File not found \n'%s' (required in '%s')",
								              reqPath, requireOrigin);
								return cb()
							}
							let req = {
								...data,
								path        : filePath,
								relativePath: undefined,
								request     : filePath + suffix,
								resource    : filePath
							};
							cb(null, req);
						}
					);
				}
			}
			
			// sass resolver
			this._sassImporter = function ( url, requireOrigin, cb, next ) {
				let suffix = "";
				url        = url.replace(RE.winSlash, "/");
				if ( requireOrigin ) {
					let tmpPath = roots.find(r => path.resolve(path.dirname(requireOrigin) + '/' + url).startsWith(r));
					if ( tmpPath && RE.localPath.test(url) ) {
						url = (RootAlias + path.resolve(path.dirname(requireOrigin) + '/' + url)
						                       .substr(tmpPath.length))
							.replace(RE.winSlash, '/');
					}
					if ( tmpPath && !RootAliasRe.test(url) && url.includes("/") && /^[a-zA-Z_]/.test(url) ) {
						url = (RootAlias + path.resolve(path.dirname(requireOrigin) + '/' + url).substr(tmpPath.length))
							.replace(RE.winSlash, '/');
					}
				}
				if ( url.includes("?") ) {
					let tmp = url.split("?");
					url     = tmp.shift();
					suffix  = "?" + tmp.join("?");
				}
				if ( url.includes("#") ) {
					let tmp = url.split("#");
					url     = tmp.shift();
					suffix  = "#" + tmp.join("#");
				}
				//console.log('plugin::_sassImporter:598: ', url, requireOrigin);
				if ( RootAliasRe.test(url) || url[0] === '$' || url[0] === '.' ) {
					lPackResolve(
						{
							context: {
								issuer: requireOrigin
							},
							request: path.normalize(url)
						},
						( e, found, contents ) => {
							//console.log('plugin::_sassImporter:368: ',url, (found.resource || found.path));
							if ( found || contents ) {
								cb && cb(contents && { contents } || { file: (found.resource || found.path) + suffix });
							}
							else {
								next ?
								next(url + suffix, requireOrigin, cb)
								     :
								cb();
								
							}
							
						}
					)
				}
				else return next ? next(url, requireOrigin, cb) : cb();
			};
			
			// wp hook
			compiler.hooks.normalModuleFactory.tap(
				"layer-pack",
				function ( nmf ) {
					
					utils.addVirtualFile(
						vMod, compiler.inputFileSystem,
						path.normalize(roots[0] + '/.buildInfos.json.js'),
						`
module.exports=
            {
                project    : {
	                name       : ${JSON.stringify(projectPkg.name)},
	                description: ${JSON.stringify(projectPkg.description)},
	                author     : ${JSON.stringify(projectPkg.author)},
	                version    : ${JSON.stringify(projectPkg.version)}
                },
                buildDate  : ${startBuildTm},
                profile    : ${JSON.stringify(currentProfile)},
                ${
							/^(async-)?node$/.test(buildTarget)
							? `
                projectRoot: require("path").join(__non_webpack_require__.main.path,${JSON.stringify(path.normalize(path.relative(compiler.options.output.path, opts.projectRoot)).replace(/\\/g, '/'))}),
                vars       : ${JSON.stringify(opts.vars)},
                allCfg     : ${JSON.stringify(opts.allCfg)},
                allModId   : ${JSON.stringify(opts.allModId)}` : ""}
            };
						                `
					);
					
					utils.addVirtualFile(
						vMod, compiler.inputFileSystem,
						path.normalize(roots[0] + '/.___layerPackIndexUtils.js'),
						fs.readFileSync(path.join(__dirname, '../etc/utils/indexUtils.js'))
					);
					// deal with externals
					if ( excludeExternals )
						nmf.hooks.factorize.tapAsync(
							"layer-pack", function ( data, callback ) {
								let requireOrigin = data.contextInfo.issuer,
								    context       = data.context || path.dirname(requireOrigin),
								    request       = data.request,
								    mkExt         = isBuiltinModule(data.request),
								    isInRoot;
								
								//console.log('plugin::apply:82: ext', isNodeBuild);
								if ( request === 'source-map-support' )
									mkExt = true;
								else if ( data.request === "$super" || !requireOrigin )// entry points ?
								{
									//console.log(':::631: ', this, data);
									return callback(null, undefined);
								}
								
								if ( !mkExt ) {
									// is it external ? @todo
									mkExt = !(
										RootAliasRe.test(data.request) ||
										context &&
										/^\./.test(data.request)
										? (isInRoot = roots.find(r => path.resolve(context + '/' + data.request).startsWith(r)))
										: (isInRoot = roots.find(r =>
											                         path.resolve(data.request).startsWith(r))));
									
								}
								if ( mkExt &&
									(
										!externalRE
										|| externalRE.test(request)
									)
									&&
									!(!isInRoot && /^\./.test(data.request))
								) {
									if ( !isNodeBuild || !opts.vars.hardResolveExternals ) // keep external as-is for browsers builds
									{
										let mod = new ExternalModule(
											data.request,
											opts.vars.externalMode || "commonjs"
										);
										return callback(null, mod);
									}
									else // hard resolve for node if possible
										return compiler.resolverFactory.get(
											"normal",
											{
												mainFields: ["main", "module"],
												extensions: [".js"]
											}
										).doResolve(
											'resolve',
											{
												...data,
												path: context
											},
											"External resolve of " + request,
											( err, request ) => {
												let mod = new ExternalModule(err ||
												                             !request
												                             ? data.request
												                             :
												                             path.relative(compiler.options.output.path,
												                                           request.path).replace(/\\/g, '/'),
												                             opts.vars.externalMode || "commonjs");
												return callback(null, mod);
											});
								}
								else {
									return callback(null, undefined);
								}
							});
				}
			);
			
			let triggerGlobUpdates = ( compiler, changedFiles = [], removedFiles = [] ) => {
				let globsToUpdate = {};
				changedFiles.forEach(( filePath ) => {
					if ( contextDependencies[filePath] )
						contextDependencies[filePath] = contextDependencies[filePath]?.filter(
							( globReq ) => !(globsToUpdate[globReq] = true)
						)
				})
				removedFiles.forEach(( filePath ) => {
					if ( contextDependencies[filePath] )
						contextDependencies[filePath] = contextDependencies[filePath]?.filter(
							( globReq ) => !(globsToUpdate[globReq] = true)
						)
				})
				
				for ( let dir in contextDependencies )
					if ( contextDependencies.hasOwnProperty(dir) ) {
						contextDependencies[dir] = contextDependencies[dir].filter(
							( globReq ) => !(globsToUpdate[globReq])
						)
						if ( !contextDependencies[dir].length )
							delete contextDependencies[dir];
					}
				for ( let globReq in globsToUpdate )
					if ( globsToUpdate.hasOwnProperty(globReq) ) {
						if ( activeGlobs.jsx.hasOwnProperty(globReq) )
							activeGlobs.jsx[globReq] = true;
						if ( activeGlobs.scss.hasOwnProperty(globReq) )
							activeGlobs.scss[globReq] = true;
					}
				return globsToUpdate;
			}
			// mark updated globs
			compiler.hooks.watchRun.tap('WatchRun', ( compiler ) => {
				activeIgnoredFiles.push(roots[0] + '/.buildInfos.json.js');
				activeIgnoredFiles.push(roots[0] + '/.___layerPackIndexUtils.js');
				//console.log(currentProfile, ' WatchRun: ', compiler.watchFileSystem.watcher.watcherOptions.ignored);
				triggerGlobUpdates(compiler, compiler.modifiedFiles, compiler.removedFiles);
				//console.log(currentProfile, ' WatchRun: ', compiler.modifiedFiles, compiler.removedFiles);
				//cd ../../rocinante/rocinante.core/&&cp src/*.* node_modules/layer-pack/src
			});
			//  do update the globs indexes files on hot reload
			compiler.hooks.compilation.tap('layer-pack', ( compilation, params ) => {
				let toBeRebuilt = [], anySassChange;
				
				//console.log(currentProfile, ' compilation: ', activeGlobs);
				// force rebuild in wp5 without full recompile
				compilation.buildQueue &&
				compilation.buildQueue.hooks &&
				compilation.buildQueue.hooks.beforeAdd
				           .tapAsync('layer-pack',
				                     ( module, cb ) => {
					                     if ( toBeRebuilt.includes(module.resource) ) {
						                     //console.info("Index was Updated ", module.resource, module._forceBuild)
						                     toBeRebuilt.splice(toBeRebuilt.indexOf(module.resource), 1);
						                     module._forceBuild = true;
					                     }
					                     else if ( /\.scss/.test(module.resource) && anySassChange ) {
						                     module._forceBuild = true;
					                     }
					                     cb()
				                     }
				           );
				
				// the glob indexes files are not rebuilt
				// if they were changed they will be rebuilt by the beforeAdd hook
				for ( let reqPath in activeGlobs.jsx )
					if ( activeGlobs.jsx.hasOwnProperty(reqPath) && activeGlobs.jsx[reqPath] ) {
						activeGlobs.jsx[reqPath] = false;
						utils.indexOf(
							vMod,
							compiler.inputFileSystem,
							roots,
							reqPath,
							contextDependencies,
							fileDependencies,
							RootAlias,
							RootAliasRe,
							useHotReload,
							function ( e, filePath, content, changed ) {
								if ( changed ) {
									toBeRebuilt.push(filePath)
								}
							}
						)
					}
				//console.log(currentProfile, ': ', activeGlobs.scss);
				//
				for ( let reqPath in activeGlobs.scss )
					if ( activeGlobs.scss.hasOwnProperty(reqPath) && activeGlobs.scss[reqPath] ) {
						activeGlobs.scss[reqPath] = false;
						utils.indexOfScss(
							vMod,
							compiler.inputFileSystem,
							roots,
							reqPath,
							contextDependencies,
							fileDependencies,
							RootAlias,
							RootAliasRe,
							useHotReload,
							function ( e, filePath, content, changed ) {
								//console.log(':::877: ', filePath, changed);
								if ( changed ) {
									//console.log(':::877: ', filePath);
									anySassChange = true;
									toBeRebuilt.push(filePath)
								}
							}
						)
					}
			})
			// should deal with hot reload watched files & dirs
			compiler.hooks.afterCompile
			        .tap('layer-pack', ( compilation ) => {
				        let globDirs = Object.keys(contextDependencies);
				        activeIgnoredFiles.forEach(lpFile => compilation.fileDependencies.delete(lpFile));
				        globDirs.forEach(dir => compilation.contextDependencies.add(dir));
				        fileDependencies.length = 0;
				        activeIgnoredFiles.length = 0;
			        })
		}
	}
}
		
