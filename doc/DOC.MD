<h1 align="center">layer-pack — Documentation</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/layer-pack"><img src="https://img.shields.io/npm/v/layer-pack.svg" alt="NPM" /></a>
  <a href="https://travis-ci.org/n8tz/layer-pack-samples"><img src="https://travis-ci.org/n8tz/layer-pack-samples.svg?branch=master" alt="Build Status" /></a>
</p>

---

## Table of contents

1. [Core concepts](#1-core-concepts)
2. [Quick start](#2-quick-start)
3. [Configuring a layer — `.layers.json`](#3-configuring-a-layer--layersjson)
4. [Using layer-pack in webpack configs](#4-using-layer-pack-in-webpack-configs)
5. [Glob imports](#5-glob-imports)
6. [The `$super` escape hatch](#6-the-super-escape-hatch)
7. [CLI reference](#7-cli-reference)
8. [Setting up inherited layers for development](#8-setting-up-inherited-layers-for-development)
9. [Virtual `.buildInfos.json`](#9-virtual-buildinfojson)
10. [API reference](#10-api-reference)

---

## 1. Core concepts

### Layers

A **layer** is any npm package (or local directory) that:

- Exposes a source root (e.g. `App/`)
- Has a `.layers.json` declaring its build profiles
- Optionally provides a webpack configuration

Layers form an inheritance chain. The **head project** is the top of the chain; every package it lists in `extend` is a parent layer, which may itself extend further layers. Resolution always proceeds from head to root — the head project's files take precedence over everything below.

```
head-project
 └─ extends: my-app.admin
     └─ extends: my-app.core
         └─ extends: lpack-react
```

### Profiles

A **profile** is a named build configuration defined in `.layers.json`. Common examples: `default`, `www`, `api`, `static`, `Comp`.

When you run `lpack :api`, layer-pack:
1. Walks the full inheritance chain
2. Collects every layer's `api` profile (falling back to `default` when `api` is absent)
3. Deep-merges them — head project values win over parent values
4. Spawns webpack with the merged configuration

### Virtual module resolution

At build time, the layer-pack webpack plugin:
- Resolves `App/...` imports by searching each layer's root folder in order
- Intercepts glob patterns and generates virtual JS/SCSS modules on the fly
- Redirects `$super/...` imports to the matching file one layer down in the chain

No runtime library. No extra bundle overhead.

---

## 2. Quick start

### Option A — Use a starter

The fastest path is to fork [lpack-react](https://github.com/layer-pack/lpack-react), a fully configured base layer with:

- Webpack 5, Babel, React, Sass
- Express with SSR
- Build profiles for browser, Node API, static site, and React components
- Source maps across the full inheritance chain

Then browse the [samples repository](https://github.com/n8tz/layer-pack-samples) for more patterns.

### Option B — Start from scratch

```bash
npm install --save-dev layer-pack webpack webpack-cli webpack-dev-server
```

Create a `.layers.json` at your project root:

```json
{
  "default": {
    "rootFolder": "App",
    "extend": []
  }
}
```

Create a `webpack.config.js`:

```js
const layerPack = require('layer-pack');
const lPackPlugin = layerPack.plugin();
const lPackCfg = layerPack.getConfig();

module.exports = {
  entry: { App: lPackCfg.vars.rootAlias },
  output: { path: layerPack.getHeadRoot() + "/dist/" },
  plugins: [lPackPlugin],
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: layerPack.isFileExcluded(),
        use: ['babel-loader']
      }
    ]
  }
};
```

Build:

```bash
lpack         # default profile
lpack :www    # named profile
lpack-dev-server
```

---

## 3. Configuring a layer — `.layers.json`

Every layer needs a `.layers.json` (or `.layers.js`) at its package root.

### Full annotated example

```json
{
  "default": {
    "rootFolder": "App",
    "libsPath": ["./libs"],
    "extend": ["parent-layer-package"],
    "config": "./webpack.config.js",
    "vars": {
      "rootAlias": "App",
      "production": false,
      "devPort": 3000,
      "someTemplatized": "<%packagePath%>/App/index.html.tpl"
    }
  },

  "api": {
    "basedOn": "default",
    "config": "./webpack.config.api.js",
    "extend": ["parent-layer-package"],
    "vars": {
      "production": true,
      "externals": true,
      "hardResolveExternals": true
    }
  },

  "www": {
    "basedOn": "default",
    "config": "./webpack.config.www.js",
    "extend": ["parent-layer-package"],
    "vars": {
      "production": true
    }
  },

  "devAlias": "default"
}
```

### Field reference

| Field | Type | Description |
|---|---|---|
| `rootFolder` | `string` | The local source directory mapped to the layer's namespace root |
| `extend` | `string[]` | Ordered list of parent layers. Earlier entries take precedence |
| `libsPath` | `string[]` | Local directories searched before `node_modules` — for monorepo siblings or local overrides |
| `config` | `string` | Path to the webpack config for this profile |
| `basedOn` | `string` | Inherit all fields from another profile in this same file before applying overrides |
| `vars` | `object` | Arbitrary key/value data available in webpack configs as `lPackCfg.vars.*` |

### `vars` — reserved keys

| Key | Type | Description |
|---|---|---|
| `rootAlias` | `string` | Override the import namespace root (defaults to `"App"`) |
| `production` | `boolean` | Map to `webpack.mode` in your config |
| `externals` | `boolean \| string` | Mark everything outside the layer root as external. Accepts a RegExp string to selectively include packages |
| `hardResolveExternals` | `boolean` | (Node builds) Rewrite external `require()` calls to pre-resolved relative paths |
| `webpackPatch` | `object` | Webpack config fragment applied via `webpack-merge` after all other config is resolved |

### Mustache templating in vars

String values in `vars` support mustache-style templates:

```json
"htmlTemplate": "<%packagePath%>/App/index.html.tpl"
```

Available template variables:

| Variable | Value |
|---|---|
| `packagePath` | Absolute path of the package that owns this config |
| `projectPath` | Absolute path of the head project |
| `packageConfig` | Contents of the head project's `package.json` |

### `.layers.js` — dynamic configs

Replace `.layers.json` with `.layers.js` when you need to reference webpack plugins or compute values at config time:

```js
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  default: {
    rootFolder: "App",
    extend: ["lpack-react"],
    vars: {
      webpackPatch: {
        plugins: [new HtmlWebpackPlugin({ template: './App/index.html' })]
      }
    }
  }
};
```

---

## 4. Using layer-pack in webpack configs

### Standard setup

```js
const layerPack  = require('layer-pack');
const lPackPlugin = layerPack.plugin();
const lPackCfg    = layerPack.getConfig();

module.exports = {
  entry: {
    App: lPackCfg.vars.rootAlias  // resolves to App/index.js across all layers
  },

  output: {
    path: layerPack.getHeadRoot() + "/dist/"
  },

  plugins: [
    lPackPlugin
  ],

  module: {
    rules: [
      {
        test: /\.jsx?$/,
        // Required: transpile source files from all inherited layers
        exclude: layerPack.isFileExcluded(),
        use: ['babel-loader']
      },
      {
        test: /\.(scss|css)$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'sass-loader',
            options: {
              // Required for glob @imports in SCSS
              importer: lPackPlugin.sassImporter()
            }
          }
        ]
      }
    ]
  }
};
```

### Delegating to a parent layer's webpack config

When the webpack config lives in a parent layer, use `getSuperWebpackCfg()` to load and optionally extend it:

```js
// webpack.config.js — in your head project
const layerPack = require('layer-pack');

const wpCfg = layerPack.getSuperWebpackCfg(/* optional: 'profileId' */);

// Extend with project-specific overrides using webpack-merge if needed
module.exports = wpCfg;
```

This is the pattern used by `lpack-react` consumers — the entire build configuration is inherited and you only override what differs.

---

## 5. Glob imports

Glob patterns in `import` / `require` statements cause layer-pack to generate a virtual module on the fly containing re-exports of every matched file.

### Basic glob — default export

```js
import allModules from "App/modules/*.module.js";
// allModules is an array of every matched module's default export
```

### Named exports from file names

Wrap the variable part of the pattern in parentheses to generate named exports:

```js
import { Header, Footer, Sidebar } from "App/ui/components/(*).jsx";
// Named exports derived from the captured filename (without extension)
```

### Deep tree — nested objects from directory structure

```js
import { admin, public } from "App/ui/pages/(**/*).jsx";
// admin.Dashboard, admin.UserList
// public.Home, public.About
```

Slashes in captured paths become nested JS objects. If a captured segment is not a valid JS identifier, it only appears in the default export.

### Lazy loading — React code splitting

Append `?using=<format>` to wrap each import in a lazy loader:

```js
// React.lazy + Suspense
import { admin } from "App/ui/pages/(**/*).jsx?using=LazyReact";

// react-loadable
import { admin } from "App/ui/pages/(**/*).jsx?using=ReactLoadable";

// Custom Suspense wrapper
import { admin } from "App/ui/pages/(**/*).jsx?using=SuspenseReact";
```

Each matched file becomes a separate webpack chunk — zero manual configuration.

### Glob imports in SCSS

```scss
/* Pull in every stylesheet from every layer in one line */
@import "App/ui/**/*.scss";
```

> **Note:** SCSS files must use layer-rooted absolute paths (`App/assets/bg.png`) rather than relative paths, due to a limitation in the Sass importer API.

---

## 6. The `$super` escape hatch

`$super` resolves to the same relative file path one layer below the current file in the inheritance chain. This lets you override a file while still building on the parent implementation.

### JavaScript / JSX

```jsx
// App/components/Button.jsx — in your head project
import ParentButton from "$super";

export default class Button extends ParentButton {
  render() {
    return (
      <span className="my-override">
        {super.render()}
      </span>
    );
  }
}
```

You can also reference specific files in parent layers:

```js
import parentUtils from "$super/App/utils/formatting";
```

### SCSS

```scss
/* App/ui/components/button.scss */
@import "$super"; /* inherit parent button styles */

.btn {
  border-radius: 0; /* then override */
}
```

---

## 7. CLI reference

All CLI commands are run from the **head project** root.

### `lpack`

Runs a webpack build for the given profile.

```bash
lpack                   # build with "default" profile
lpack :api              # build with "api" profile
lpack :www --watch      # webpack --watch, passed through
lpack :?                # list all available profiles
```

### `lpack-dev-server`

Starts `webpack-dev-server` for the given profile.

```bash
lpack-dev-server
lpack-dev-server :www
```

### `lpack-setup`

Installs `devDependencies` for all inherited layers. Run this after `npm install` when working with inherited packages, since npm does not install `devDependencies` of dependencies.

```bash
lpack-setup             # setup layers for "default" profile
lpack-setup :www        # setup for "www" profile
lpack-setup :www ci     # use "npm ci" instead of "npm install"
```

### `lpack-run`

Runs a Node script with layer-pack's module resolution active. Useful for running build scripts or seed scripts that import layer-namespaced modules.

```bash
lpack-run ./scripts/seed.js
lpack-run :api ./scripts/migrate.js
```

### `lpack-init`

Scaffolds a new layer-pack project in the current directory.

```bash
lpack-init
```

---

## 8. Setting up inherited layers for development

When a project uses inherited layers (via `extend`), those layers' `devDependencies` are not automatically installed by npm. There are two approaches:

### Using `lpack-setup` (npm-based projects)

```bash
npm install          # install your project's deps
lpack-setup          # install devDeps of all inherited layers
lpack-setup :api     # repeat for other profiles if their layers differ
```

### Using `libsPath` (monorepo)

If your layers live as sibling directories rather than npm packages, point `libsPath` at them:

```json
{
  "default": {
    "libsPath": ["../shared-layers"],
    "extend": ["my-app-core"]
  }
}
```

Packages listed in `libsPath` take precedence over `node_modules`. In this setup you manage each layer's dependencies yourself, and `extend` entries in `package.json` are optional.

---

## 9. Virtual `.buildInfos.json`

layer-pack injects a virtual file at `<rootAlias>/.buildInfos.json` (e.g. `App/.buildInfos.json`) during every build. Import it anywhere in your application:

```js
import buildInfos from "App/.buildInfos.json";

console.log(buildInfos.project.version);  // from package.json
console.log(buildInfos.buildDate);        // Unix timestamp
console.log(buildInfos.profile);          // e.g. "www"
```

### Full schema

```json
{
  "project": {
    "name":        "string — from package.json",
    "description": "string — from package.json",
    "author":      "string — from package.json",
    "version":     "string — from package.json"
  },
  "profile":     "string — active build profile ID",
  "buildDate":   "number — Unix timestamp",
  "projectRoot": "string — absolute path to the head project",
  "vars":        "object — merged vars for the active profile",
  "allCfg":      "array  — all layer configs in resolution order",
  "allModId":    "array  — all layer module IDs in resolution order"
}
```

---

## 10. API reference

### `layerPack.plugin(overrideConfig?)`

Creates the webpack plugin instance. Optionally accepts a partial `.layers.json` config to override the one on disk.

```js
const lPackPlugin = layerPack.plugin();
```

### `layerPack.getConfig()`

Returns the resolved, merged configuration for the current profile:

```js
const lPackCfg = layerPack.getConfig();

lPackCfg.vars.rootAlias    // "App"
lPackCfg.vars.production   // true | false
lPackCfg.allRoots          // all resolved source roots in order
lPackCfg.allModulePath     // all node_modules paths in order
```

### `layerPack.getSuperWebpackCfg(profileId?)`

Loads and returns the webpack config from the first parent layer that defines one for the given profile (defaults to the current profile).

```js
const wpCfg = layerPack.getSuperWebpackCfg();     // current profile
const wpCfg = layerPack.getSuperWebpackCfg('api'); // specific profile
```

### `layerPack.getHeadRoot()`

Returns the absolute path to the head project root. Use this in webpack configs that live in parent layer packages:

```js
output: {
  path: layerPack.getHeadRoot() + "/dist/"
}
```

### `layerPack.isFileExcluded()`

Returns a webpack `exclude` function that skips files outside the inheritance chain. Pass this to every loader that should not process unrelated `node_modules`:

```js
{
  test: /\.jsx?$/,
  exclude: layerPack.isFileExcluded(),
  use: ['babel-loader']
}
```

### `lPackPlugin.sassImporter(additionalImporters?)`

Returns a Sass importer that handles glob `@import` patterns and layer namespace resolution. Pass it to `sass-loader`:

```js
{
  loader: 'sass-loader',
  options: {
    importer: lPackPlugin.sassImporter()
  }
}
```

To combine with other importers:

```js
importer: lPackPlugin.sassImporter(myOtherImporter)
```

---

## Samples

Explore working examples in the [layer-pack-samples repository](https://github.com/n8tz/layer-pack-samples):

- **TinderLike** — mobile-first React UI with animated cards
- **wp5-multiple-endpoints** — multiple webpack entry points in a single build
- More at the repository root

## Base layer

[lpack-react](https://github.com/layer-pack/lpack-react) is the recommended starting point for new projects. It provides production-ready profiles for browser apps, Node APIs, static sites, and distributable React components — all inheritable and overridable.
