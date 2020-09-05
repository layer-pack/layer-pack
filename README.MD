
<p align="center"><img  width="192" src ="https://github.com/layer-pack/layer-pack/raw/master/doc/assets/logo.svg?sanitize=true" /></p>
<br/>
<p align="center">
Easily split webpack projects into multiple npm packages
</p>
<h1></h1>
<p align="center">
<a href="https://www.npmjs.com/package/layer-pack">
<img src="https://img.shields.io/npm/v/layer-pack.svg" alt="NPM" /></a>
<a href="https://travis-ci.org/n8tz/layer-pack-samples">
<img src="https://travis-ci.org/n8tz/layer-pack-samples.svg?branch=master" alt="Build Status" /></a>
<img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>

<p align="center">
This is solid beta; Feel free to test / feedback / make contribs<br/>
</p>


## Check the samples [here](https://github.com/n8tz/layer-pack-samples)

## Main features :

### Split you're projects into multiple inheritable npm packages

- inherit & share most of the code between projects
- Include or not layers like dev tools, admin, etc
- Switch between monorepo and npm dependencies structure
- Test layers independently
- Compile in 1 step, with the source map

### Make glob imports on inherited directories ( from local or inherited packages )

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


## Check the samples [here](https://github.com/n8tz/layer-pack-samples)

## Draft doc [here](doc/DOC.MD)

## Caveats / bugs ?

- Remember that devDependencies of dependencies are NOT installed so layers should only use (peer)Dependencies
- inherit deal with the deps resolving order, even if layers are in the libPath folder. That's said, when compiling for node the relative paths to the externals libs directories are hard written
- Context based webpack requires are not processed
- This plugin probably need some optimisations

## Improvements / todo

- Allow compiling inheritable packages code separately (slice the build) 
- Optims

## Contributors ?

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)

<!-- BACKERS/ -->

<h2>Backers</h2>

<h3>Sponsors</h3>

Become a sponsor!

<span class="badge-paypal"><a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=YNJZ6NQYVPTPE" title="Donate to this project using Paypal"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal donate button" /></a></span>
[![*](https://www.google-analytics.com/collect?v=1&tid=UA-82058889-1&cid=555&t=event&ec=project&ea=view&dp=%2Fproject%2Flayer-pack&dt=readme)](#)
