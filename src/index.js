/*
 * Copyright 2023 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

const utils         = require("./utils"),
      Module        = require('module').Module,
      path          = require('path'),
      dMerge        = require('deep-extend'),
      lPackPlugin   = require("./layerPackPlugin"),
      ModPathLoader = require("../etc/node/loadModulePaths"),
      merge         = require('webpack-merge');

let allConfigs, allPluginInstances = {}, allCfgInstances = {};

module.exports = {
	/**
	 * Retrieve all available configs by profile id
	 * @returns {{}}
	 */
	getAllConfigs( dir, reset ) {
		return allConfigs = !reset && allConfigs || utils.getAllConfigs(dir)
	},
	/**
	 * Retrieve the current profile config or the asked one
	 * @param profile {string} optional profile id
	 * @returns {*}
	 */
	getConfig( profile = process.env.__LPACK_PROFILE__ || 'default' ) {
		let cfg = this.getAllConfigs()[profile];
		
		if ( process.env.__LPACK_VARS_OVERRIDE__ ) {// not good
			let overrides = JSON.parse(process.env.__LPACK_VARS_OVERRIDE__),
			    vars      = {};
			dMerge(vars, cfg.vars || {}, overrides);
			cfg = { ...cfg, vars };
		}
		return cfg;
	},
	/**
	 * Load a specific config
	 * @param config {object} lPack config json
	 * @param basePath {string} project root absolute path (default to cwd)
	 * @returns {*}
	 */
	loadConfig( config, basePath ) {
		return allConfigs = utils.getAllConfigs(basePath, config);
	},
	/**
	 * Retrieve the inherited wp cfg for the given or current profile id
	 *
	 * @param profile {string} optional profile id
	 * @param head {boolean} use the current package config
	 * @returns {*}
	 */
	getSuperWebpackCfg( profile = process.env.__LPACK_PROFILE__ || "default", head ) {
		let cfg = this.getConfig(profile),
		    wpCfg;
		
		if ( allCfgInstances[profile] )
			return allCfgInstances[profile];
		
		ModPathLoader.loadWpPaths(cfg.allModulePath,[path.normalize(cfg.allWebpackRoot[0] + "/node_modules")]);
		//console.log('exports::getSuperWebpackCfg:73: ', cfg.allModulePath);
		try {
			if ( !head && cfg.allCfg[0].config && cfg.allWebpackCfg[1] )
				wpCfg = require(cfg.allWebpackCfg[1]);
			else
				wpCfg = require(cfg.allWebpackCfg[0]);
			
			if ( cfg.vars.webpackPatch ) {
				wpCfg = wpCfg.map(cfgItem => merge.smart(cfgItem, cfg.vars.webpackPatch));
			}
		} catch ( e ) {
			console.error(e)
			wpCfg = []
		}
		allCfgInstances[profile] = wpCfg;
		return wpCfg;
	},
	/**
	 * Return a 'singleton' of the plugin for the given or current profile id
	 *
	 * @param cfg
	 * @param profile {string} optional profile id
	 * @returns {*}
	 */
	plugin( cfg, profile = process.env.__LPACK_PROFILE__ || 'default' ) {
		return allPluginInstances[profile] = allPluginInstances[profile] || lPackPlugin(cfg, this.getConfig(profile))
	},
	/**
	 * Return a tester fn for the given or current profile id
	 * Tester return true if the given file path is outside inheritable dir
	 *
	 * @param profile {string} optional profile id
	 * @returns {{test: (function(*): boolean)}}
	 */
	isFileExcluded( profile = process.env.__LPACK_PROFILE__ || 'default' ) {
		let allRoots    = this.getConfig(profile).allRoots,
		    isExcluded  = ( path ) => !allRoots.find(r => path.startsWith(r));
		isExcluded.test = isExcluded;
		return isExcluded;
	},
	/**
	 * Return the root directory of the head package
	 *
	 * @param profile {string} optional profile id
	 * @returns {*}
	 */
	getHeadRoot( profile = process.env.__LPACK_PROFILE__ || 'default' ) {
		let allModuleRoots = this.getConfig(profile).allModuleRoots;
		return allModuleRoots[0]
	}
}
