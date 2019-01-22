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

const utils                                        = require("./utils");
const InheritPlugin                                = require("./InheritPlugin");
let allConfigs, currentProfile, allPluginInstances = {}, allCfgInstances = {};

module.exports = {
	getAllConfigs() {
		return allConfigs = allConfigs || utils.getAllConfigs()
	},
	getConfig( profile = currentProfile || 'default' ) {
		return this.getAllConfigs()[profile];
	},
	loadModulePath( profile = currentProfile || "default" ) {
		let cfg = this.getAllConfigs()[profile];
		
		let addModulePath = require('app-module-path').addPath;
		cfg.allModulePath.map(addModulePath)
	},
	getSuperWebpackCfg( profile = "default" ) {
		let cfg = this.getAllConfigs()[profile],
		    wpCfg;
		
		if ( allCfgInstances[profile] )
			return allCfgInstances[profile];
		
		this.loadModulePath(profile);
		
		try {
			currentProfile = profile;
			wpCfg          = require(cfg.allWebpackCfg[0])
		} catch ( e ) {
			console.error(e)
			wpCfg = []
		}
		allCfgInstances[profile] = wpCfg;
		currentProfile           = null;
		return wpCfg;
	},
	plugin( cfg, profile = currentProfile || 'default' ) {
		return allPluginInstances[profile] = allPluginInstances[profile] || InheritPlugin(cfg, this.getAllConfigs()[profile])
	},
	isFileExcluded( profile = currentProfile || 'default' ) {
		let allRoots = this.getAllConfigs()[profile].allRoots;
		return { test: ( path ) => !allRoots.find(r => path.startsWith(r)) }
	},
	getHeadRoot( profile = currentProfile || 'default' ) {
		let allModuleRoots = this.getAllConfigs()[profile].allModuleRoots;
		return allModuleRoots[0]
	}
}