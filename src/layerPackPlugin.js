/*
 * Copyright 2023 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file layerPackPlugin.js
 *
 * Core webpack plugin factory for layer-pack. Wires up all build-time resolution:
 *
 *  - `App/...` namespace aliases resolved across all inherited layer roots (head wins)
 *  - `$super` imports — same relative path resolved one layer down the chain
 *  - Glob imports — `App/foo/(**\/*.jsx)` generates virtual JS/SCSS index files on the fly
 *  - Cross-layer `node_modules` resolution (deps-of-deps across the inheritance chain)
 *  - Webpack loader resolution across layer `devDependencies`
 *  - Externals handling for Node builds (`vars.externals`, `vars.hardResolveExternals`)
 *  - HMR watch integration: rebuilds glob virtual files when their matched directories change
 */

const path                 = require('path'),
      is                   = require('is'),
      fs                   = require('fs'),
      resolve              = require('resolve'),
      utils                = require("./utils"),
      InjectPlugin         = require("webpack-inject-plugin").default,
      ENTRY_ORDER          = require("webpack-inject-plugin").ENTRY_ORDER,
      isBuiltinModule      = require('is-builtin-module'),
      VirtualModulesPlugin = require('webpack-virtual-modules');

/** Shared regular expressions used throughout the plugin. */
const RE = {
	/** Normalise Windows backslashes to forward slashes. */
	winSlash     : /\\/g,
	/** Detect relative import paths (`./` or `../`). */
	localPath    : /^\./,
	/** Detect a `?` or `#` query/hash suffix in a SCSS import URL. */
	sassSuffix   : /[\?\#][^\/\\]+$/,
	/** Capture base path and suffix separately from a SCSS import URL. */
	getSassSuffix: /^(.*)([\?\#][^\/\\]+$)/,
	/** Match the bare `$super` keyword (not `$super/some/path`). */
	isSuper      : /^\$super$/,
	/** Identify SCSS/CSS source files. */
	isSass       : /\.s?css$/,
	/** Extract the npm package name (including scoped `@org/pkg`) from an import string. */
	packageName  : /^(\@[^\\\/]+[\\\/][^\\\/]+|[^\\\/]+)(.*)$/i
};

/**
 * Create the layer-pack webpack plugin for a given profile configuration.
 *
 * @param {object} cfg    - Optional raw .layers.json override (unused internally; forwarded)
 * @param {object} opts   - Resolved profile config from `utils.getConfigByProfiles()`:
 *                          allRoots, allModulePath, allModuleRoots, allWebpackCfg,
 *                          allPackageCfg, vars, projectRoot, etc.
 * @returns {{ apply, sassImporter, _sassImporter }}
 */
module.exports = function ( cfg, opts ) {
	let plugin;

	// Resolve webpack and enhanced-resolve from the directory that owns the active webpack
	// config. This ensures we use the correct webpack version when configs live in parent
	// layer packages rather than the head project.
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
	    /** When `vars.externals` is a regex string, compile it once for reuse. */
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
		 * Webpack plugin entry point. Called by webpack with the compiler instance.
		 * Registers all resolver hooks, virtual-module infrastructure, and HMR watchers.
		 *
		 * @param {import('webpack').Compiler} compiler
		 */
		apply: function ( compiler ) {
			let cache               = {},
			    plugin              = this,
			    RootAlias           = opts.vars.rootAlias || "App",
			    /** Pre-compiled regex to quickly test whether a path starts with the root alias. */
			    RootAliasRe         = new RegExp("^" + RootAlias, ''),
			    roots               = opts.allRoots,
			    /** Module paths sorted longest-first so more specific paths are matched first. */
			    modulesPathByLength = [...opts.allModulePath]
				    .sort(( a, b ) => b.length - a.length),
			    /**
			     * Maps each watched directory to the glob request UIDs that depend on it.
			     * Used to know which virtual glob files must be regenerated on file-system changes.
			     * Shape: { [dirPath]: string[] }
			     */
			    contextDependencies = {},
			    /** Paths of individual files that were stat-checked during resolution (for watch). */
			    fileDependencies    = [],
			    /** All extensions webpack will attempt, including `/index` variants. */
			    availableExts       = [],
			    /**
			     * Tracks active glob requests, keyed by the raw glob import string.
			     * Value is `false` (up-to-date) or `true` (needs regeneration).
			     * Shape: { scss: { [globReq]: bool }, jsx: { [globReq]: bool } }
			     */
			    activeGlobs         = { scss: {}, jsx: {} },
			    /** Virtual file paths that webpack should NOT add to its own watch list. */
			    activeIgnoredFiles  = [],
			    buildTarget         = compiler.options.target || "web",
			    outputTarget        = compiler.options.output?.libraryTarget
				    || compiler.options.output?.library?.type
				    || "commonjs",
			    useHotReload        = !!compiler.options.devServer,
			    isNodeBuild         = /^(async-)?node$/.test(buildTarget),
			    startBuildTm        = Date.now();
			compiler.options.watchOptions = compiler.options.watchOptions || {};

			// Register the virtual-modules plugin so we can write files to webpack's
			// in-memory file system at build time (glob indexes, .buildInfos.json, etc.)
			compiler.options.plugins.push(vMod);

			// Expose build-time constants to application code via webpack.DefinePlugin.
			// __LPACK_PROFILE__ lets runtime code know which profile was used to build.
			compiler.options.plugins.push(
				new webpack.DefinePlugin(
					{
						'__LPACK_PROFILE__'  : currentProfile,
						'__WP_BUILD_TARGET__': buildTarget,
						...constDef
					}));
			
			// Disable enhanced-resolve's internal cache: layer-pack manages its own
			// resolution cache (resolveCache below) to correctly handle $super context.
			compiler.options.resolve         = compiler.options.resolve || {};
			compiler.options.resolve.cache   = false;
			compiler.options.resolve.plugins = compiler.options.resolve.plugins || [];

			// --- Resolver 1: intra-App / $super / glob imports ---
			// Hooks into `parsed-resolve` (after the request is parsed but before normal
			// module lookup) and redirects `App/...`, `$super`, and glob patterns to
			// layer-pack's own resolution logic (`lPackResolve`).
			compiler.options.resolve.plugins.push(
				{
					target: "after-described-resolve",
					source: "parsed-resolve",
					apply( resolver ) {
						const target = resolver.ensureHook(this.target);
						resolver
							.getHook(this.source)
							.tapAsync("layer-pack", ( request, resolveContext, callback ) => {
								lPackResolve(
									request,
									( err, req, data ) => {
										callback(err, req)
									})
							});
					}
				}
			);

			/**
			 * Resolution result cache. Key: `"<requiring-dir>!|!<request>"`.
			 * Stores `{ err, res }` after the first resolution so identical requests
			 * are never walked twice within the same build.
			 */
			let resolveCache    = {},
			    /**
			     * In-flight queue for simultaneous identical requests.
			     * While the first resolution is in progress, subsequent callers for the
			     * same key are pushed here and flushed when the first result arrives.
			     */
			    resolvingQueues = {};

			// --- Resolver 2: cross-layer node_modules ---
			// The fundamental challenge: a module required from inside a layer may have
			// its dependencies installed in *any* layer's node_modules directory — not
			// just the one closest to the requiring file. This resolver builds a
			// priority-ordered list of candidate node_modules directories and walks them
			// with forEachBail (first directory that contains the package wins).
			//
			// Priority order for files inside a layer root (`isInternal === true`):
			//   1. Custom lib dirs (libsPath) — local overrides take precedence
			//   2. Layer node_modules where the package is explicitly listed in `dependencies`
			//   3. Layer node_modules where the package is NOT explicitly listed (shared deps)
			//   4. Parent directories of the head layer root (OS-level resolution fallback)
			//
			// For files outside layer roots (third-party deps requiring their own sub-deps):
			//   Use standard hierarchical node_modules but capped at the owning layer's
			//   node_modules root, then fall through to the layer chain.
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
									    key                             = request.path + "!|!" + request.request,
									    requestedMod                    = request.request.match(/^(\@[\w\d-_]+[\\\/][\w\d-_]+|[\w\d-_]+)?/i)[0];
									
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
										if ( rootModPath ) {
											addrs = addrs.filter(
												addr => addr.startsWith(rootModPath)
											);
											addrs.pop();//rm origin mods root
										}
										else // so this should be a linked / external mod
										{
											// if the requested mod is a not direct deps this should be peerdeps which are in the project deps
											if ( !request.descriptionFileData?.dependencies?.[requestedMod] )
												addrs = [];
										}
										
										
										addrs.push(
											...opts.allModuleRoots.filter(// prefer layer where its defined in deps
											                              ( p, i ) => (
												                              opts.allPackageCfg[i].dependencies
												                              && opts.allPackageCfg[i].dependencies[packageName]
											                              )
											).reduce((list,p) => {
												list.push(
													path.join(p, ".layer_modules","node_modules"),
													path.join(p, "node_modules")
												);
												return list;
											},[]),
											...opts.allModuleRoots.filter(// if not defined try shared deps ( not formally defined in deps )
											                              ( p, i ) => !(
												                              opts.allPackageCfg[i].dependencies
												                              && opts.allPackageCfg[i].dependencies[packageName]
											                              )
											).reduce((list,p) => {
												list.push(
													path.join(p, ".layer_modules","node_modules"),
													path.join(p, "node_modules")
												);
												return list;
											},[]),
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
			// --- Resolver 3: webpack loaders ---
			// Webpack loaders are resolved separately from regular modules. This resolver
			// mirrors Resolver 2 but targets `devDependencies` (loaders are dev-only) and
			// always includes the webpack config's own node_modules as the final fallback.
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
			
			// For Node builds with externals enabled, inject the loadModulePaths bootstrap
			// into the bundle entry point. At runtime this patches Module._nodeModulePaths
			// so that `require()` calls from the bundle can find dependencies spread across
			// multiple layer node_modules directories.
			if ( isNodeBuild && excludeExternals ) {
				compiler.options.plugins.push(
					new InjectPlugin(function () {
						return "" +
							"/** layer pack externals modules loader **/\n" +
							fs.readFileSync(path.join(__dirname,
							                          //!outputTarget.includes("module") && /^(async-)?node$/.test(buildTarget)
							                          //?
							                          '../etc/node/loadModulePaths_inject.js'
							                          //: '../etc/node/loadModulePaths_esm_inject.js'
							)) +
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
							);`
						//+
						//(is.string(compiler.options.devtool) &&
						// compiler.options.devtool.includes("source-map")
						// ? "/** layer pack externals sourcemaps**/\n" +
						//	 "require('source-map-support').install();\n"
						// : "")
					}, ENTRY_ORDER.First))
			}
			
			// $super resolution is context-sensitive: the same `$super` import in two
			// different files must resolve to two different parent-layer files. Webpack's
			// default resolver cache is keyed only on the request string; enabling
			// cacheWithContext adds the issuer path to the cache key.
			compiler.options.resolve.cacheWithContext = true;

			// Make all layer node_modules directories available to webpack-loader resolution.
			compiler.options.resolveLoader         = compiler.options.resolveLoader || {};
			compiler.options.resolveLoader.modules = compiler.options.resolveLoader.modules || [];
			compiler.options.resolveLoader.modules.unshift(...opts.allModulePath);

			// Build the full list of extensions webpack will try when an import has no
			// explicit extension. We also add `/index<ext>` variants so that directory
			// imports resolve correctly across layers.
			if ( compiler.options.resolve.extensions ) {
				availableExts.push(...compiler.options.resolve.extensions);
			}
			else availableExts = ["", ".webpack.js", ".web.js", ".js"];
			availableExts = availableExts.filter(ext => ((ext !== '.')));
			availableExts.push(...availableExts.filter(ext => ext).map(ext => ('/index' + ext)));
			availableExts.unshift('');
			
			/**
			 * Central resolver called by the `parsed-resolve` hook for every import.
			 * Handles three distinct cases:
			 *
			 *  1. **Glob** — import string contains `*`: delegates to `utils.indexOf` or
			 *     `utils.indexOfScss` to generate/update a virtual index file.
			 *  2. **$super** — exact string `$super`: finds the matching file one layer
			 *     below the current issuer in the inheritance chain.
			 *  3. **Root alias** — starts with `App/` (or configured rootAlias): resolves
			 *     against all layer roots in order (head project wins).
			 *
			 * Relative imports whose resolved absolute path falls inside a layer root are
			 * transparently rewritten to root-alias form so they benefit from inheritance.
			 *
			 * @param {object}   data  - enhanced-resolve request object
			 * @param {Function} cb    - callback(err, resolvedRequest)
			 * @param {Function} proxy - unused; kept for API symmetry with sassImporter
			 */
			function lPackResolve( data, cb, proxy ) {
				let requireOrigin   = data.context && data.context.issuer,
				    context         = requireOrigin && path.dirname(requireOrigin),
				    reqPath         = data.request,
				    isRelative,
				    relativeAbsPath = path.resolve(path.join(context || "", reqPath)),
				    tmpPath, suffix = "";

				// Guard: this request was already rewritten by lPackResolve — let webpack
				// continue with the resolved path without entering an infinite loop.
				if ( data.lPackOriginRequest ) {
					return cb();
				}

				// Sass sends Windows-style backslash paths on Windows; normalise early.
				reqPath = reqPath.replace(RE.winSlash, '/');

				// Sass appends `?` or `#` suffixes (e.g. `?#iefix`); strip them before
				// resolving, then re-attach after so the loader receives them intact.
				if ( RE.sassSuffix.test(reqPath) ) {
					let tmp = reqPath.match(RE.getSassSuffix);
					suffix  = tmp[2];
					reqPath = tmp[1];
				}

				// Stamp the request so recursive resolutions are skipped above.
				data.lPackOriginRequest = reqPath;

				// Detect relative imports whose resolved path lives inside a layer root.
				// Example: `import './Button'` from `App/components/Card.jsx` resolves to
				// `<root>/App/components/Button` — rewrite to `App/components/Button` so
				// the layer inheritance lookup runs correctly.
				isRelative = context
					&& RE.localPath.test(reqPath)
					&& !!(tmpPath = roots.find(r => relativeAbsPath.startsWith(r)));

				if ( isRelative ) {
					reqPath = (RootAlias + relativeAbsPath.substr(tmpPath.length))
						.replace(RE.winSlash, '/');
				}

				let isSuper = RE.isSuper.test(reqPath),
				    isGlob  = reqPath.indexOf('*') !== -1,
				    isRoot  = RootAliasRe.test(reqPath);
				
				// glob resolving...
				if ( isGlob ) {
					reqPath = reqPath + (data.query || "");
					if ( RE.isSass.test(requireOrigin) )
						activeGlobs.scss[reqPath] = false;
					else
						activeGlobs.jsx[reqPath] = false;
					//if ( activeIgnoredFiles.indexOf(reqPath) === -1 )
					//	activeIgnoredFiles.push(reqPath);
					//console.log('lPackResolve::lPackResolve:479: ', data);
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
			
			// --- Sass importer ---
			// The node-sass / dart-sass importer API is different from webpack's resolver API.
			// This adapter translates SCSS `@import` calls into lPackResolve requests so that
			// glob patterns and `$super` work inside stylesheets.
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
			
			// --- normalModuleFactory hook ---
			// Called once per compilation before modules are resolved. We use it to:
			//   1. Write the `.buildInfos.json` virtual file with project/build metadata
			//   2. Write the `walknSetExport` runtime helper used by glob virtual files
			//   3. Register the externals handler when `vars.externals` is enabled
			compiler.hooks.normalModuleFactory.tap(
				"layer-pack",
				function ( nmf ) {

					// Inject build metadata as a virtual JSON module importable from App code.
					// In node builds, includes runtime path so projectRoot stays correct after
					// the bundle is moved to its output directory.
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
                projectRoot: require("path").join(__dirname,${JSON.stringify(path.normalize(path.relative(compiler.options.output.path, opts.projectRoot)).replace(/\\/g, '/'))}),
                vars       : ${JSON.stringify(opts.vars)},
                allCfg     : ${JSON.stringify(opts.allCfg)},
                allModId   : ${JSON.stringify(opts.allModId)}` : ""}
            };
						                `
					);
					
					// Inject the `walknSetExport` helper into the virtual file system.
					// Glob index files reference this helper to build nested export objects
					// (e.g. `admin/Dashboard` becomes `_exports.admin.Dashboard`).
					utils.addVirtualFile(
						vMod, compiler.inputFileSystem,
						path.normalize(roots[0] + '/.___layerPackIndexUtils.js'),
						fs.readFileSync(path.join(__dirname, '../etc/utils/indexUtils.js'))
					);

					// Externals handler: when `vars.externals` is truthy, any import that
					// does NOT resolve to a file inside the layer roots is marked external.
					// For browser builds the import is kept as-is; for node builds with
					// `vars.hardResolveExternals`, the import is pre-resolved to a relative
					// path so the bundle works even when moved to a different directory.
					if ( excludeExternals )
						nmf.hooks.factorize.tapAsync(
							"layer-pack", function ( data, callback ) {
								let requireOrigin = data.contextInfo.issuer,
								    context       = data.context || path.dirname(requireOrigin),
								    request       = data.request,
								    mkExt         = isBuiltinModule(data.request),
								    isInRoot;
								
								//console.log('plugin::apply:82: ext', isNodeBuild);
								//if ( request === 'source-map-support' )
								//	mkExt = true;
								//else
								if ( data.request === "$super" || !requireOrigin )// entry points ?
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
										//console.log(':::706: ', data.request, data.dependencyType);
										let mod = new ExternalModule(
											data.request,
											outputTarget || "commonjs"
										);
										return callback(null, mod);
									}
									else // hard resolve for node if possible
									{
										//console.log(':::727: ', data.request);
										let resolver = compiler.resolverFactory.get(
											"normal",
											{
												mainFields: ["main", "module"],
												extensions: compiler.options.resolve?.extensions || [".js"]
											}
										);
										return resolver.resolve(
											data.contextInfo,
											data.context,
											data.request,
											{},
											//"External resolve of " + request,
											( err, request, result ) => {
												//console.log(':::729: ', request, result);
												let mod = new ExternalModule(err ||
												                             !request
												                             ? data.request
												                             :
												                             path.relative(compiler.options.output.path,
												                                           request).replace(/\\/g, '/'),
												                             outputTarget || "commonjs");
												return callback(null, mod);
											});
									}
								}
								else {
									return callback(null, undefined);
								}
							});
				}
			);
			
			/**
			 * Determine which glob virtual files need to be regenerated based on which
			 * files were changed or removed since the last build.
			 *
			 * Each directory that participates in a glob match is tracked in
			 * `contextDependencies`. When a file in that directory changes, every glob
			 * that covers it is marked dirty (`activeGlobs[type][req] = true`) so the
			 * next `compilation` hook will regenerate only the affected virtual files.
			 *
			 * @param {import('webpack').Compiler} compiler
			 * @param {Set<string>} changedFiles
			 * @param {Set<string>} removedFiles
			 * @returns {{ [globReq: string]: true }} - set of glob requests to regenerate
			 */
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

				// Remove empty directory entries to keep the map tidy.
				for ( let dir in contextDependencies )
					if ( contextDependencies.hasOwnProperty(dir) ) {
						contextDependencies[dir] = contextDependencies[dir].filter(
							( globReq ) => !(globsToUpdate[globReq])
						)
						if ( !contextDependencies[dir].length )
							delete contextDependencies[dir];
					}
				// Flip the dirty flag on affected glob slots.
				for ( let globReq in globsToUpdate )
					if ( globsToUpdate.hasOwnProperty(globReq) ) {
						if ( activeGlobs.jsx.hasOwnProperty(globReq) )
							activeGlobs.jsx[globReq] = true;
						if ( activeGlobs.scss.hasOwnProperty(globReq) )
							activeGlobs.scss[globReq] = true;
					}
				return globsToUpdate;
			}

			// On each watch run, mark virtual files we own as ignored so webpack doesn't
			// add them to its own watch list, then compute which glob indexes are stale.
			compiler.hooks.watchRun.tap('WatchRun', ( compiler ) => {
				activeIgnoredFiles.push(roots[0] + '/.buildInfos.json.js');
				activeIgnoredFiles.push(roots[0] + '/.___layerPackIndexUtils.js');
				//console.log(currentProfile, ' WatchRun: ', compiler.watchFileSystem.watcher.watcherOptions.ignored);
				triggerGlobUpdates(compiler, compiler.modifiedFiles, compiler.removedFiles);
				//console.log(currentProfile, ' WatchRun: ', compiler.modifiedFiles, compiler.removedFiles);
				//cd ../../rocinante/rocinante.core/&&cp src/*.* node_modules/layer-pack/src
			});
			// On each compilation, regenerate any stale glob virtual files and force-rebuild
			// the modules that import them. The `beforeAdd` hook allows us to set
			// `_forceBuild = true` on a specific module without triggering a full rebuild.
			compiler.hooks.compilation.tap('layer-pack', ( compilation, params ) => {
				let toBeRebuilt = [], anySassChange;

				// Intercept the module build queue: if a module's resource path is in our
				// toBeRebuilt list, force webpack to reprocess it even if it hasn't changed
				// on disk (the virtual file contents changed in memory).
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
			// After compilation: register glob root directories as webpack context
			// dependencies so the watcher triggers a rebuild when files are added or
			// removed. Also remove layer-pack's own virtual files from webpack's file
			// dependency list so changes to them don't cause spurious rebuilds.
			compiler.hooks.afterCompile
			        .tap('layer-pack', ( compilation ) => {
				        let globDirs = Object.keys(contextDependencies);
				        activeIgnoredFiles.forEach(lpFile => compilation.fileDependencies.delete(lpFile));
				        globDirs.forEach(dir => compilation.contextDependencies.add(dir));
				        // Clear per-compilation tracking arrays for the next build cycle.
				        fileDependencies.length   = 0;
				        activeIgnoredFiles.length = 0;
			        })
		}
	}
}
		
