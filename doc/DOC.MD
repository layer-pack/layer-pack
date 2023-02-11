<h1 align="center">layer-pack</h1>
<h1></h1>
<p align="center">
<a href="https://www.npmjs.com/package/layer-pack">
<img src="https://img.shields.io/npm/v/layer-pack.svg" alt="NPM" /></a>
<a href="https://travis-ci.org/n8tz/layer-pack-samples">
<img src="https://travis-ci.org/n8tz/layer-pack-samples.svg?branch=master" alt="Build Status" /></a>
<img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>


# How to use

The simpler is to start from a  sample & update its deps.

Samples [here](https://github.com/n8tz/layer-pack-samples)

## Create & inherit packages

Add layer-pack to packages deps

```bash
npm i -s layer-pack // on all inheritable projects with wp conf & on the head project
```

Then, layer-pack need a file with a configuration for each build profiles.

Add a ".layers.json" file near the package.json of each projects :

```jsx
{
   		"default": {// default profile id

   		    // local root that will be mapped on App/...
   			"rootFolder": "App",

   			"extend"    : [
   				"parentProject" // parentProject must have layerPack.default with his own extend value & be in node_modules or in "libsPath" value
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
   			// all theses values are available in the webpack config using lPackCfg.vars.*
   			"vars"  : {
   				// all @optional

   				// override the root folder alias ( default to "App" )
   				// So all inner build inheritable files will be requierable using require("Comp/some/stuff")
   				"rootAlias"   : "MyApp",

   				// make anything outside the inheritable folder external
   				// ( for nodes builds & components )
   				// * this could be a RegExp like "^(?!react|@babel)" but packed libs can require externalized
   				"externals"   : true,
				
                // (node only) make external requiered modules using pre resolved relative paths when requiered from the build 
                // ex. : require('my_module') -> require('../../node_modules/my_module/index.js')
				"hardResolveExternals": true,
                
   				"production"   : true,
   				
   				"someValues"   :{
   				    // lPack apply simple tpl on the vars
   				    // here the available values :
   				    // packagePath   : the path of the package associated with this config file
   				    // projectPath   : the path of the head project
   				    // packageConfig : package.json of the head project
   				    "withSomeTemplatedValues" : "<%packagePath%>/AppStatic/index.html.tpl"

   				},
   				// webpack config patch (applied using webpack-merge)
                "webpackPatch": {
                
                }
   				
   			},
   			"extend": [
   				"parentProject"
   			]
   		}
}
```

## Using layer-pack in the webpack configs

Example webpack config :

```es6
const layerPack  = require('layer-pack'),
      lPackPlugin  = layerPack.plugin(/* json in .layers.json can be directly used here */),
      lPackCfg     = layerPack.getConfig(),
      isExcluded = layerPack.isFileExcluded();
      
module.exports = [
	{
		entry: {
		    // App entry point default lPackCfg.vars.rootAlias is 'App' wich will be resolved as App/index.js
		    // * we can also use glob ( eg: App/ep/*.js )
			App: lPackCfg.vars.rootAlias
		},

		output: {
		    // As the config can be in an external npm package the plugin give the project path  
			path      : layerPack.getHeadRoot() + "/dist/",
		},

		plugins: [
			lPackPlugin
			//... 
		],

		module: {
			rules: [
				{
					test   : /\.jsx?$/,
					// required while inheriting code from npm packages
					exclude: layerPack.isFileExcluded()
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
								importer  : lPackPlugin.sassImporter(/* add others importers here */),
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

Also, Webpack config from a parent package profile can be override using "proxy" webpack cfg :

webpack.config.js
```jsx
var layerPack = require('layer-pack');


let wpCfg = layerPack.getSuperWebpackCfg(/* "profileId" */);

/* extend the conf from parent */

module.exports = wpCfg;

```

## Setup layers for development ( install inherited layers devDependencies )

DevDependencies of dependencies are not installed, so there 2 options :

- layer-pack can install them, using the following command : 

```bash
# from the leaf project layers:
npm i

# then: 

lpack-setup # npm all inherited layers using "default" profile

lpack-setup :www # the same for the "www" profile layers

lpack-setup :www ci # setup with npm ci
#lpack-setup :profile (npm command) # setup with specific npm command

lpack :? # get available profiles
```
- Or, you can install them, starting from the root layers

## CLI

The layer-pack CLI just call the webpack CLI basing the specified profile id.<br>
If the webpack conf reside in an inherited package, the webpack of the same inherited package will be executed.<br>
Default profile id is "default"

```bash
# from the head project
lpack # use webpack params here
# or
lpack-dev-server

# or using profiles

lpack :api # use webpack params here
# or
lpack-dev-server :anotherProfile


lpack :? # get available profiles
```

## Requiring glob & file tree

When using glob with require or es6 import, the plugin generate a virtual file on the fly.<br>
Basing the string captured by the parenthesis, the plugin generate es6 named exports.

- If the captured string contain "/" or  "\\", it will split and walk & set in JS way
- If it contain invalid JS variable identifier it will not be available as named export (only in the default export)

Ex :
```jsx harmony

import Comps from "App/components/(**/*).jsx";
// if a file match App/components/(media/VideoPlayer).jsx
console.log(Comps);
// it will contain { Comps : { media : VideoPlayer } }

import AllActionsByFolder from "App/store/(*)/actions.js";
// or
import {MyCompByFileName} from "App/ui/components/(*).jsx"; // ( big import list to maintain ) no more ! :)
// or
import {myFolder} from "App/ui/components/(**/*).jsx"; // ( walk & set myFolder/MyComp in myFolder.MyComp )
```

Glob imports generate virtual files "just in time".

These files do named exports & use an unique file name, so same glob import use the same files.


## More about building with inherit

### .buildInfos.json

layer-pack add a virtual file with some build info in the root folder.
It's called ".buildInfos.json" & contain the following infos :

```
{
    /* from the project package.json file */
    project    : {
        name
        description
        author
        version
    },
    /* the profile id used to build */
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


[![*](https://www.google-analytics.com/collect?v=1&tid=UA-82058889-1&cid=555&t=event&ec=project&ea=view&dp=%2Fproject%2Flayer-pack&dt=doc)](#)
