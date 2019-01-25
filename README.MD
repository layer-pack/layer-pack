# webpack-inherit

<a href="https://www.npmjs.com/package/webpack-inherit">
<img src="https://img.shields.io/npm/v/webpack-inherit.svg" alt="NPM" /></a>

What you can do with it :
- Inherit multiple projects ( using webpack-inherit )

 So you can override any files in you're project & use cool things like that :
```
import $super from "$super";
// or require('$super')
class MyOverrided extend $super{
//...
}
```

- Inherit a project with its webpack config, and use it on you're project

So you can put you'r config in some inheritable npm packages;
and switch them easily !

- Do glob require on inherited directory

So you can easily create/inherit modules & extensions and require them with some import("App/extensions/*.(js|scss)")

- Easily override node_modules
- Compile multiples inherited & versioned projects in 1 head package
- Etc...


This plugin is working, but still in beta stage  ( not well tested/optimized for now )<br/>

Feel free to test / feedback / make contribs<br/>

Check the samples here : https://github.com/n8tz/webpack-inherit-sample

## How to use ?

Add webpack-inherit to deps

```
npm i -s webpack-inherit // on all inheritable projects with wp conf & on the head project
```

Add in package.json :

```js
{
    {
   	"name"         : "daProject",
   	"version"      : "1.0.0",
   	"wpInherit"    : {
   		"default": {// default profile id
   			"rootFolder": "App",// local root that will be mapped on App/...
   			"extend"    : [
   				"parentProject" // parentProject must have wpInherit.default with his own extend value
   			]
   		},
   		// optionally we can define multiple profile
   		"api"    : {// same profiles must exist in all inherited project
   			"rootFolder": "App",
   			"config"    : "./webpack.config.api.js", // optional webpack config
   			"extend"    : [
   				"parentProject"
   			]
   		},
   		// optionally we can define profile with some wp config overrides
   		"Comp"   : {
   			"config": "./webpack.config.www.js",

   			// optional profile id to use in the inherited packages
   			"basedOn": "someSuperProfile_in_parents",

   			// optional vars used in the webpack config ( overrided by child/head package )
   			"vars"  : {
   				// all @optional


   				// override the root folder alias ( default to "App" )
   				// So all inner build inheritable files will be requierable using require("Comp/some/stuff")
   				"rootAlias"   : "Comp",

   				// make anything outside the inheritable folder external
   				// ( for nodes builds & components )
   				// * this could be a RegExp like "^(?!react|@babel)" but packed libs can require externalized
   				"externals"   : true,

   				"webpackPatch": {
   					/* some webpack config patch that will be merged using require('webpack-merge').smart */
   				}
   			},
   			"extend": [
   				"parentProject"
   			]
   		}
   	}
  //...
  devDependencies:{
    "parentProject":"^1.0.0"
  //...
  }
}
```

In wp configs :
```

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

Then you can use the wpi CLI to call the first inherited webpack config using the webpack bin of the same package

```
# from the head project
wpi # use webpack params here
# or
wpi-dev-server

# or using profiles

wpi :api # use webpack params here
# or
wpi-dev-server :anotherProfile
```

Or retrieve the config by creating a new webpack config :

webpack.config.js
```
var wpInherit = require('webpack-inherit');


module.exports = wpInherit.getSuperWebpackCfg();

//module.exports = wpInherit.getSuperWebpackCfg(/* "profileId" */);

```


## Caveats / bugs ?

- All devDependencies of inheritable packages must be move to normal deps in order to define theirs own webpack conf
- Context based webpack requires are not processed
- This plugin probably need some optimisations
- This plugin probably need some bugs fixes ( find them ! :) )

## Contributors ?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

<!-- BACKERS/ -->

<h2>Backers</h2>

<h3>Sponsors</h3>

Become a sponsor!

<span class="badge-paypal"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YNJZ6NQYVPTPE" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

