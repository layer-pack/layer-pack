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


var path = require("path"),
    fs   = require("fs"),
    cwd  = path.normalize(__dirname + '/..');

var walk                = require('walk'),
    shortid             = require('shortid'),
    fs                  = require('fs'),
    os                  = require('os');
var VirtualModulePlugin = require('virtual-module-webpack-plugin');
//var CommonJsRequireDependency = require("webpack/lib/dependencies/CommonJsRequireDependency");
var glob                = require('fast-glob');


var possible_ext = [
	".js",
	".jsx",
	".json",
	"/index.js",
	"/index.scss",
	"/index.css",
	".scss",
	".css"
];
module.exports   = {
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
		    allExternals   = [],
		    allWebpackCfg  = [],
		    allModuleRoots = [],
		    allCfg         = [],
		    allModuleId    = [],
		    rootAlias      = pkgConfig.rootAlias || 'App',
		    rootDir        = pkgConfig.rootDir || './App',
		    /**
		     * Find & return all  inherited pkg paths
		     * @type {Array}
		     */
		    allExtPath     = (() => {
			    let list = [], seen = {};
			
			    pkgConfig.extend.forEach(function walk( p, i ) {
				    let where = fs.existsSync(path.normalize(projectRoot + "/libs/" + p))
				                ? "/libs/" :
				                "/node_modules/",
				        cfg   = fs.existsSync(path.normalize(projectRoot + where + p + "/package.json")) &&
					        JSON.parse(fs.readFileSync(path.normalize(projectRoot + where + p + "/package.json")))
				
				    if ( cfg.wpInherit && cfg.wpInherit[profile] && cfg.wpInherit[profile].extend )
					    cfg.wpInherit[profile].extend.forEach(walk)
				    else throw new Error("webpack-inherit : Can't inherit an not installed module")
				
				    list.push(path.normalize(projectRoot + where + p));
			    })
			
			
			    list.filter(e => (seen[e] ? true : (seen[e] = true, false)))
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
				    function ( where ) {
					    let cfg = fs.existsSync(path.normalize(where + "/package.json")) &&
						    JSON.parse(fs.readFileSync(path.normalize(where + "/package.json")));
					
					    allModuleRoots.push(where)
					
					    cfg = cfg.wpInherit[profile];
					
					    if ( cfg && cfg.aliases )
						    extAliases = {
							    ...extAliases,
							    ...cfg.aliases
						    };
					    if ( cfg )
						    allCfg.push(cfg);
					    if ( cfg.config )
						    allWebpackCfg.push(path.normalize(where + '/' + cfg.config));
					
					    roots.push(fs.realpathSync(path.normalize(where + "/" + (cfg.rootDir || 'App'))));
					
					    cfg.libsPath &&
					    fs.existsSync(path.normalize(where + "/" + cfg.libsPath))
					    && libPath.push(
						    fs.realpathSync(path.normalize(where + "/" + cfg.libsPath)));
					
					    allModulePath.push(path.normalize(where + "/node_modules"));
					    //console.warn(allModulePath)
					
				    }
			    );
			    //allModulePath = libPath.concat(allModulePath);
			    //roots.push(
			    //    path.normalize(cwd + '/' + rootDir)
			    //);
			    //allModulePath.push(path.normalize(cwd + '/node_modules'));
			
			    //allModulePath = allModulePath.filter(fs.existsSync.bind(fs));
			    allModulePath.push("node_modules")
			    return roots.map(path.normalize.bind(path));
		    })();
		allCfg.push(pkgConfig)
		return { allWebpackCfg, allModulePath, allRoots, allExtPath, extAliases, allModuleRoots, allCfg };
	},
	
	findParentPath( fs, roots, file, i, cb, _curExt, _ext ) {
		_ext    = _ext || '';
		var fn  = path.normalize(roots[i] + file + _ext);
		_curExt = _curExt || 0;
		// console.warn("check !!! ", fn, ei);
		fs.stat(fn, ( err, stats ) => {
			if ( stats && stats.isFile() ) {
				// console.warn("Find parent !!! ", fn);
				cb && cb(null, fn, fn.substr(roots[i].length + 1));
			}
			else {
				// console.warn("Not found !!! ", fn, ei);
				if ( possible_ext.length > _curExt ) {
					this.findParentPath(fs, roots, file, i, cb, _curExt + 1, possible_ext[_curExt])
				}
				else if ( i + 1 < roots.length ) {
					this.findParentPath(fs, roots, file, i + 1, cb, 0, '');
				}
				else {
					
					cb && cb(true);
				}
			}
			
		})
	},
	
	checkIfDir( fs, file, cb ) {
		fs.stat(file, function fsStat( err, stats ) {
			if ( err ) {
				if ( err.code === 'ENOENT' ) {
					return cb(null, false);
				}
				else {
					return cb(err);
				}
			}
			// console.dir(Object.keys(stats))
			return cb(null, stats.isDirectory());
		});
	},
	findParent( fs, roots, file, cb ) {
		var i = -1, tmp;
		while ( ++i < roots.length ) {
			tmp = file.substr(0, roots[i].length);
			if ( roots[i] == tmp ) {// found
				return (i != roots.length - 1) && this.findParentPath(fs, roots, file.substr(tmp.length), i + 1, cb);
			}
		}
		cb && cb(true);
	},
	indexOf( vfs, roots, input, contextDependencies, fileDependencies, cb ) {
		var files       = {},
		    code        = "",
		    virtualFile = path.normalize(
			    path.join(roots[roots.length - 1], 'MapOf.' + input.replace(/[^\w]/ig, '_')
			                                                       .replace(/\*/ig, '.W')
			                                                       .replace(/[^\w\.]/ig, '_') +
				    '.gen.js'));
		
		input = input.replace(/\/$/, '').replace(/^App\//, '');
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
						    fileDependencies.push(path.normalize(file));
						
						
						    files["App" + file.substr(_root.length)] = true
					    }
				    )
			}
		)
		code =
			"export default {\n" +
			Object.keys(files).map(
				( file, i ) => {
					let mid = file.replace(/\.[^\.]*$/, '');
					
					return '"' + mid + '":require(\"' + file + '\")';
				}
			).join(',\n')
			+ '\n};\n';
		//console.log(code)
		//fs.writeFileSync(virtualFile, code);
		vfs.purge([virtualFile]);
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
		cb(null, virtualFile, code);
	},
	indexOfScss( vfs, roots, input, contextDependencies, fileDependencies, cb ) {
		var files       = {},
		    code        = "",
		    virtualFile = path.normalize(
			    path.join(roots[roots.length - 1], 'MapOf.' + input.replace(/[^\w]/ig, '_')
			                                                       .replace(/\*/ig, '.W')
			                                                       .replace(/[^\w\.]/ig, '_') +
				    '.gen.scss'));
		
		input = input.replace(/\/$/, '').replace(/^App\//, '');
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
						    fileDependencies.push(path.normalize(file));
						
						
						    files["App" + file.substr(_root.length)] = true
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