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

Samples [here](https://github.com/n8tz/webpack-inherit-sample)

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

   			"extend"    : [
   				"parentProject" // parentProject must have wpInherit.default with his own extend value & be in node_modules or in "libsPath" value
   			]
   		},
   		// optionally we can define multiple profile
   		"api"    : {// profiles extend same profile id from inherited packages, if it does'nt exist default will be used 
   			"rootFolder": "App",

   			// optional folder containing libs overrides for dev purposes
   			// ( these libs will have precedence over node_modules )
   			// ( can contain inherited packages )
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
const wpInherit  = require('webpack-inherit'),
      wpiPlugin  = wpInherit.plugin(/* json in .wi.conf can be directly used here */),
      wpiCfg     = wpInherit.getConfig(),
      isExcluded = wpInherit.isFileExcluded();
      
module.exports = [
	{
		entry: {
		    // App entry point default wpiCfg.vars.rootAlias is 'App' wich will be resolved as App/index.js
		    // * we can also use glob ( eg: App/ep/*.js )
			App: wpiCfg.vars.rootAlias
		},

		output: {
		    // As the config can be in an external npm package the plugin give the project path  
			path      : wpInherit.getHeadRoot() + "/dist/",
		},

		plugins: [
			wpiPlugin
			//... 
		],

		module: {
			rules: [
				{
					test   : /\.jsx?$/,
					// required while inheriting code from npm packages
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
								importer  : wpiPlugin.sassImporter(/* add others importers here */),
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

The webpack-inherit CLI just call the webpack CLI basing the specified profile id.<br>
If the webpack conf reside in an inherited package, the webpack of the same inherited package will be executed.<br>
Default profile id is "default"

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

When using glob with require or es6 import, the plugin generate a virtual file on the fly.<br>
Basing the string captured by the parenthesis, the plugin generate es6 named exports.

- If the captured string contain "/" or  "\\", it will be walk & set in JS way
- If it contain invalid variable identifier it will not be available as named export (only in the default export)

Ex :
```jsx harmony

import Comps from "App/components/(**/*).jsx";
// if a file match App/components/(media/VideoPlayer).jsx
console.log(Comps);
// it will contain Comps.media.VideoPlayer

import AllActionsByFolder from "App/store/(*)/actions.js";
// or
import {MyCompByFileName} from "App/ui/components/(*).jsx"; // ( big import list to maintain ) no more ! :)
// or
import {myFolder} from "App/ui/components/(**/*).jsx"; // ( walk & set myFolder/MyComp in myFolder.MyComp )
```

## More about building with inherit

### .wpiConfig.json

webpack-inherit add a virtual file with some build info in the root folder.
It's called ".wpiConfig.json" & contain the following infos :

```
{
    /* from the package.json file */
    project    : {
        name
        description
        author
        version
    },
    /* the profile id */
    profile,
    /* the timestamp when the build has been made */
    buildDate,
    /* the original root of the project */
    projectRoot,
    /* the merged vars of the profile */
    vars,
    allCfg,
    allModId
}
```

### Glob resolving

Glob imports generate virtual files "just in time".

These files do named exports & use an unique file name, so same glob import use the same files.
