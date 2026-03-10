<p align="center"><img width="192" src="https://github.com/layer-pack/layer-pack/raw/master/doc/assets/logo.svg?sanitize=true" /></p>

<h2 align="center">layer-pack</h2>

<p align="center">
  <strong>Inheritable code layers, glob imports, and shared webpack configs — for serious JS/TS applications.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/layer-pack"><img src="https://img.shields.io/npm/v/layer-pack.svg" alt="NPM" /></a>
  <a href="https://travis-ci.org/n8tz/layer-pack-samples"><img src="https://travis-ci.org/n8tz/layer-pack-samples.svg?branch=master" alt="Build Status" /></a>
  <img src="https://img.shields.io/badge/webpack-5-blue" />
  <img src="https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat" />
</p>

---

## The problem

Large JavaScript applications accumulate friction over time:

- **Relative import hell** — `../../../../config/api` breaks on every refactor
- **Rigid project boundaries** — sharing code between projects means publishing packages or copy-pasting
- **Duplicated build tooling** — every project re-implements the same webpack config with minor variations
- **All-or-nothing monorepos** — workspaces solve dependency hoisting but don't help with code inheritance or build composition

layer-pack solves all of these at the webpack resolution level — no runtime overhead, no new runtimes, just a smarter resolver.

---

## What it does

### Namespace your application

Trade fragile relative paths for stable absolute imports:

```js
// before
import config from "../../../config/api";

// after
import config from "App/config/api";
```

### Import entire directory trees with glob patterns

Stop maintaining import lists by hand:

```js
// import every module in a directory
import allModules from "App/modules/*.module.js";

// named exports from file names
import { Header, Footer, Sidebar } from "App/ui/components/(*).jsx";

// deep tree — nested objects from directory structure
import { admin } from "App/ui/components/(**/*).jsx";
// admin.Dashboard, admin.UserList, admin.Settings — automatically

// lazy-loaded React chunks, zero config
import { admin } from "App/ui/components/(**/*).jsx?using=LazyReact";
// also: ReactLoadable, SuspenseReact
```

Glob imports work in SCSS too:

```scss
@import "App/ui/**/*.scss"; /* one line pulls in the whole design system */
```

### Inherit code layers across packages

Split your application into composable layers — each an ordinary npm package:

```
my-app (head project)
 └─ extends: my-app.admin
     └─ extends: my-app.core
         └─ extends: lpack-react   ← shared React/Webpack boilerplate
```

Each layer contributes:
- Source files (resolved in inheritance order — head project always wins)
- Webpack configuration
- Build profiles and variables
- Dev dependencies

### Override inherited files surgically

Extend or replace any file from a parent layer without touching the original:

```js
// App/components/Button.jsx — in your head project
import $super from "$super"; // resolves to the same file in the parent layer

export default class Button extends $super {
  // add what you need, keep what you don't
}
```

Works in SCSS too:

```scss
@import "$super"; /* inherit parent styles, then override */

.btn { border-radius: 0; }
```

### Compose build profiles across the inheritance chain

A single `.layers.json` defines named profiles that cascade through your layer stack:

```json
{
  "default": {
    "rootFolder": "App",
    "extend": ["lpack-react"]
  },
  "api": {
    "basedOn": "default",
    "config": "./webpack.config.api.js",
    "vars": { "production": true, "target": "node" }
  },
  "www": {
    "basedOn": "default",
    "config": "./webpack.config.www.js",
    "vars": { "production": true, "target": "browser" }
  }
}
```

```bash
lpack :api    # builds the API bundle
lpack :www    # builds the frontend bundle
lpack :?      # lists all available profiles
```

---

## How it compares

| | layer-pack | Nx / Turborepo | Module Federation | Path aliases | Yarn workspaces |
|---|---|---|---|---|---|
| Glob imports | **Yes** | No | No | No | No |
| File-level inheritance (`$super`) | **Yes** | No | No | No | No |
| Shared webpack config inheritance | **Yes** | Partial | No | No | No |
| Works with npm packages | **Yes** | Monorepo only | Runtime only | No | Limited |
| Multi-profile builds | **Yes** | Task pipelines | No | No | No |
| Build-time (no runtime overhead) | **Yes** | Yes | No (runtime) | Yes | Yes |
| Namespace aliases | **Yes** | Partial | No | Yes | No |

**vs. Nx / Turborepo** — These are excellent task runners and caching layers for monorepos. They don't solve the import namespace problem, glob imports, or webpack config inheritance. layer-pack is complementary — use both if you run a monorepo.

**vs. Webpack Module Federation** — Module Federation shares code between running applications at runtime. layer-pack composes code at build time across layers, with zero runtime cost. They solve different problems.

**vs. path aliases (tsconfig paths, babel-plugin-module-resolver)** — Aliases give you named import roots. layer-pack gives you that plus inheritance, glob patterns, `$super` overrides, and shared build configs. Aliases are a subset.

**vs. Yarn / npm workspaces** — Workspaces manage dependency hoisting in a monorepo. They have nothing to say about how code is imported, shared, or built. layer-pack operates at a different level entirely.

---

## Quick start

```bash
npm install --save-dev layer-pack webpack webpack-cli
```

Pick a starter from the [samples repository](https://github.com/n8tz/layer-pack-samples) or fork [lpack-react](https://github.com/layer-pack/lpack-react) for a full React + SSR + Express boilerplate.

Full documentation is in [doc/DOC.MD](doc/DOC.MD).

---

## Known limitations

- **Yarn Berry (PnP)** — Yarn's Plug'n'Play mode restructures the module graph in ways that are incompatible with layer-pack's resolution. Use npm or classic Yarn.
- **SCSS relative imports** — Due to a limitation in the Sass API, SCSS files must use absolute layer-rooted paths (`App/assets/image.png`) rather than relative paths (`./image.png`).
- **Context-based requires** — Dynamic `require()` calls with variable paths are handled by webpack's native logic, not layer-pack.

---

## Support

BTC: `bc1qh43j8jh6dr8v3f675jwqq3nqymtsj8pyq0kh5a`

<a href="https://www.paypal.com/donate/?hosted_button_id=ECHYGKY3GR7CN"><img src="https://img.shields.io/badge/paypal-donate-yellow.svg" alt="PayPal" /></a>

[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](#)
