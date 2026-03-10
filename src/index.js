/*
 * Copyright 2023 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file src/index.js
 *
 * Public API for layer-pack. Consumed by user webpack configs and the CLI commands.
 *
 * Typical usage in a webpack config:
 *
 *   const layerPack   = require('layer-pack');
 *   const lPackPlugin = layerPack.plugin();
 *   const lPackCfg    = layerPack.getConfig();
 *
 *   module.exports = {
 *     entry:   { App: lPackCfg.vars.rootAlias },
 *     output:  { path: layerPack.getHeadRoot() + '/dist/' },
 *     plugins: [ lPackPlugin ],
 *     module:  { rules: [{ test: /\.jsx?$/, exclude: layerPack.isFileExcluded() }] }
 *   };
 *
 * All methods accept an optional `profile` argument; when omitted they use the
 * `__LPACK_PROFILE__` environment variable (set by the `lpack` CLI) or `"default"`.
 */

const utils         = require("./utils"),
      Module        = require('module').Module,
      path          = require('path'),
      dMerge        = require('deep-extend'),
      lPackPlugin   = require("./layerPackPlugin"),
      ModPathLoader = require("../etc/node/loadModulePaths"),
      merge         = require('webpack-merge');
const fs = require("fs");

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
	 * Load and return the resolved webpack configuration array for the given profile.
	 * The config is loaded from the first layer that defines one (head project first),
	 * unless `head` is false, in which case the *second* config in the chain is used
	 * (the parent layer's config). This is how the `etc/wp/webpack.config.js` proxy
	 * exposes a parent layer's config to the head project.
	 *
	 * Also activates layer-aware Node module resolution via `loadWpPaths` before
	 * requiring the webpack config, so loaders and plugins resolve correctly.
	 *
	 * Results are memoised per profile to avoid re-loading on multiple calls.
	 *
	 * @param {string}  [profile] - Profile ID (defaults to `__LPACK_PROFILE__` or `"default"`)
	 * @param {boolean} [head]    - If true, load the head project's own webpack config
	 * @returns {object[]} - Array of webpack configuration objects
	 */
	getSuperWebpackCfg( profile = process.env.__LPACK_PROFILE__ || "default", head ) {
		let cfg = this.getConfig(profile),
		    wpCfg, wpModsPath;

		if ( allCfgInstances[profile] )
			return allCfgInstances[profile];

		// Prefer .layer_modules/node_modules if present (set up by lpack-setup for
		// packages inside node_modules), otherwise fall back to the standard node_modules.
		if ( !fs.existsSync(cfg.allWebpackRoot[0] + "/.layer_modules/node_modules") ) {
			wpModsPath = path.normalize(cfg.allWebpackRoot[0] + "/node_modules")
		}
		else {
			wpModsPath = path.normalize(cfg.allWebpackRoot[0] + "/.layer_modules/node_modules")
		}
		ModPathLoader.loadWpPaths(cfg.allModulePath, [wpModsPath]);
		
		try {
			if ( !head && cfg.allCfg[0].config && cfg.allWebpackCfg[1] )
				wpCfg = require(cfg.allWebpackCfg[1]);
			else
				wpCfg = require(cfg.allWebpackCfg[0]);
			
			if ( cfg.vars.webpackPatch ) {
				wpCfg = wpCfg.map(cfgItem => merge.merge(cfgItem, cfg.vars.webpackPatch));
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
	 * Return a tester function suitable for webpack's `exclude` option.
	 * Returns `true` (excluded) for any file path that does NOT start with one of the
	 * layer roots — i.e. any file outside the inheritance chain that should not be
	 * transpiled by loaders such as babel-loader.
	 *
	 * The returned function also has a `.test` property pointing to itself so it can
	 * be used with webpack's RegExp-style exclude API.
	 *
	 * @param {string} [profile] - Profile ID
	 * @returns {Function & { test: Function }}
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
