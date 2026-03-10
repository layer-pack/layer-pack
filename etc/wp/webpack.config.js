/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/**
 * @file etc/wp/webpack.config.js
 *
 * Proxy webpack configuration used by the `lpack` and `lpack-dev-server` CLI commands.
 * This file is always passed as the `--config` argument to webpack, regardless of where
 * the actual build configuration lives in the layer inheritance chain.
 *
 * It delegates to `layerPack.getSuperWebpackCfg()`, which:
 *  1. Loads the merged profile config for `__LPACK_PROFILE__`
 *  2. Requires the webpack config from the first layer that defines one for this profile
 *  3. Applies any `vars.webpackPatch` overrides via webpack-merge
 *
 * The `context` property is always overridden to point at the head project root so that
 * webpack resolves entry points and assets relative to the head project, not the layer
 * package that owns the config.
 *
 * The `head: true` flag passed to `getSuperWebpackCfg` tells it to load the head
 * project's own webpack config rather than delegating to a parent layer.
 */
let layerPack = require('../..'),
    is        = require('is'),
    cfg       = layerPack.getSuperWebpackCfg(process.env.__LPACK_PROFILE__, true);

// Normalise to array — webpack accepts both a single config object and an array.
if ( !is.array(cfg) )
	cfg = [cfg];

// Force the webpack context to the head project root so relative entry paths and
// loader rules resolve correctly when the config is inherited from a parent layer.
cfg = cfg.map(
	cfg => (
		{
			...cfg,
			context: layerPack.getHeadRoot(process.env.__LPACK_PROFILE__)
		}
	)
)

module.exports = cfg;