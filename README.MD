
<p align="center"><img  width="192" src ="https://github.com/layer-pack/layer-pack/raw/master/doc/assets/logo.svg?sanitize=true" /></p>
<br/>
<p align="center">
Webpack plugin to make inheritable code layers, named glob imports, easy monorepo / multi packages app & shared webpack configs
</p>
<h1></h1>
<p align="center">
<a href="https://www.npmjs.com/package/layer-pack">
<img src="https://img.shields.io/npm/v/layer-pack.svg" alt="NPM" /></a>
<a href="https://travis-ci.org/n8tz/layer-pack-samples">
<img src="https://travis-ci.org/n8tz/layer-pack-samples.svg?branch=master" alt="Build Status" /></a>
<img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>

## Why Layer-pack ?

Layer-pack is a webpack plugin allowing better code modularity, maintainability and flexibility by solving some of the most major problems of large JS/TS applications :

- The first one, we often have to multiply internal imports in the project files. This usually leads to complex maintenance and (too) many import and require statements.
- The second is that we cannot easily "extend" an existing application, we are still forced to create various interfacing systems and APIs, maintain separates build configurations and dependencies lists.

Layer pack solve these problems and many others by enhancing imports & resolving :

- It allows to use glob patterns in import & requires statements
  - So we can import files and a directory tree without specifying all of their names. Yes, just paste files & play mode :)
- It literally allows to "inherit" packages or "app layers", including theirs dependencies and webpack build configurations
  - So you can easily & smartly split you're app in some "app layer" like : app.core, app.models, app.www, app.api, app.admin, app.config... 
- It "namespaces" the application files
  - So we can use absolute imports where we shouldn't use relative paths,
- Additionally, it allows to "templatize" webpack build configs and define multiples "inheritable" profiles on a unique "app layer" package.
  - This mean that a unique package can expose multiples layers or bootstraps

## Check the samples [here](https://github.com/n8tz/layer-pack-samples)

## Small doc [here](doc/DOC.MD)

## You... like it / it saved your day / you stole all the code / you want more?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

BTC     : bc1qh43j8jh6dr8v3f675jwqq3nqymtsj8pyq0kh5a<br/>
Paypal  : <span class="badge-paypal"><a href="https://www.paypal.com/donate/?hosted_button_id=ECHYGKY3GR7CN" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>


## Features by samples :

### Namespace you're application

So you can stop using easily broken relative imports :

```jsx
// import stuff from "../../../config"; // no more
import stuff from "App/config"; // aw yeah
```

### Use glob patterns in imports statements

Just import them all :

```jsx
import allModules from "App/modules/*.module.js";
// or
// import allModules from "App/modules/*/index.js";
```

Just import them all and convert directories & files names to JS named exports :

```jsx
// or using es6 named exports
import AllActionsByStoreName from "App/store/(*)/actions.js";
// or
import {MyCompByFileName} from "App/ui/components/(*).jsx"; // ( big import list to maintain ) no more ! :)
// or
import {myFolder} from "App/ui/components/(**/*).jsx"; // ( walk & set myFolder/MyComp in myFolder.MyComp )
```

Glob imports also work in Scss :

```scss

@import "App/ui/**/*.scss"; // 1 import to rulz them all

```

### Split you're projects into multiple inheritable npm packages 

- inherit & share most of the code between projects
- Include or not layers like dev tools, admin, etc
- Switch between monorepo and npm dependencies structure
- Test layers independently
- Compile in 1 step, with the source map
- Use multiple dev servers sharing the same code layers

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

## Check the samples [here](https://github.com/n8tz/layer-pack-samples)

## Small doc [here](doc/DOC.MD)

## Things to know

- Node builds include the (node_)modules relative directories locations to preserve inherited dependencies ( if they are not included in the builds )
- Sass imports have limitations from the sass package: it doesn't tell the files path that call imports, so scss files must import using absolute paths ( eg: App/assets/stuff.jpg, not ./assets/stuff.jpg )
- Context based webpack requires are not processed by layer-pack, they have the normal webpack behavior
- New versions of Yarn mess too much with the modules structure, resolving & management, it can't be used with layer-pack anymore  
 
## Alternative to

 - Splitting big projects in thousands of modules
 - Lerna, others mono-repo tool chains & defining messy npm/yarn aliases / namespaces ...

## Contributors ?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

<!-- BACKERS/ -->

<h3>Sponsors</h3>

Become a sponsor!

<span class="badge-paypal"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YNJZ6NQYVPTPE" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
[![*](https://www.google-analytics.com/collect?v=1&tid=UA-82058889-1&cid=555&t=event&ec=project&ea=view&dp=%2Fproject%2Flayer-pack&dt=readme)](#)

## You... like it / it saved your day / you stole all the code / you want more?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

BTC     : bc1qh43j8jh6dr8v3f675jwqq3nqymtsj8pyq0kh5a<br/>
Paypal  : <span class="badge-paypal"><a href="https://www.paypal.com/donate/?hosted_button_id=ECHYGKY3GR7CN" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
