<h1 align="center">webpack-inherit</h1>
<h1></h1>

Example webpack config :
```es6

var wpInherit = require('webpack-inherit');

module.exports = [
	{
		// The jsx App entry point
		entry: {
		    // App entry point default wpiCfg.vars.rootAlias is 'App' wich will be resolved as App/index.js
		    // * we can also use glob ( eg: App/ep/*.js )
			App: wpiCfg.vars.rootAlias
		},

		// The resulting build
		output: {
			path      : wpInherit.getHeadRoot() + "/dist/",
		},

		// Global build plugin & option
		plugins: (
			[
				wpInherit.plugin(),
			]
		),

		module: {
			rules: [
				{
					test   : /\.jsx?$/,
					exclude: wpInherit.isFileExcluded()
					//...
				}
				//...

				{
					test: /\.(scss|css)$/,
					use : [
				        //...
						{
							loader : "sass-loader",
							options: {
								importer  : wpInherit.plugin().sassImporter(/* add others importers here */),
							}
						}
					]
				}
				//...
			]
		}
		//...
	}
	//...
]
```
