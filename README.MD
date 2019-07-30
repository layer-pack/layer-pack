
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
<a href="https://travis-ci.org/n8tz/webpack-inherit-samples">
<img src="https://travis-ci.org/n8tz/webpack-inherit-samples.svg?branch=master" alt="Build Status" /></a>
<img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>

<p align="center">
This is solid beta; Feel free to test / feedback / make contribs<br/>
</p>


## What you can do with it :

### Split you're projects into multiple inheritable npm packages

So you can easily :
- inherit & share most of the code between projects
- Include or not inherit like dev tools, admin, etc
- Switch between monorepo and npm dependencies structure
- Test inherit independently
- Compile in 1 step, with the source map

### Do glob require on inherited directories ( from local or node_modules packages )

So you can easily create/inherit modules & extensions and require them using :

```jsx
import allModules from "App/modules/*.module.js";
// or
// import allModules from "App/modules/*/index.js";
// or using es6 named exports
// import AllActions from "App/store/(*)/actions.js";
// or
// import {MyCompByFileName} from "App/ui/components/(*).jsx"; // ( big import list to maintain ) no more ! :)
// or
// import {myFolder} from "App/ui/components/(**/*).jsx"; // ( walk & set myFolder/MyComp in myFolder.MyComp )
```

```scss

@import "App/modules/*.module.scss"; // 1 import to rulz them all

```

### Namespace you're application

So you can stop using easily broken relative imports :
```jsx
// import stuff from "../../../config"; // no more
import stuff from "App/config"; // aw yeah
```

### Easily override inherited project

By enhancing / replacing any file

```jsx
import $super from "$super";// require the 1st file with the same path name in the inherited packages

// Add some stuff or HOCs fn
export default class MyOverrided extend $super{
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


### Even more :

- Combine projects with different namespaces in 1 head package
- Easily override node_modules ( drop a module in a "lib directory" & dev/test you're patchs )
- Etc...

## Check the samples [here](https://github.com/n8tz/webpack-inherit-sample)

## Draft doc [here](DOC.MD)

## Caveats / bugs ?

- Remember that devDependencies of dependencies are NOT installed so inherit should only use (peer)Dependencies
- inherit deal with the deps resolving order, even if inherit are in the libPath folder. That's said, when compiling for node the relative paths to the externals libs directories are hard written
- Context based webpack requires are not processed
- Actually hot reload don't detect new files overriding an inherited layer file & files deleted from a glob include
- This plugin probably need some optimisations

## Contributors ?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

<!-- BACKERS/ -->

<h2>Backers</h2>

<h3>Sponsors</h3>

Become a sponsor!

<span class="badge-paypal"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YNJZ6NQYVPTPE" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>

