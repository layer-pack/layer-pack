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
 *  @contact : wiplabs@gmail.com
 */

/**
 * @author N.Braun
 */
var path                      = require('path');
var walk                      = require('walk'),
    shortid                   = require('shortid'),
    fs                        = require('fs'),
    os                        = require('os');
var VirtualModulePlugin       = require('virtual-module-webpack-plugin');
var CommonJsRequireDependency = require("webpack/lib/dependencies/CommonJsRequireDependency");
const isBuiltinModule         = require('is-builtin-module');
var ModuleFilenameHelpers     = require('webpack/lib/ModuleFilenameHelpers');
var ExternalModule            = require('webpack/lib/ExternalModule');

/**
 * Main wip plugin
 *
 */
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
const {
	      NodeJsInputFileSystem,
	      CachedInputFileSystem,
	      ResolverFactory
      }          = require('enhanced-resolve');

function findParentPath( fs, roots, file, i, cb, _curExt, _ext ) {
	_ext    = _ext || '';
	var fn  = path.normalize(roots[i] + file + _ext);
	_curExt = _curExt || 0;
	// console.warn("check !!! ", fn, ei);
	fs.stat(fn, function ( err, stats ) {
		if ( stats && stats.isFile() ) {
			// console.warn("Find parent !!! ", fn);
			cb && cb(null, fn, fn.substr(roots[i].length + 1));
		}
		else {
			// console.warn("Not found !!! ", fn, ei);
			if ( possible_ext.length > _curExt ) {
				findParentPath(fs, roots, file, i, cb, _curExt + 1, possible_ext[_curExt])
			}
			else if ( i + 1 < roots.length ) {
				findParentPath(fs, roots, file, i + 1, cb, 0, '');
			}
			else {
				
				cb && cb(true);
			}
		}
		
	})
}

function findFallBack( nm, roots, ctx, file, i, cb ) {
	
	//console.warn("try ", ctx, roots[i], file);
	nm.resolve(
		{},
		roots[0],
		file,
		//{},
		function ( e, found ) {
			if ( found ) {
				//console.warn("Find In fall back !!! ", found, roots[i]);
				cb && cb(null, found, found.substr(roots[i].length + 1));
			}
			else {
				
				//if ( i + 1 < roots.length ) findFallBack(nm, roots, ctx, file, i + 1, cb);
				//else
				cb && cb(true);
			}
			
		}
	)
}

function checkIfDir( fs, file, cb ) {
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
}

function findParent( fs, roots, file, cb ) {
	var i = -1, tmp;
	while ( ++i < roots.length ) {
		tmp = file.substr(0, roots[i].length);
		if ( roots[i] == tmp ) {// found
			return (i != roots.length - 1) && findParentPath(fs, roots, file.substr(tmp.length), i + 1, cb);
		}
	}
	cb && cb(true);
}

var available_contexts = { "api": true, "www": true };

function indexOf( vfs, roots, dir, _fileMatch, ctx, contextual, contextDependencies, fileDependencies, cb ) {
	var sema        = 0,
	    files       = {},
	    lvls        = {},
	    fileMatch   = _fileMatch && (new RegExp(//file mask
	                                            "^" +
		                                            _fileMatch
			                                            .replace(/^,\s*(.*)\s*$/, '$1')
			                                            // .replace(/\.jsx?$/, '')
			                                            .replace(/\./ig, '\\.')
			                                            .replace(/\*\*/ig, '((*/)+)?*')
			                                            .replace(/\*/ig, '[^\\\\\\/]+')
		                                            + "$")),
	    seen        = 0,
	    done        = false,
	    code        = "export default  {};",
	    virtualFile = path.normalize(
		    path.join(roots[roots.length - 1], 'MapOf.' + dir.replace(/[^\w]/ig, '_') +
			    (_fileMatch || '*').replace(/\*/ig, '.W').replace(/[^\w\.]/ig, '_') +
			    '.gen.js'));
	
	sema++;
	
	dir = dir.replace(/\/$/, '').replace(/^App\//, '');
	roots.forEach(
		( _root, lvl ) => {
			var
				root = _root + '/' + dir;
			contextDependencies.push(path.join(_root, dir));
			
			sema++;
			// find all files resolvable in the passed namespace
			checkIfDir(
				vfs,
				root,
				( e, r ) => {
					if ( r ) {
						var walker = walk.walk(root);
						
						walker.on("file", function ( _root, fileStats, next ) {
							
							var fn      = path.normalize(path.join(_root, fileStats.name)),
							    keyTest = (fn).substr(root.length)
							                  // .replace(/\.jsx?$/, '')
							                  .replace(/\\/g, '/')// use /
							                  .replace(/^\//, ''),
							    key     = keyTest.replace(/\.jsx?$/, '');// rm js ext
							
							// fileMatch && console.log(fileMatch.test(keyTest), keyTest);
							
							if ( (!fileMatch || fileMatch.test(keyTest)) ) {
								if ( (lvls[key] || 1000) > lvl ) {
									files[key] = fn.replace(/(['"\\])/g, '\\$1');
									lvls[key]  = lvl + 1;
									fileDependencies.push(fn);
								}
							}
							next();
						});
						
						walker.on("directory", function ( _root, fileStats, next ) {
							contextDependencies.push(
								path.normalize(path.join(_root, fileStats.name)));
							next();
						});
						
						walker.on("errors", function ( root, nodeStatsArray, next ) {
							next();
						});
						
						walker.on("end", function () {
							if ( !(--seen) ) {
								var fkeys = [],
								    fpath = Object.keys(files).filter(
									    ( module, i ) => {
										    var file = module.match(/^(.*)(?:\.([^\.]+))$/);
										    if ( ctx ) {
											    if ( file && file[2] !== ctx && (file[2] in available_contexts) ) {// not current ctx
												    // console.warn('not current ctx', ctx, file, module,
												    //              available_contexts, (file[2] in
												    // available_contexts));
												    return false;
											    }
											    if ( file && file[2] == ctx && files[file[1]] ) {// current ctx but have multi ctx
												    return false;
											    }
										    }
										    return true;
									    }
								    ).map(( k ) => (fkeys.push(k), files[k])),
								    code  = "var exp = {" +
									    fkeys.map(
										    ( module, i ) => {
											    let file = module.match(/^(.*)(?:\.([^\.]+))$/), mid = module;
											    if ( ctx && file ) {
												    if ( file[2] && contextual && (file[2] in available_contexts) ) {// current ctx
													    mid = file[1];
												    }
											    }
											    return '"' + mid + '":require(\"App/' + dir + '/' + module +
												    '\")';
										    }
									    ).join(',\n')
									    + '};\n' +
									    'export default exp;';
								//console.log(code)
								// fs.writeFileSync(virtualFile, code);
								vfs.purge([virtualFile]);
								
								VirtualModulePlugin.populateFilesystem(
									{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
								
								//VirtualModulePlugin.populateFilesystem(
								//    {
								//        fs         : vfs,
								//        modulePath : virtualFile + '.map',
								//        contents   : "",
								//        ctime      : Date.now()
								//    });
							}
							if ( !(--sema) ) {
								cb(null, virtualFile, code);
							}
						});
						seen++;
					}
					else if ( !(--sema) ) {
						// fs.writeFileSync(virtualFile, code);
						vfs.purge([virtualFile]);
						VirtualModulePlugin.populateFilesystem(
							{
								fs        : vfs,
								modulePath: virtualFile,
								contents  : "export default  {};",
								ctime     : Date.now()
							});
						VirtualModulePlugin.populateFilesystem(
							{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
						cb(null, virtualFile, "module.export = {};");
					}
				}
			);
		}
	)
	if ( !(--sema) ) {
		
		// fs.writeFileSync(virtualFile, code);
		vfs.purge([virtualFile]);
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile, contents: "module.export = {};", ctime: Date.now() });
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
		cb(null, virtualFile, "module.export = {};");
	}
	
	
}

function indexOfScss( vfs, roots, dir, _fileMatch, ctx, contextual, contextDependencies, fileDependencies, cb ) {
	var sema        = 0,
	    files       = {},
	    lvls        = {},
	    fileMatch   = _fileMatch && (new RegExp(//file mask
	                                            "^" +
		                                            _fileMatch
			                                            .replace(/^,\s*(.*)\s*$/, '$1')
			                                            // .replace(/\.jsx?$/, '')
			                                            .replace(/\./ig, '\\.')
			                                            .replace(/\*\*/ig, '((*/)+)?*')
			                                            .replace(/\*/ig, '[^\\\\\\/]+')
		                                            + "$")),
	    seen        = 0,
	    done        = false,
	    virtualFile = path.normalize(
		    path.join(roots[roots.length - 1], 'MapOf.' + dir.replace(/[^\w]/ig, '_') +
			    (_fileMatch || '*').replace(/\*/ig, '.W').replace(/[^\w\.]/ig, '_') +
			    '.gen.scss')),
	    code        = "/* " + virtualFile + " */\n";
	
	sema++;
	
	dir = dir.replace(/\/$/, '').replace(/^App\//, '');
	roots.forEach(
		( _root, lvl ) => {
			var
				root = _root + '/' + dir;
			contextDependencies.push(path.join(_root, dir));
			
			sema++;
			// find all files resolvable in the passed namespace
			checkIfDir(
				vfs,
				root,
				( e, r ) => {
					if ( r ) {
						var walker = walk.walk(root);
						
						walker.on("file", function ( _root, fileStats, next ) {
							
							var fn      = path.normalize(path.join(_root, fileStats.name)),
							    keyTest = (fn).substr(root.length)
							                  // .replace(/\.jsx?$/, '')
							                  .replace(/\\/g, '/')// use /
							                  .replace(/^\//, ''),
							    key     = keyTest.replace(/\.jsx?$/, '');// rm js ext
							
							// fileMatch && console.log(fileMatch.test(keyTest), keyTest);
							
							if ( (!fileMatch || fileMatch.test(keyTest)) ) {
								if ( (lvls[key] || 1000) > lvl ) {
									files[key] = fn.replace(/(['"\\])/g, '\\$1');
									lvls[key]  = lvl + 1;
									fileDependencies.push(fn);
								}
							}
							next();
						});
						
						walker.on("directory", function ( _root, fileStats, next ) {
							contextDependencies.push(
								path.normalize(path.join(_root, fileStats.name)));
							next();
						});
						
						walker.on("errors", function ( root, nodeStatsArray, next ) {
							next();
						});
						
						walker.on("end", function () {
							if ( !(--seen) ) {
								var fkeys = [],
								    fpath = Object.keys(files).filter(
									    ( module, i ) => {
										    var file = module.match(/^(.*)(?:\.([^\.]+))$/);
										    if ( ctx ) {
											    if ( file && file[2] !== ctx && (file[2] in available_contexts) ) {// not current ctx
												    // console.warn('not current ctx', ctx, file, module,
												    //              available_contexts, (file[2] in
												    // available_contexts));
												    return false;
											    }
											    if ( file && file[2] == ctx && files[file[1]] ) {// current ctx but have multi ctx
												    return false;
											    }
										    }
										    return true;
									    }
								    ).map(( k ) => (fkeys.push(k), files[k]));
								code      = "" +
									fkeys.map(
										( module, i ) => {
											let file = module.match(/^(.*)(?:\.([^\.]+))$/), mid = module;
											if ( ctx && file ) {
												if ( file[2] && contextual && (file[2] in available_contexts) ) {// current ctx
													mid = file[1];
												}
											}
											return '@import "App/' + dir + '/' + module + '\";';
										}
									).join('\n')
									+ '\n';
								//console.log(code)
								// fs.writeFileSync(virtualFile, code);
								vfs.purge([virtualFile]);
								
								VirtualModulePlugin.populateFilesystem(
									{ fs: vfs, modulePath: virtualFile, contents: code, ctime: Date.now() });
								
								//VirtualModulePlugin.populateFilesystem(
								//    {
								//        fs         : vfs,
								//        modulePath : virtualFile + '.map',
								//        contents   : "",
								//        ctime      : Date.now()
								//    });
							}
							if ( !(--sema) ) {
								cb(null, virtualFile, code);
							}
						});
						seen++;
					}
					else if ( !(--sema) ) {
						// fs.writeFileSync(virtualFile, code);
						vfs.purge([virtualFile]);
						VirtualModulePlugin.populateFilesystem(
							{
								fs        : vfs,
								modulePath: virtualFile,
								contents  : code,
								ctime     : Date.now()
							});
						VirtualModulePlugin.populateFilesystem(
							{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
						cb(null, virtualFile, code);
					}
				}
			);
		}
	)
	if ( !(--sema) ) {
		
		// fs.writeFileSync(virtualFile, code);
		vfs.purge([virtualFile]);
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile, contents: "module.export = {};", ctime: Date.now() });
		VirtualModulePlugin.populateFilesystem(
			{ fs: vfs, modulePath: virtualFile + '.map', contents: "", ctime: Date.now() });
		cb(null, virtualFile, "module.export = {};");
	}
	
	
}

module.exports = function ( opts, ctx, ctx2 ) {
	ctx2 = ctx2 || ctx;
	let plugin;
	return plugin = {
		sassImporter: function () {
			return plugin._sassImporter(...arguments)
		},
		apply       : function ( compiler ) {
			var cache               = {}, plugin = this;
			// override the normal parser plugin to have the origin file (required to find parents)
			var contextDependencies = [], fileDependencies = [];
			
			var roots    = opts.root;
			var fallback = opts.allModulePath || compiler.options.resolve.modules;
			//opts.allCfg && console.log(ctx, opts.allCfg.map(cfg => cfg.builds[ctx]))
			var alias    = opts.alias, internals = [];
			
			// @todo : rewrite this mess ( & optimize )
			
			function wipResolve( data, cb ) {
				var vals,
				    requireOrigin = data.contextInfo.issuer,
				    rootIndex;
				
				for ( var i = 0; i < alias.length; i++ ) {
					if ( alias[i][0].test(data.request) ) {
						data.request = data.request.replace(alias[i][0], alias[i][1]);
						break;
					}
				}
				
				
				data.wipOriginRrequest = data.request;
				
				// $map resolving...
				if ( (vals = data.request.match(
					/^\$map\(([^'"\),]+)(\s*,\s*([^'",\)]+))?(\s*,\s*([^'",\)]+))?(\s*,\s*([^'"\)]+))?\s*\)/)) ) {
					vals[2] = vals[2] && vals[2].replace(/^,\s*(.*)\s*$/, '$1') || '';
					
					
					return (/\.s?css$/.test(vals[2]) ? indexOfScss : indexOf)(
						compiler.inputFileSystem, roots, vals[1],
						vals[2]
							|| null,
						vals[2] && ctx,
						!!vals[3],
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
					    //console.log("find %s\t\t\t=> %s", data.request, filePath, e, cache[key]);
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
				    key     = data.context + '##' + data.request;
				
				if ( /^\$super$/.test(data.request) ) {
					// console.info(requireOrigin);
					// console.dir(data.dependencies);
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
				// console.log("search %s", data.request, cache[key]);
				cache[key] = [apply];
				
				// $super resolving..
				if ( /^\$super$/.test(data.request) ) {
					return findParent(
						compiler.inputFileSystem,
						roots,
						requireOrigin,
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
					return findParentPath(
						compiler.inputFileSystem,
						roots,
						data.request.replace(/^App/ig, ''),
						0,
						function ( e, filePath, file ) {
							if ( e ) {
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
			
			this._sassImporter = function ( url, prev, cb ) {
				if ( /^(\$|App\/)/.test(url) ) {
					wipResolve(
						{
							contextInfo: {
								issuer: prev
							},
							request    : url
						},
						function ( e, found, contents ) {
							if ( found || contents ) {
								//console.warn("Find plugin !!! ", url, found, contents);
								cb && cb(contents && { contents } || { file: found.request });
							}
							else {
								//if ( i + 1 < roots.length ) findFallBack(nm, roots, ctx, file, i + 1, cb);
								//else
								
								//console.warn("not found !!! ", url, found, e);
								cb && cb({ file: url });
							}
							
						}
					)
				}
				else return null;
			};
			
			compiler.plugin("normal-module-factory", function ( nmf ) {
				                !/www/.test(ctx) && nmf.plugin('factory', function ( factory ) {
					                return function ( data, callback ) {
						                let mkExt = isBuiltinModule(data.request)
							                || data.wipOriginRrequest && isBuiltinModule(data.wipOriginRrequest),
						                    //=
						                    ///^\./.test(data.request) && internals.find(p =>
						                    // data.context.startsWith(p)) ||  (opts.appInternal || []).find(p =>
						                    // data.request.startsWith(p)),
						                    found;
						                //if ( /toolbox/.test(data.request) )
						                //if ( data.wipOriginRrequest && !root ) {
						
						                if ( !mkExt && opts.allCfg.find(
							                cfg => (
								                cfg.builds &&
								                cfg.builds[ctx] &&
								                cfg.builds[ctx].externals &&
								                cfg.builds[ctx].externals.find(mod => {
									                return data.wipOriginRrequest.startsWith(found = mod)
									                //|| data.request.startsWith(found = mod);
								                })
								                //ModuleFilenameHelpers.matchObject(cfg.builds[ctx].internals,
								                // data.wipOriginRrequest)
							                )
						                ) ) {
							                mkExt = true;//fallback.find(p => data.request.startsWith(p))||true;
							                //console.warn("ext!", mkExt + '/' + found, data.request)
						                }
						
						                //root && console.warn("int", data.request, data.wipOriginRrequest)
						                //}
						                //mkExt && console.log("ext", data.request, data.context,
						                // data.wipOriginRrequest)
						                if ( mkExt ) {
							                return callback(null, new ExternalModule(
								                data.wipOriginRrequest || data.request,
								                //!/www/.test(ctx) ?
								                compiler.options.output.libraryTarget
								                //: "commonjs"
							                ));
							
						                }
						                else {
							                return factory(data, callback);
						                }
						
					                };
				                });
				                nmf.plugin("before-resolve", wipResolve);
				
			                }
			);
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
				contextDependencies = [];
				cb()
				cache = {};
			});
		}
	}
		;
}
;
