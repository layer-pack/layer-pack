/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */

/** Shared utilities used by the layer-pack CLI commands. */
module.exports = {
	/**
	 * Format a human-readable summary of all available build profiles and their
	 * key settings. Printed when `lpack :?` is run or when an unknown profile is requested.
	 *
	 * @param {{ [profileId: string]: object }} configs - Output of `lpack.getAllConfigs()`
	 * @returns {string} - Formatted profile listing
	 */
	printProfilesInfos: function printProfilesInfos( configs ) {
		let out = "\nHere the available profiles :\n\r\n\r";
		Object.keys(configs)
		      .forEach(
			      profileId => {
				      out += "\t" + profileId +
					      (!configs[profileId].allWebpackCfg[0] ?
					       " (no webpack cfg)" :
					       " using rootAlias '" + configs[profileId].vars.rootAlias + "'"
					      ) +
					      (configs[profileId].allModId[0] ?
					       " inheriting : " + configs[profileId].allModId[0] + ":" + (configs[profileId].allCfg[0].basedOn || profileId)
					                                      :
					       ""
					      ) + "\r\n";
			      }
		      )
		return out;
	}
}