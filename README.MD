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
- Easily override node_modules

This plugin is working, but still in beta stage  ( not well tested/optimized for now ),<br/>
Samples come here : https://github.com/n8tz/webpack-inherit-sample ( actually the only doc )

## How to use ?

Add webpack-inherit to deps

```
npm i -s webpack-inherit // on all inheritable projects with wp conf & on the head project
```

Add in package.json :
```
{
  "name": "daProject",
  "version": "1.0.0",
  "wpInherit": {
    "default": {
      "rootFolder": "App",// local root that will be mapped on App/...
      "extend": [
        "parentProject" // parentProject must have wpInherit.default with his own extend value
      ]
    }
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
			App: 'App'
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

```


## Caveats / bugs ?

- All inherited dir are accessible using require('App/...')
- All devDependencies of inheritable packages must be move to normal deps in order to define webpack conf
- Context based webpack requires are not processed
- In some case webpack need to be restarted when adding/removing some file from App/*
- This plugin probably need some optimisations
- This plugin probably need some bugs fixes ( find them ! :) )


## Contributors ?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

<!-- BACKERS/ -->

<h2>Backers</h2>

<h3>Sponsors</h3>

Become a sponsor!

<span class="badge-paypal"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YNJZ6NQYVPTPE" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

