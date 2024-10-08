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

## The quick way

Choose a sample that meet you're needs [here](https://github.com/n8tz/layer-pack-samples) and play :)

## Mini doc

### A complete root inheritable package example

[Here a forkable inheritable package example](https://github.com/layer-pack/lpack-react), which use & provide :
- Webpack 5, Sass, React, Express etc...
- SSR, shared Front/back code,
- Bootstraps & build configs for node, browsers, static websites and components

### How to make & config inheritable package

To be usable as an "inheritable layer", a npm/git/local module need :
- To have layer-pack in its packages.json dev deps, obviously

```bash
npm i -D layer-pack // on all inheritable projects with wp conf & on the head projects
```

Additionally, all layers containing webpack configs needs to have the webpack, webpack-cli & webpack-dev-server as dev deps.

- To have a ".layers.json" or ".layers.js" near its packages.json

This file describe the different available build profiles & build scripts

Here a commented sample :

```jsx
{
  // each root key is a profile
  // the "default" profile is used if no profile is asked
  // profiles extend the same profile id from inherited layers, 
  // if it does'nt exist default will be used ( but it will still search for the same profile in the next inherited layers ) 
  "default": {

    // local source code root that will be mapped on App/...
    "rootFolder": "App",

    // optional folder(s) containing libs overrides for dev or monorepo purposes
    // * Libs in theses paths will have precedence over the node_modules directories
    // * They can also contain the inherited layers
    "libsPath": ["./libs"],
            
    // list of the inherited layers in theirs layer precedence order ( 1st layer override 2nd & so on )
    "extend": [
      "parentProject"
      // parentProject must have layerPack.default with his own extend value & be in node_modules or in "libsPath" value
    ]
  },
 
  "api": {
    "rootFolder": "App",

            // webpack config to use with this profile
    "config": "./webpack.config.api.js",
            
    "extend": [
      "parentProject"
    ]
  },
  "Comp": {
    // webpack config to use with this profile
    "config": "./webpack.config.www.js",
    // optional profile id to search in the inherited packages
    "basedOn": "someSuperProfile_in_parents",
    // optional vars
    // all theses values are available in the webpack config using lPackCfg.vars.*
    // Theses values will override thoses from the parent layers
    "vars": {
      // all @optional

      // override the root folder alias ( default to "App" )
      // So all inner build inheritable files will be requierable using require("MyApp/some/stuff")
      "rootAlias": "MyApp",
      // make anything outside the inheritable folder external
      // ( for nodes builds & components )
      // * this could be a RegExp like "^(?!react|@babel)" but packed libs can require externalized
      "externals": true,
      // (node only) make external requiered modules using pre resolved relative paths when requiered from the build 
      // ex. : require('my_module') -> require('../../node_modules/my_module/index.js')
      "hardResolveExternals": true,
      // should be mapped to webpack::config.production
      "production": true,
      "someValues": {
        // lPack apply simple tpl on the vars
        // here the available values :
        // packagePath   : the path of the package associated with this config file
        // projectPath   : the path of the head project
        // packageConfig : package.json of the head project
        "withSomeTemplatedValues": "<%packagePath%>/AppStatic/index.html.tpl"
      },
      // webpack config patch (applied using webpack-merge)
      "webpackPatch": {}
    },
    "extend": [
      "parentProject"
    ]
  },
  // Use the "default" profile def, but inherit the "someAliase" profile
  "someAliase":"default"
}
```

_.layers.json can be replaced with a .layers.js exporting the profiles conf, so we can also add webpack plugins via
the "webpackPatch" prop_

### Using layer-pack in the webpack configs

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

### Setup layers for development ( install inherited layers devDependencies )

DevDependencies of dependencies are not installed, so dev dependencies of the inherited layers must be installed, there 2 options for that :

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

- Or if you use a monorepo structure by using the "libsPath" option, you can install them yourself ( in this case putting the app layer in the
  package.json is useless )

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
- If it contains invalid JS variable identifier it will not be available as named export (only in the default export)

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
import {myFolder}         from "App/ui/components/(**/*).jsx"; // ( walk & set myFolder/MyComp in myFolder.MyComp )
```

Glob imports generate virtual files "just in time".

These files do named exports & use an unique file name, so same glob import use the same files.

## .buildInfos.json

layer-pack add a virtual file with some build info in the root folder.
It's called ".buildInfos.json" & contain the following values :

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
