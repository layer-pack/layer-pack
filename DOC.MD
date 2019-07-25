<h1 align="center">webpack-inherit</h1>
<h1></h1>
<p align="center">
<a href="https://www.npmjs.com/package/webpack-inherit">
<img src="https://img.shields.io/npm/v/webpack-inherit.svg" alt="NPM" /></a>
<a href="https://travis-ci.org/n8tz/webpack-inherit-samples">
<img src="https://travis-ci.org/n8tz/webpack-inherit-samples.svg?branch=master" alt="Build Status" /></a>
<img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>


# How to use

## Create & inherit packages

Add webpack-inherit to packages deps

```bash
npm i -s webpack-inherit // on all inheritable projects with wp conf & on the head project
```

Add a ".wi.json" file near the package.json of each projects :

```jsx
{
   		"default": {// default profile id

   		    // local root that will be mapped on App/...
   			"rootFolder": "App",

   			// optional list of templates folder to init an app / comp
   			"templates": {
   			    "default":"./templates/ssrApp",
   			    "ssrApp":"./templates/ssrApp"
   			},
   			"extend"    : [
   				"parentProject" // parentProject must have wpInherit.default with his own extend value & be in node_modules or in "libsPath" value
   			]
   		},
   		// optionally we can define multiple profile
   		"api"    : {// same profiles must exist in all inherited project
   			"rootFolder": "App",

   			// optional folder containing libs overrides for dev purposes
   			// ( these libs will have precedence over node_modules )
   			//
   			// /!\ Use this to hard patch bugged npm libs or add work in progress libs /!\
   			// /!\ should not be used unless there no other solutions /!\
   			// /!\ (& overrided lib version must be fixed) /!\
   			"libsPath": "./libs",

   			// optional webpack config
   			"config"    : "./webpack.config.api.js",

   			"extend"    : [
   				"parentProject"
   			]
   		},
   		// optionally we can define profile with some wp config overrides
   		"Comp"   : {
   			"config": "./webpack.config.www.js",

   			// optional profile id to use in the inherited packages
   			"basedOn": "someSuperProfile_in_parents",

   			// optional vars
   			"vars"  : {
   				// all @optional

   				// override the root folder alias ( default to "App" )
   				// So all inner build inheritable files will be requierable using require("Comp/some/stuff")
   				"rootAlias"   : "MyApp",

   				// make anything outside the inheritable folder external
   				// ( for nodes builds & components )
   				// * this could be a RegExp like "^(?!react|@babel)" but packed libs can require externalized
   				"externals"   : true,

   				// all theses values are available in the webpack config using wpiCfg.vars.*
   			},
   			"extend": [
   				"parentProject"
   			]
   		}
}
```

## Using webpack-inherit in the webpack configs

Add the following webpack config :

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

Also, Webpack config from a parent package profile can be overrided  :

webpack.config.js
```jsx
var wpInherit = require('webpack-inherit');


let wpCfg = wpInherit.getSuperWebpackCfg(/* "profileId" */);

/* extend the conf from parent */

module.exports = wpCfg;

```

## CLI


```bash
# from the head project
wi # use webpack params here
# or
wi-dev-server

# or using profiles

wi :api # use webpack params here
# or
wi-dev-server :anotherProfile


wi :? # get available profiles
```


## Requiring glob & file tree
## Multi package, monorepo & code sharing

# How it works

## Dependencies & profiles
## Resolving
## Virtual index files (glob)

