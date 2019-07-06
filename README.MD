
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
this is beta; feel free to test / feedback / make contribs<br/>
</p>


## What you can do with it :

### Do glob require on inherited directories

So you can easily create/inherit modules & extensions and require them using :

```jsx
import allModules from "App/modules/*.module.js";
// or
// import allModules from "App/modules/*/index.js";
// or
// import AllActions from "App/store/(*)/actions.js";
// or
// import {MyCompByFileName} from "App/ui/components/(*).jsx"; // ( big import list to maintain ) no more ! :)
// or
// import {myFolder} from "App/ui/components/(**/*).jsx"; // ( walk & set myFolder/MyComp in myFolder.MyComp )
```

```scss

@import "App/modules/*.module.scss"; // 1 import to rulz them all

```

### Split you're projects into multiple inheritable npm packages  

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

### Inherit, use & extend multiple webpack config from dependencies packages

So you can share, version, extend & switch your webpack conf & boilerplate via npm

### Namespace you're application

So you can stop using easily broken relative imports :
```jsx
// import stuff from "../../../config"; // no more
import stuff from "App/config"; // aw yeah
```


### Even more :

- Share unique build conf package between projects, modules & extensions
- Combine projects with different namespaces in 1 head package
- Easily override node_modules ( drop a module in a "lib directory" & dev/test you're patchs )
- Etc...

## Check the samples [here](https://github.com/n8tz/webpack-inherit-sample)

## How to use ?

Add webpack-inherit to deps

```bash
npm i -s webpack-inherit // on all inheritable projects with wp conf & on the head project
```

Add a ".wi.json" file near the package.json :

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

## Contributors ?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

<!-- BACKERS/ -->

<h2>Backers</h2>

<h3>Sponsors</h3>

Become a sponsor!

<span class="badge-paypal"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YNJZ6NQYVPTPE" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

