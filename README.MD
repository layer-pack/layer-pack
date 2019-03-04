
<h1 align="center">webpack-inherit</h1>
<br/>
<p align="center">
Webpack plugin for better code pipelines & architectures.<br/>
Allows to easily namespace, compose, extend and build your Webpack projects using shared and versioned configs
</p>
<h1></h1>
<p align="center">
<a href="https://www.npmjs.com/package/webpack-inherit">
<img src="https://img.shields.io/npm/v/webpack-inherit.svg" alt="NPM" /></a>
<img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>

<p align="center">
/!\ This awesome plugin is working, but still in beta stage  ( not well tested/optimized for now ) /!\
</p>
<p align="center">
Feel free to test / feedback / make contribs<br/>
</p>


## What you can do with it :

### Inherit multiple source tree in the same namespace

So you can easily override & extend any files in a project, share most of the code between them & use cool things like that :

```jsx
import $super from "$super";

// Add some stuff or HOCs fn
class MyOverrided extend $super{
//...
}
```

```scss
@import "$super";

// do some css additions
.theSameWithA{
    backgroud : red;
}
```

### Inherit and/or extend webpack config from dependencies packages, and use it on you're project

So you can put your configuration in some npm packages and easily extend / switch them !

### Namespace you're application

So you can stop using easily broken relative imports :
```jsx
// import stuff from "../../../config"; // no more
import stuff from "App/config"; // aw yeah
```

### Do glob require on inherited directory

So you can easily create/inherit modules & extensions and require them using :

```jsx
import allModules from "App/modules/*.module.js";
// or import allModules from "App/modules/*/index.js";
```

```scss

@import "App/modules/*.module.scss"; // 1 import to rulz them all

```

### Even more :

- Share unique build conf package between projects, modules & extensions
- Combine projects with different namespaces in 1 head package
- Easily override node_modules
- Etc...

## Check the samples [here](https://github.com/n8tz/webpack-inherit-sample)

## How to use ?

Add webpack-inherit to deps

```bash
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

   		    // local root that will be mapped on App/...
   			"rootFolder": "App",

   			// optional list of templates folder to init an app / comp
   			"templates": {
   			    "default":"./templates/ssrApp"
   			    "ssrApp":"./templates/ssrApp"
   			},
   			"extend"    : [
   				"parentProject" // parentProject must have wpInherit.default with his own extend value
   			]
   		},
   		// optionally we can define multiple profile
   		"api"    : {// same profiles must exist in all inherited project
   			"rootFolder": "App",

   			// optional folder containing libs overrides for dev purposes
   			// ( these libs will have precedence over node_modules )
   			//
   			// /!\ Use this to hard patch bugged npm libs /!\
   			// /!\ theirs node_modules ( ./libs/*/node_modules ) will be ignored /!\
   			// /!\ should not be used unless there no other solutions /!\
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
  //...
  devDependencies:{
    "parentProject":"^1.0.0"
  //...
  }
}
```

In wp configs :
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

Then you can use the wpi CLI to call the first inherited webpack config using the webpack bin of the same package

```bash
# from the head project
wpi # use webpack params here
# or
wpi-dev-server

# or using profiles

wpi :api # use webpack params here
# or
wpi-dev-server :anotherProfile


wpi :? # get available profiles
```

Or create a new webpack config, directly usable with the webpack cli, to make some additions :

webpack.config.js
```jsx
var wpInherit = require('webpack-inherit');


let wpCfg = wpInherit.getSuperWebpackCfg(/* "profileId" */);

/* extend the conf from parent */

module.exports = wpCfg;

```

## Extra ?

Wpi allow to define bootstrap templates to create new projects easily (experimental) :

Here how to init a new project :
```
$ wpi-init -h
   Create a new project using wpi :
   Syntax : wpi-init project_name inheritedPackage::profileId:templateId
    ( Or ): wpi-init project_name inheritedPackage (using default profile & default template

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

