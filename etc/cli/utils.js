/*
 * Copyright 2021 BRAUN Nathanael
 *
 * Use of this source code is governed by an MIT-style
 * license that can be found in the LICENSE file or at
 * https://opensource.org/licenses/MIT.
 */
module.exports = {
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