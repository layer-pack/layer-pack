/*
 * Copyright 2023 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const path              = require("path"),
      fs                = require('fs'),
      is                = require('is'),
      querystring       = require('node:querystring'),
      mustache          = require('mustache'),
      objProto          = ({}).__proto__,
      stripJsonComments = require('./utils.json'),
      glob              = require('fast-glob'),
      { jsVarTest }     = require('./utils.values.js'),
      glob2Js           = {
	      default  : require('./glob2Js/default.js'),
	      lazyReact: require('./glob2Js/LazyReact'),
	      SuspenseReact: require('./glob2Js/SuspenseReact'),
	      ReactLoadable: require('./glob2Js/ReactLoadable')
      };


function checkIfDir( fs, file ) {
	try {
		return fs.statSync(file).isDirectory()
	} catch ( err ) {
		return false
	}
}

function realpathSync( p ) {
	try {
		return fs.realpathSync(path.normalize(p))
	} catch ( e ) {
		return path.normalize(p);
	}
}

function getlPackConfigFrom( dir ) {
	let cfg, pkgCfg;
	try {
		try {
			cfg = require(path.normalize(dir + "/.layers"));
			cfg = { layerPack: cfg };
		} catch ( e ) {
			cfg = fs.existsSync(path.normalize(dir + "/.layers.json"))
				&& { layerPack: JSON.parse(stripJsonComments(fs.readFileSync(path.normalize(dir + "/.layers.json")).toString())) };
		}
		
		pkgCfg =
			fs.existsSync(path.normalize(dir + "/package.json"))
			&& JSON.parse(fs.readFileSync(path.normalize(dir + "/package.json")));
		
		if ( !pkgCfg )
			pkgCfg = cfg;
		else if ( cfg )
			pkgCfg = { ...pkgCfg, ...cfg };
		
	} catch ( e ) {
		console.warn("Fail parsing lPack config in " + dir, "\n" + e + "\n", e.stack);
		process.exit(1000);
	}
	return pkgCfg;
}

function jsonTplApply( value, data ) {
	if ( is.string(value) ) {
		return mustache.render(value, data, undefined, ['<%', '%>'])
	}
	else if ( value && value.__proto__ === objProto ) {
		let output = {};
		for ( let key in value )
			if ( value.hasOwnProperty(key) ) {
				output[key] = jsonTplApply(value[key], data);
			}
		return output;
	}
	return value;
}

const utils = {
	/**
	 * Return all configs for the available profiles
	 *
	 * @param projectRoot {string} @optional directory where to start searching lPack cfg
	 * @param customConfig {object} @optional lPack config in json
	 */
	getAllConfigs( projectRoot = process.env.__LPACK_HEAD__ || process.cwd(), customConfig ) {
		let pkgConfig =
			    customConfig && { layerPack: customConfig }
			    ||
			    getlPackConfigFrom(projectRoot),
		    allCfg    = {};
		//console.log('utils::getAllConfigs:90: ', projectRoot);
		if ( !pkgConfig || !pkgConfig.layerPack )
			throw new Error("Can't find any lPack config ! ( searched in " + projectRoot + "/.layers.json" + " )")
		
		Object.keys(pkgConfig.layerPack)
		      .forEach(
			      _pId => {
				      let pId      = _pId;
				      allCfg[_pId] = true;
				      while ( is.string(pkgConfig.layerPack[pId]) ) {// profile alias
					      pId = pkgConfig.layerPack[pId];
				      }
				      allCfg[_pId] = this.getConfigByProfiles(projectRoot, pkgConfig.layerPack[pId], _pId, pkgConfig);
			      }
		      )
		return allCfg;
	},
	/**
	 * Recurse over the inherited package to map all the value for a specified profile id
	 * todo: rewrite
	 * @param projectRoot
	 * @param profileConfig
	 * @param profileId
	 * @returns {{projectRoot: *, allModId: Array, allModulePath: Array, allRoots: *,
	 *     localAlias, allWebpackCfg: Array, allExtPath: Array, allCfg: Array, vars,
	 *     allModuleRoots: Array}}
	 */
	getConfigByProfiles( projectRoot, profileConfig, profileId, packageConfig ) {
		let localAlias     = {},
		    allModulePath  = [],
		    allModId       = [],
		    allWebpackCfg  = [],
		    allWebpackRoot = [],
		    allLayerRoot   = [projectRoot],
		    allModuleRoots = [],
		    allCfg         = [],
		    allPackageCfg  = [],
		    allTemplates   = {},
		    allScripts     = {},
		    vars           = {},
		    rootDir        = profileConfig.rootFolder || './App',
		    /**
		     * Find & return all  inherited pkg paths
		     * @type {Array}
		     */
		    allExtPath     = (() => {
			    let layerPathList        = [],
			        dedupedLayerPathList = [],
			        layerIdList          = [],
			        seen                 = {};
			    
			    profileConfig.extend && profileConfig.extend.forEach(function walk( layerId, i, x, mRoot, cProfile, libsPath ) {
				    
				    if ( !mRoot && profileConfig.libsPath ) {
					    libsPath = profileConfig.libsPath
				    }
				    
				    mRoot    = mRoot || projectRoot;
				    cProfile = cProfile || profileConfig.basedOn || profileId;
				    
				    if ( libsPath && !Array.isArray(libsPath) )
					    libsPath = [libsPath]
				    
				    if ( !libsPath )
					    libsPath = [];
				    
				    libsPath = libsPath.map(
					    p => realpathSync(
						    path.isAbsolute(p)
						    ? p
						    : path.join(mRoot, p)
					    )
				    )
				    
				    // find the inheritable package path & cfg
				    let where;
				    for ( let p = 0; libsPath.length > p; p++ ) {
					    where = path.join(libsPath[p], layerId);
					    if ( fs.existsSync(where) )
						    break;
					    where = "";
				    }
				    if ( !where ) {
					    where = path.join(mRoot, "node_modules", layerId);
					    if ( !fs.existsSync(where) ) {
						    // if the package is not here it may sibling this one...
						    where = path.join(mRoot, "..", layerId);
						    if ( !fs.existsSync(where) ) {
							    throw new Error("layer-pack > Can't found :" + layerId + " defined in " + mRoot);
						    }
					    }
				    }
				    let
					    cfg         = getlPackConfigFrom(where),
					    realProfile = cProfile;
				    
				    if ( !cfg ) {
					    throw new Error("layer-pack : Can't found config of " + layerId + " defined in " + mRoot);
				    }
				    
				    layerPathList.push(path.resolve(where));
				    layerIdList.push(layerId);
				    
				    while ( cfg && cfg.layerPack && is.string(cfg.layerPack[realProfile]) ) {// profile alias
					    realProfile = cfg.layerPack[realProfile];
				    }
				    if ( cfg && cfg.layerPack && !cfg.layerPack[realProfile] ) {
					    realProfile = "default";
				    }
				    
				    if ( cfg && cfg.layerPack && cfg.layerPack[realProfile] ) {
					    
					    if ( cfg.layerPack[realProfile].extend )
						    cfg.layerPack[realProfile]
							    .extend
							    .forEach(
								    ( mid, y ) => walk(
									    mid, y, null,
									    where,
									    cfg.layerPack[realProfile].basedOn || realProfile,
									    cfg.layerPack[realProfile].libsPath
									    ? [
											    ...libsPath,
											    ...(
												    Array.isArray(cfg.layerPack[realProfile].libsPath)
												    ? cfg.layerPack[realProfile].libsPath
												    : [cfg.layerPack[realProfile].libsPath]
											    )
										    ]
									    : libsPath
								    )
							    )
				    }
				    else {
					    if ( !cfg )
						    throw new Error("layer-pack : Can't inherit an not installed module :\nNot found :" + layerId + " defined in " + mRoot);
					    if ( !cfg.layerPack )
						    throw new Error("layer-pack : Can't inherit a module with no layerPack in the package.json/.layers.json :\nAt :" + layerId + " defined in " + mRoot);
					    if ( !cfg.layerPack[realProfile] )
						    throw new Error("layer-pack : Can't inherit a module without the requested profile\nAt :" + layerId + " defined in " + mRoot + "\nRequested profile :" + cProfile);
				    }
				    
			    })
			    
			    /**
			     * dedupe inherited ( last is first )
			     */
			    for ( let i = 0; i < layerIdList.length; i++ ) {
				    if ( layerIdList.lastIndexOf(layerIdList[i]) == i ) {
					    allModId.push(layerIdList[i]);
					    dedupedLayerPathList.push(layerPathList[i]);
				    }
			    }
			    
			    return dedupedLayerPathList;
		    })(),
		    // deduce all the roots & others values
		    allRoots       = (function () {
			    let roots            = [projectRoot + '/' + rootDir],
			        libPath          = [],
			        layerLibsPathDef = Array.isArray(profileConfig.libsPath)
			                           ? profileConfig.libsPath
			                           : profileConfig.libsPath && [profileConfig.libsPath] || [];
			    
			    layerLibsPathDef
				    .forEach(
					    p => {
						    p = realpathSync(
							    path.isAbsolute(p)
							    ? p
							    : path.join(projectRoot, p)
						    );
						    fs.existsSync(p)
						    && libPath.push(p);
					    }
				    )
			    if ( !fs.existsSync(projectRoot + '/.layer_modules') ) {
				    
				    allModulePath.push(path.normalize(projectRoot + '/node_modules'));
			    }
			    else allModulePath.push(path.normalize(projectRoot + '/.layer_modules/node_modules'));
			    
			    allModuleRoots.push(projectRoot);
			    
			    if ( profileConfig.config ) {
				    allWebpackCfg.push(path.resolve(path.normalize(projectRoot + '/' + profileConfig.config)))
				    allWebpackRoot.push(path.resolve(path.normalize(projectRoot)))
			    }
			    
			    if ( profileConfig.templates )
				    Object.keys(profileConfig.templates)
				          .forEach(
					          ( k ) => (allTemplates[k] = allTemplates[k] || path.resolve(path.normalize(projectRoot + '/' + profileConfig.templates[k])))
				          );
			    
			    if ( profileConfig.scripts )
				    Object.keys(profileConfig.scripts)
				          .forEach(
					          ( k ) => (allScripts[k] = allScripts[k] || path.resolve(path.normalize(projectRoot + '/' + profileConfig.scripts[k])))
				          );
			    
			    allExtPath.forEach(
				    function ( where, i, arr, cProfile ) {
					    cProfile        = cProfile || profileConfig.basedOn || profileId;
					    let cfg         = getlPackConfigFrom(where),
					        profile,
					        modPath,
					        realProfile = cProfile;
					    
					    if ( !fs.existsSync(where + '/.layer_modules') ) {// setup in .layer_modules avoid npm to rm deps on install other packages...
						    modPath = path.normalize(where + "/node_modules");
					    }
					    else modPath = path.normalize(where + "/.layer_modules/node_modules");
					    
					    allModuleRoots.push(where);
					    
					    while ( cfg && cfg.layerPack && is.string(cfg.layerPack[realProfile]) ) {// profile alias
						    realProfile = cfg.layerPack[realProfile];
					    }
					    if ( cfg && cfg.layerPack && !cfg.layerPack[realProfile] ) {
						    realProfile = "default";
					    }
					    
					    
					    profile = cfg.layerPack[realProfile];
					    
					    if ( profile.localAlias )
						    localAlias = {
							    ...localAlias,
							    ...Object
								    .keys(profile.localAlias)
								    .reduce(
									    ( aliases, alias ) => (aliases[alias] = path.join(where, cfg.aliases[alias]), aliases),
									    {}
								    )
						    };
					    
					    // add the vars
					    if ( profile.vars )
						    vars = {
							    ...jsonTplApply(profile.vars, {
								    packagePath: where,
								    projectPath: projectRoot,
								    packageConfig
							    }),
							    ...vars
						    };
					    
					    allCfg.push(profile);
					    allPackageCfg.push(cfg);
					    allLayerRoot.push(where);
					    
					    if ( profile.config ) {
						    allWebpackCfg.push(path.resolve(path.normalize(where + '/' + profile.config)));
						    allWebpackRoot.push(path.resolve(path.normalize(where)));
					    }
					    
					    roots.push(fs.realpathSync(path.normalize(where + "/" + (profile.rootFolder || 'App'))));
					    
					    if ( profile.scripts )
						    Object.keys(profile.scripts)
						          .reduce(
							          ( h, k ) => (h[k] = h[k] || path.resolve(path.normalize(where + '/' + profile.scripts[k])), h),
							          allScripts
						          );
					    //
					    let layerLibsPathDef = Array.isArray(profile.libsPath)
					                           ? profile.libsPath
					                           : profile.libsPath && [profile.libsPath] || [];
					    
					    layerLibsPathDef
						    .forEach(
							    p => {
								    p = realpathSync(
									    path.isAbsolute(p)
									    ? p
									    : path.join(where, p)
								    );
								    fs.existsSync(p)
								    && libPath.push(p);
							    }
						    )
					    checkIfDir(fs, modPath)
					    && allModulePath.push(fs.realpathSync(modPath));
				    }
			    );
			    //allModulePath.push("node_modules");
			    allModulePath.unshift(...libPath);
			    return roots.map(path.normalize.bind(path));
		    })();
		
		if ( profileConfig && profileConfig.aliases )
			localAlias = {
				...localAlias,
				...profileConfig.aliases
			};
		
		vars = {
			rootAlias: 'App',
			...vars
		};
		
		if ( profileConfig && profileConfig.vars )
			vars = {
				rootAlias: 'App',
				...vars,
				...jsonTplApply(profileConfig.vars, {
					packagePath: projectRoot,
					projectPath: projectRoot,
					packageConfig
				}),
			};
		allCfg.unshift(profileConfig);
		allPackageCfg.unshift(packageConfig);
		return {
			allWebpackCfg,
			allWebpackRoot,
			allModulePath,
			allRoots,
			allLayerRoot,
			allTemplates,
			allScripts,
			allExtPath,
			localAlias,
			allModuleRoots,
			allCfg,
			allPackageCfg,
			allModId,
			vars,
			projectRoot
		};
	},
	
	// find a $super file in the available roots
	findParentPath( fs, roots, file, i, possible_ext, fileDependencies, cb, _curExt = 0 ) {
		let fn = path.normalize(roots[i] + file + possible_ext[_curExt]);
		//console.warn("check !!! ", fn, possible_ext[_curExt]);
		fs.stat(fn, ( err, stats ) => {
			if ( stats && stats.isFile() ) {
				//console.warn("Find parent !!! ", fn);
				cb && cb(null, fn, fn.substr(roots[i].length + 1));
			}
			else {
				//console.warn("Not found !!! ", fn);
				// check by path first then by ext
				fileDependencies.push(fn);
				
				// must check parents dir first or we cant override correctly
				// ex : App/file.scss could be called requiring App/file but wanting
				// App/file.js from parents Mean we can't override a js file with ts file
				// or a scss with a css
				if ( i + 1 < roots.length ) {
					this.findParentPath(fs, roots, file, i + 1, possible_ext, fileDependencies, cb, _curExt);
				}
				else if ( possible_ext.length >= _curExt ) {
					this.findParentPath(fs, roots, file, 0, possible_ext, fileDependencies, cb, _curExt + 1)
				}
				else {
					cb && cb(true);
				}
			}
			
		})
	},
	findParent( fs, roots, file, possible_ext, fileDependencies, cb ) {
		let i = -1, tmp;
		file  = path.normalize(file);
		//console.warn("Find parent !!! ", path.normalize(file), roots);
		while ( ++i < roots.length ) {
			tmp = file.substr(0, roots[i].length);
			if ( roots[i] == tmp ) {// found
				return (i != roots.length - 1) && this.findParentPath(fs, roots, file.substr(tmp.length), i + 1, possible_ext, fileDependencies, cb, 0);
			}
		}
		cb && cb(true);
	},
	/**
	 * Create a virtual file accessible by webpack that map a given glob query like
	 * "App/somewhere/**.js"
	 */
	indexOf( vMod, vfs, roots, input, contextDependencies, fileDependencies,
	         RootAlias,
	         RootAliasRe, useHMR, cb ) {
		let files           = {},
		    code            = "/* This is a virtual file generated by layer-pack */\n",
		    virtualFile     = path.normalize(
			    path.join(roots[0], 'MapOf.' + input
					    .replace(/[\-\[\]]/ig, '_')
					    .replace(/\*/ig, '.W.')
					    .replace(/\//ig, '.S.')
					    .replace(/[\(]/ig, '[')
					    .replace(/[\)]/ig, ']')
					    .replace(/\.+/ig, '-')
					    .replace(/[^\w\-]/ig, '_')
				    +
				    '.gen.js')),
		    globUid         = input,
		    subPath         = "",
		    globToRe        = "",
		    exportedModules = {},
		    filesToAdd      = [],
		    loaderOpt       = querystring.parse(input.split('?')[1]);
		//console.log('utils::indexOf:492: ', lazyLoaderOpt);
		input               = input.split('?')[0].replace(/\/$/, '').replace(RootAliasRe, '').substr(1); // rm App/
		subPath             = path.dirname(input.substr(0, input.indexOf('*')) + "a");
		globToRe            =
			(subPath === '.' ? input : input.substr(subPath.length + 1))
				.replace(/\//ig, '\\/')
				.replace(/\./ig, '\\.')
				.replace(/\*\*\\\//ig, '(?:(?:*\\/)+)?')
				.replace(/\*/ig, '[^\\\\\\/]+');
		if ( subPath[0] === '/' )
			subPath = subPath.substr(1);
		input = input.replace(/[\(\)]/g, '');
		
		
		code += "let req, _exports = {}, walknSetExport=require('" + RootAlias + "/.___layerPackIndexUtils').walknSetExport;";
		// generate require.context code so wp will detect changes
		roots.forEach(
			( _root, lvl ) => {
				//console.log('utils::indexOf:414: ', _root + '/' + path.normalize(input));
				
				try {
					let globRoot = _root + "/" + subPath
					
					if ( checkIfDir(fs, path.normalize(globRoot)) ) {
						
						if ( !contextDependencies[globRoot]?.includes(globUid) )
							contextDependencies[globRoot]
							? contextDependencies[globRoot].push(globUid)
							: contextDependencies[globRoot] = [globUid];
						
						glob.sync([_root + '/' + path.normalize(input.replace(/\/[^\/]+$/ig, ''))], { onlyDirectories: true })
						    .forEach(
							    dir => {
								    if ( !contextDependencies[dir]?.includes(globUid) )
									    contextDependencies[dir]
									    ? contextDependencies[dir].push(globUid)
									    : contextDependencies[dir] = [globUid];
							    }
						    )
						//contextDependencies.push(path.normalize(_root + "/" + subPath))
						
						glob.sync([_root + '/' + path.normalize(input)])// wp fs cause new files to be ignored sometimes
						    .forEach(
							    file => {
								    let name  = file.substr(path.normalize(_root + "/" + subPath).length).match(new RegExp("^\\/" + globToRe + "$")),
								        uPath = RootAlias + file.substr(_root.length),
								        key   = "_" + uPath.replace(/[^\w]/ig, "_"),
								        wPath = path.dirname(file);
								    
								    if ( !files[uPath] ) {
									    //console.log('utils:::431: ', uPath, name,file, _root + "/" + subPath,files);
									    //fileDependencies.push(path.normalize(file));
									    filesToAdd.push([uPath, name]);
									    
								    }
								    
								    
								    files[RootAlias + file.substr(_root.length)] = name && name.length && name[1]; // exportable
							    }
						    )
					}
					else {
						do {
							globRoot = globRoot.replace(/\/[^\/]+$/ig, '');
							if ( !globRoot.startsWith(_root) ) return;
						}
						while ( !checkIfDir(fs, path.normalize(globRoot)) );
						
						if ( !contextDependencies[globRoot]?.includes(globUid) )
							contextDependencies[globRoot]
							? contextDependencies[globRoot].push(globUid)
							: contextDependencies[globRoot] = [globUid];
					}
				} catch ( e ) {
				
				}
			}
		);
		//console.warn("Glob import : codec '" + loaderOpt.using + "' for '" + input + "'");
		if ( !glob2Js[loaderOpt.using || 'default'] ) {
			console.warn("Glob import : Unknown codec '" + loaderOpt.using + "' for '" + input + "'");
			loaderOpt.using = 'default';
		}
		code += "\n" + glob2Js[loaderOpt.using || 'default'].echoRequired(loaderOpt) + "\n";
		filesToAdd = filesToAdd.sort(
			( a, b ) => (a[0].length - b[0].length)
		).forEach(
			( [uPath, name] ) => {
				let key = "_" + uPath.replace(/[^\w]/ig, "_");
				
				code += "\n" + glob2Js[loaderOpt.using || 'default'].echoImport(key, uPath, loaderOpt) + "\n";
				
				if ( name && name[1] ) {
					code += `\nwalknSetExport(_exports, "${name[1]}", ${key});`;
				}
			}
		);
		//console.log(files)
		code +=
			"\n" +
			Object.keys(files).map(
				( file, i ) => {
					let exportName = files[file] && files[file].split('/');
					
					if ( exportName && jsVarTest.test(exportName[0]) && !exportedModules[exportName[0]] ) {
						exportedModules[exportName[0]] = true;
						return '\nexport const ' + exportName[0] + ' = _exports.' + exportName[0] + ';';
					}
					//return '/* export const ' + exportName[0] + ' = _exports.' +
					// files[file] + '; */\n';
				}
			).join('\n')
			+ '\n';
		code += "export default _exports;";
		//console.log(code)
		//fs.writeFileSync(virtualFile, code);
		let vFile = path.normalize(virtualFile);
		if ( !fileDependencies.includes(vFile) )
			fileDependencies.push(path.normalize(virtualFile));
		utils.addVirtualFile(vMod, vfs, virtualFile, code, cb);
		//cb && cb(null, virtualFile, code);
	},
	
	
	/**
	 * Create a virtual file accessible by webpack that map a given glob query like
	 * "App/somewhere/**.scss"
	 */
	indexOfScss( vMod, vfs, roots, input, contextDependencies, fileDependencies,
	             RootAlias,
	             RootAliasRe, useHMR, cb ) {
		let files           = {},
		    code            = "/* This is a virtual file generated by layer-pack */",
		    virtualFile     = path.normalize(
			    path.join(roots[0], 'MapOf.' + input
					    .replace(/[\-\[\]]/ig, '_')
					    .replace(/\*/ig, '.W.')
					    .replace(/\//ig, '.S.')
					    .replace(/[\(]/ig, '[')
					    .replace(/[\)]/ig, ']')
					    .replace(/\.+/ig, '-')
					    .replace(/[^\w\-]/ig, '_') +
				    '.gen.scss')),
		    subPath         = "",
		    globUid         = input,
		    exportedModules = {};
		
		input   = input.replace(/\/$/, '').replace(RootAliasRe, '').substr(1); // rm App/
		subPath = path.dirname(input.substr(0, input.indexOf('*')) + "a");
		
		roots.forEach(
			( _root, lvl ) => {
				try {
					let globRoot = _root + "/" + subPath;
					
					if ( checkIfDir(fs, path.normalize(_root + "/" + subPath)) ) {
						
						if ( !contextDependencies[globRoot]?.includes(globUid) )
							contextDependencies[globRoot]
							? contextDependencies[globRoot].push(globUid)
							: contextDependencies[globRoot] = [globUid];
						glob.sync([_root + '/' + path.normalize(input.replace(/\/[^\/]+$/ig, ''))], { onlyDirectories: true })
						    .forEach(
							    dir => {
								    if ( !contextDependencies[dir]?.includes(globUid) )
									    contextDependencies[dir]
									    ? contextDependencies[dir].push(globUid)
									    : contextDependencies[dir] = [globUid];
							    }
						    )
						glob.sync([_root + '/' + path.normalize(input)])
						    .forEach(
							    file => {
								    files[RootAlias + file.substr(_root.length)] = true
							    }
						    )
					}
					else {
						do {
							globRoot = globRoot.replace(/\/[^\/]+$/ig, '');
							if ( !globRoot.startsWith(_root) ) return;
						}
						while ( !checkIfDir(fs, path.normalize(globRoot)) );
						
						if ( !contextDependencies[globRoot]?.includes(globUid) )
							contextDependencies[globRoot]
							? contextDependencies[globRoot].push(globUid)
							: contextDependencies[globRoot] = [globUid];
					}
				} catch ( e ) {
				
				}
			}
		)
		code =
			"\n" +
			Object.keys(files).map(
				( file, i ) => {
					return '@import "' + file + '";';
				}
			).join('\n')
			+ '\n';
		//console.log(code)
		//fs.writeFileSync(virtualFile, code);
		utils.addVirtualFile(vMod, vfs, virtualFile, code, cb);
		//cb && cb(null, virtualFile, code);
	},
	/**
	 * Create a compilable virtual file
	 * @param vfs
	 * @param fileName
	 * @param content
	 */
	addVirtualFile( vMod, vfs, fileName, content, cb ) {
		let oldContent, newContent = content + '';
		oldContent                 = vfs._virtualFiles && vfs._virtualFiles[fileName] && (vfs._virtualFiles[fileName].contents + '');
		
		if ( oldContent !== newContent ) {
			vMod.writeModule(fileName, newContent);
			//vMod._compiler.hooks.invalid.call(fileName, Date.now())
			
			return cb && cb(null, fileName, content + '', true);
		}
		cb && cb(null, fileName, content + '', false);
		
	}
	//,
	//addTempFile( vMod, vfs, fileName, content, cb ) {
	//	let oldContent;
	//	try {
	//
	//		try {
	//			oldContent = fs.readFileSync(fileName) + '';
	//		} catch ( e ) {
	//
	//		}
	//
	//		if ( oldContent !== content + '' ) {
	//
	//			//vfs.purge(fileName);
	//			//VirtualModulePlugin.populateFilesystem(
	//			//	{
	//			//		fs        : vfs,
	//			//		modulePath: fileName,
	//			//		contents  : content,
	//			//		ctime     : Date.now(),
	//			//		utime     : Date.now()
	//			//	});
	//			//let finalInputFileSystem = vMod._compiler.inputFileSystem;
	//			//while ( finalInputFileSystem && finalInputFileSystem._inputFileSystem ) {
	//			//	finalInputFileSystem = finalInputFileSystem._inputFileSystem;
	//			//}
	//			fs.writeFileSync(fileName, content + '');
	//			//if ( oldContent ) debugger;
	//
	//			//vfs._writeVirtualFile(fileName,{
	//			//	ctime     : Date.now(),
	//			//	utime     : Date.now()},content+'')
	//			console.log('utils::addTempFile:560: ', fileName);
	//			//setTimeout(
	//			//	() => {
	//			//vMod.writeModule(fileName, content + '');
	//			//		vMod._compiler.hooks.invalid.call(fileName, Date.now())
	//			//	}
	//			//)
	//
	//			//if ( vMod._compiler.modifiedFiles ) {
	//			//	console.log('utils::addVirtualFile:584: ', fileName);
	//			//	vMod._compiler.modifiedFiles.add(fileName)
	//			//}
	//			return cb && cb(null, fileName, content + '', true);
	//		}
	//		cb && cb(null, fileName, content + '', false);
	//	} catch ( e ) {
	//		console.log('utils::addVirtualFile:593: ', e);
	//	}
	//}
};

module.exports = utils;
