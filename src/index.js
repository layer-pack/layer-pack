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

const utils         = require("./utils"),
      Module        = require('module').Module,
      path          = require('path'),
      InheritPlugin = require("./InheritPlugin"),
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
	getConfig( profile = process.env.__WPI_PROFILE__ || 'default' ) {
		return this.getAllConfigs()[profile];
	},
	/**
	 * Add inherited node_modules paths to node
	 * @todo : somethink needed as it could lead to absurd node_modules list
	 * @param profile {string} optional profile id
	 */
	loadModulePath( profile = process.env.__WPI_PROFILE__ || "default" ) {
		let cfg           = this.getAllConfigs()[profile];
		let addModulePath = require('app-module-path').addPath;
		cfg.allModulePath.map(addModulePath)
	},
	/**
	 * Retrieve the inherited wp cfg for the given or current profile id
	 *
	 * @param profile {string} optional profile id
	 * @param head {boolean} use the current package config
	 * @returns {*}
	 */
	getSuperWebpackCfg( profile = process.env.__WPI_PROFILE__ || "default", head ) {
		let cfg = this.getAllConfigs()[profile],
		    wpCfg;
		
		if ( allCfgInstances[profile] )
			return allCfgInstances[profile];
		
		ModPathLoader(cfg.allModulePath, cfg.allWebpackCfg.map(fp => path.dirname(fp)))
		this.loadModulePath(profile);
		
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
	plugin( cfg, profile = process.env.__WPI_PROFILE__ || 'default' ) {
		return allPluginInstances[profile] = allPluginInstances[profile] || InheritPlugin(cfg, this.getAllConfigs()[profile])
	},
	/**
	 * Return a tester fn for the given or current profile id
	 * Tester return true if the given file path is outside inheritable dir
	 *
	 * @param profile {string} optional profile id
	 * @returns {{test: (function(*): boolean)}}
	 */
	isFileExcluded( profile = process.env.__WPI_PROFILE__ || 'default' ) {
		let allRoots = this.getAllConfigs()[profile].allRoots;
		return { test: ( path ) => !allRoots.find(r => path.startsWith(r)) }
	},
	/**
	 * Return the root directory of the head package
	 *
	 * @param profile {string} optional profile id
	 * @returns {*}
	 */
	getHeadRoot( profile = process.env.__WPI_PROFILE__ || 'default' ) {
		let allModuleRoots = this.getAllConfigs()[profile].allModuleRoots;
		return allModuleRoots[0]
	}
}