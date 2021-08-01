/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
let layerPack = require('../..'),
    is        = require('is'),
    cfg       = layerPack.getSuperWebpackCfg(process.env.__LPACK_PROFILE__, true);

if ( !is.array(cfg) )
	cfg = [cfg];

cfg = cfg.map(
	cfg => (
		{
			...cfg,
			context: layerPack.getHeadRoot(process.env.__LPACK_PROFILE__)
		}
	)
)

module.exports = cfg;