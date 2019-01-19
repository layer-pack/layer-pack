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
				
				    list.push(path.normalize(projectRoot + where + p));
			    })
			
			
			    list.filter(e => (seen[e] ? true : (seen[e] = true, false)))
			    return list;
		    })(),
		    allRoots       = (function () {
			    var roots = [projectRoot + '/' + rootDir], libPath = [];
			
			    allModuleId.push(pkgConfig)
			    pkgConfig.libsPath
			    && fs.existsSync(path.normalize(projectRoot + "/" + pkgConfig.libsPath))
			    && libPath.push(path.normalize(projectRoot + "/" + pkgConfig.libsPath));
			
			    allModulePath.push(path.normalize(projectRoot + '/node_modules'));
			    allModuleRoots.push(projectRoot)
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
						    allCfg.push(cfg)
					    if ( cfg.config )
						    allWebpackCfg.push(where + '/' + cfg.config)
					
					    roots.push(fs.realpathSync(path.normalize(where + "/" + (cfg.rootDir || 'App'))));
					
					    cfg.libsPath &&
					    fs.existsSync(path.normalize(where + "/" + cfg.libsPath))
					    && libPath.push(
						    fs.realpathSync(path.normalize(where + "/" + cfg.libsPath)));
					
					    //console.log(path.normalize(where +
					    // "/node_modules"), fs.existsSync(path.normalize(projectRoot + where
					    // + p + "/node_modules")) && "yes")
					    fs.existsSync(path.normalize(where + "/node_modules"))
					    && allModulePath.push(
						    fs.realpathSync(path.normalize(where + "/node_modules")));
				    }
			    );
			    allModulePath = libPath.concat(allModulePath);
			    //roots.push(
			    //    path.normalize(cwd + '/' + rootDir)
			    //);
			    //allModulePath.push(path.normalize(cwd + '/node_modules'));
			
			    allModulePath = allModulePath.filter(fs.existsSync.bind(fs));
			    //allModulePath.push("node_modules")
			    return roots.map(path.normalize.bind(path));
		    })();
		allCfg.push(pkgConfig)
		return { allWebpackCfg, allModulePath, allRoots, allExtPath, extAliases, allModuleRoots, allCfg };
	}
}