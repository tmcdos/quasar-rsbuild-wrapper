# Quasar + rsBuild

`@quasar/app-webpack` is officially deprecated but Vite and `@quasar/app-vite` is not quite suitable for my personal taste.
So until there is official `@quasar/app-rsbuild` I created this simple tool for augmenting **rsBuild's** config to support my own Quasar SPA applications.

## How it works

The tool exports a default function which accepts an existing JavaScript object intended to be supplied to **rsBuild's** `defineConfig()` and augments it with Quasar specific stuff:

- Vue loader
- SASS loader
- ESLint loader (if there is `eslint.config.js` in the project folder)
- StyleLint loader (if there is `stylelint.config.mjs` in the project folder)
- WindiCSS plugin for PostCSS
- Quasar-specific resolver aliases
- auto-loader for Quasar components and directives
- auto-injecting of SASS variables in every SASS file or Vue SFC
- SVG loader to use SVG files as regular Vue components

Most SPA-related (no support for SSR, PWA, Electron, Cordova, BEX, Capacitor) flags and parameters from `quasar.config.js` or `quasar.config.mjs` are taken into account.
The tool also generates the correct entry files and points **rsBuild** to them.

## Installation

```
npm install -D quasar-rsbuild-wrapper
```

## Usage

Your typical `rsbuild.config.js` would look like this:
   
```javascript
import { defineConfig } from '@rsbuild/core';

const config = {
  // .... whatever you need
};

export default defineConfig(({ envMode }) =>
{
  const quasarRsbuild = require('quasar-rsbuild-wrapper').default;
  return quasarRsbuild(config, envMode);
});
```
