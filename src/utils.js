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


var path                = require("path"),
    fs                  = require('fs'),
    VirtualModulePlugin = require('virtual-module-webpack-plugin'),
    glob                = require('fast-glob');


function checkIfDir( fs, file ) {
	try {
		return fs.statSync(file).isDirectory()
	} catch ( err ) {
		return false
	}
}

module.exports = {
	getAllConfigs() {
		var projectRoot = process.cwd(),
		    pkgConfig   = fs.existsSync(path.normalize(projectRoot + "/package.json")) &&
			    JSON.parse(fs.readFileSync(path.normalize(projectRoot + "/package.json"))),
		    allCfg      = {};
		
		Object.keys(pkgConfig.wpInherit)
		      .forEach(
			      p => {
				      allCfg[p] = true;
				      allCfg[p] = this.getConfigByProfiles(projectRoot, pkgConfig.wpInherit[p], p, allCfg);
			      }
		      )
		return allCfg;
	},
	getConfigByProfiles( projectRoot, pkgConfig, profile ) {
		var extAliases     = {},
		    allModulePath  = [],
		    allModId       = [],
		    allWebpackCfg  = [],
		    allModuleRoots = [],
		    allCfg         = [],
		    vars           = {},
		    rootDir        = pkgConfig.rootFolder || './App',
		    /**
		     * Find & return all  inherited pkg paths
		     * @type {Array}
		     */
		    allExtPath     = (() => {
			    let list = [], flist = [], lmid = [], seen = {};
			
			    pkgConfig.extend.forEach(function walk( p, i, x, mRoot, cProfile ) {
				    mRoot     = mRoot || projectRoot;
				    cProfile  = cProfile || pkgConfig.basedOn || profile;
				    let where = "/node_modules/",
				        cfg   = fs.existsSync(path.normalize(mRoot + where + p + "/package.json")) &&
					        JSON.parse(fs.readFileSync(path.normalize(mRoot + where + p + "/package.json")))
				
				    list.push(path.normalize(mRoot + where + p));
				    lmid.push(p);
				
				    if ( cfg.wpInherit && cfg.wpInherit[cProfile] && cfg.wpInherit[cProfile].extend )
					    cfg.wpInherit[cProfile].extend.forEach(( mid, y ) => walk(mid, y, null, mRoot + where + p, cfg.wpInherit[cProfile].basedOn))
				    else {
					    if ( !cfg )
						    throw new Error("webpack-inherit : Can't inherit an not installed module :\nNot found :" + mRoot + where + p)
					    if ( !cfg.wpInherit )
						    throw new Error("webpack-inherit : Can't inherit a module with no wpInherit in the package.json :\nAt :" + mRoot + where + p)
					    if ( !cfg.wpInherit[cProfile] )
						    throw new Error("webpack-inherit : Can't inherit a module without the requested profile\nAt :" + mRoot + where + p + "\nRequested profile :" + cProfile)
				    }
				
			    })
			
			    /**
			     * dedupe inherited ( last is first )
			     */
			    for ( let i = 0; i < lmid.length; i++ ) {
				    if ( lmid.lastIndexOf(lmid[i]) == i ) {
					    allModId.push(lmid[i]);
					    flist.push(list[i]);
				    }
			    }
			
			    return list;
		    })(),
		    allRoots       = (function () {
			    var roots = [projectRoot + '/' + rootDir], libPath = [];
			
			    pkgConfig.libsPath
			    && fs.existsSync(path.normalize(projectRoot + "/" + pkgConfig.libsPath))
			    && libPath.push(path.normalize(projectRoot + "/" + pkgConfig.libsPath));
			
			    allModulePath.push(path.normalize(projectRoot + '/node_modules'));
			    allModuleRoots.push(projectRoot);
			
			    if ( pkgConfig.config )
				    allWebpackCfg.push(path.normalize(projectRoot + '/' + pkgConfig.config))
			
			    allExtPath.forEach(
				    function ( where, i, arr, cProfile ) {
					    cProfile = cProfile || pkgConfig.basedOn || profile;
					    let cfg  = fs.existsSync(path.normalize(where + "/package.json")) &&
						    JSON.parse(fs.readFileSync(path.normalize(where + "/package.json")));
					
					    allModuleRoots.push(where)
					
					    cfg = cfg.wpInherit[cProfile];
					
					    if ( cfg && cfg.aliases )
						    extAliases = {
							    ...extAliases,
							    ...cfg.aliases
						    };
					    if ( cfg && cfg.vars )
						    vars = {
							    ...cfg.vars,
							    ...vars
						    };
					    if ( cfg )
						    allCfg.push(cfg);
					    if ( cfg.config )
						    allWebpackCfg.push(path.normalize(where + '/' + cfg.config));
					
					    roots.push(fs.realpathSync(path.normalize(where + "/" + (cfg.rootFolder || 'App'))));
					
					    cfg.libsPath &&
					    fs.existsSync(path.normalize(where + "/" + cfg.libsPath))
					    && libPath.push(
						    fs.realpathSync(path.normalize(where + "/" + cfg.libsPath)));
					
					    allModulePath.push(path.normalize(where + "/node_modules"));
					    //console.warn(allModulePath)
				    }
			    );
			    allModulePath.push("node_modules")
			    return roots.map(path.normalize.bind(path));
		    })();
		
		if ( pkgConfig && pkgConfig.aliases )
			extAliases = {
				...extAliases,
				...pkgConfig.aliases
			};
		vars = {
			rootAlias: 'App',
			...vars
		}
		if ( pkgConfig && pkgConfig.vars )
			vars = {
				rootAlias: 'App',
				...vars,
				...pkgConfig.vars
			};
		allCfg.unshift(pkgConfig);
		return {
			allWebpackCfg,
			allModulePath,
			allRoots,
			allExtPath,
			extAliases,
			allModuleRoots,
			allCfg,
			allModId,
			vars
		};
	},
	
	// find a $super file in the available roots
	findParentPath( fs, roots, file, i, possible_ext, cb, _curExt, _ext ) {
		_ext    = _ext || '';
		var fn  = path.normalize(roots[i] + file + _ext);
		_curExt = _curExt || 0;
		//console.warn("check !!! ", fn, _curExt);
		fs.stat(fn, ( err, stats ) => {
			if ( stats && stats.isFile() ) {
				//console.warn("Find parent !!! ", fn);
				cb && cb(null, fn, fn.substr(roots[i].length + 1));
			}
			else {
				//console.warn("Not found !!! ", fn, _curExt);
				if ( possible_ext.length > _curExt ) {
					this.findParentPath(fs, roots, file, i, possible_ext, cb, _curExt + 1, possible_ext[_curExt])
				}
				else if ( i + 1 < roots.length ) {
					this.findParentPath(fs, roots, file, i + 1, possible_ext, cb, 0, '');
				}
				else {
					cb && cb(true);
				}
			}
			
		})
	},
	findParent( fs, roots, file, possible_ext, cb ) {
		var i = -1, tmp;
		file  = path.normalize(file);
		//console.warn("Find parent !!! ", path.normalize(file), roots);
		while ( ++i < roots.length ) {
			tmp = file.substr(0, roots[i].length);
			if ( roots[i] == tmp ) {// found
				return (i != roots.length - 1) && this.findParentPath(fs, roots, file.substr(tmp.length), i + 1, possible_ext, cb);
			}
		}
		cb && cb(true);
	},
	/**
	 * Create a virtual file accessible by webpack that map a given glob query like "App/somewhere/**.js"
	 */
	indexOf( vfs, roots, input, contextDependencies, fileDependencies,
	         RootAlias,
	         RootAliasRe, cb ) {
		var files       = {},
		    code        = "",
		    virtualFile = path.normalize(
			    path.join(roots[roots.length - 1], 'MapOf.' + input.replace(/[^\w]/ig, '_')
			                                                       .replace(/\*/ig, '.W')
			                                                       .replace(/[^\w\.]/ig, '_') +
				    '.gen.js')),
		    subPath     = "",
		    re          = ""
		;
		
		
		input   = input.replace(/\/$/, '').replace(RootAliasRe, '').substr(1); // rm App/
		subPath = path.dirname(input.substr(0, input.indexOf('*')) + "a")
		re      =
			input.substr(subPath.length + 1)
			     .replace(/\//ig, '\\/')
			     .replace(/\./ig, '\\.')
			     .replace(/\*\*/ig, '((*\\/)+)?*')
			     .replace(/\*/ig, '[^\\\\\\/]+');
		
		//console.log(input, subPath, re)
		
		code += "let req, _exports = {}, root;"
		roots.forEach(
			( _root, lvl ) => {
				if ( checkIfDir(fs, path.normalize(_root + "/" + subPath)) )
					code += "" +
						"req = require.context(" + JSON.stringify(path.normalize(_root + "/" + subPath)) + ", true, /^\\.\\/" + re + "$/);\n" +
						"\n" +
						"req.keys().forEach(function (key) {\n" +
						"    let name=key.substr(2);" +
						"    _exports[name] = _exports[name]||req(key);\n" +
						"});\n";
				//\"" + RootAlias + "/" + subPath + "/" + "\"+key
			}
		)
		code += "export default _exports;";
		//console.log(code)
		//fs.writeFileSync(virtualFile, code);
		vfs.purge([virtualFile]);
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
		cb(null, virtualFile, code);
	},
	
	
	/**
	 * Create a virtual file accessible by webpack that map a given glob query like "App/somewhere/**.scss"
	 */
	indexOfScss( vfs, roots, input, contextDependencies, fileDependencies,
	             RootAlias,
	             RootAliasRe, cb ) {
		var files       = {},
		    code        = "",
		    virtualFile = path.normalize(
			    path.join(roots[roots.length - 1], 'MapOf.' + input.replace(/[^\w]/ig, '_')
			                                                       .replace(/\*/ig, '.W')
			                                                       .replace(/[^\w\.]/ig, '_') +
				    '.gen.scss'));
		
		input = input.replace(/\/$/, '').replace(RootAliasRe, '').substr(1); // rm App/
		roots.forEach(
			( _root, lvl ) => {
				contextDependencies.push(
					path.dirname(
						path.normalize(
							_root + '/' + path.normalize(input).replace(/^([^\*]+)\/.*$/, '$1')
						)
					)
				);
				glob.sync([_root + '/' + path.normalize(input)])
				    .forEach(
					    file => {
						    !files[RootAlias + file.substr(_root.length)]
						    && fileDependencies.push(path.normalize(file));
						
						    files[RootAlias + file.substr(_root.length)] = true
					    }
				    )
			}
		)
		code =
			"\n" +
			Object.keys(files).map(
				( file, i ) => {
					let mid = file.replace(/\.[^\.]*$/, '');
					
					return '@import "' + file + '";';
				}
			).join('\n')
			+ '\n';
		//console.log(code)
		//fs.writeFileSync(virtualFile, code);
		vfs.purge([virtualFile]);
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
		cb(null, virtualFile, code);
	},
	
}