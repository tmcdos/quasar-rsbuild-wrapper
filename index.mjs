'use strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadEnv } from '@rsbuild/core';
import { pluginEslint } from '@rsbuild/plugin-eslint';
import { pluginSass } from '@rsbuild/plugin-sass';
import { pluginVue } from '@rsbuild/plugin-vue';
import dotenvExpand from 'dotenv-expand';
import { Eta } from 'eta/core';
import { createRequire } from 'module';
import postcssWindicss from 'postcss-windicss';
import transformAssetUrls from 'quasar/dist/transforms/loader-asset-urls.json' with { type: 'json' };
import pkgQuasar from 'quasar/package.json';
import { pluginStylelint } from 'rsbuild-plugin-stylelint';
import pkgRouter from 'vue-router/package.json';

import QuasarLoaderPlugin from './loaders/plugin.quasar.loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CWD = process.cwd();

const quasarConfigList = [
  'quasar.config.js',
  'quasar.config.mjs',
  'quasar.config.cjs',
];

function getMajorVersion(version)
{
  const matches = version.match(/^(\d)\./);
  return parseInt(matches[1], 10);
}

const extRE = /\.[m|c]?[j|t]s$/;
function formatQuasarAssetPath(asset, type)
{
  return asset.indexOf('/') !== -1
    ? extRE.test(asset) === true
      ? asset
      : `${asset}.js`
    : `quasar/${type}/${asset}.js`;
}

function getQuasarConf(appDir, mode)
{
  for (const name of quasarConfigList)
  {
    const quasarConfigFilename = join(appDir, name);
    if (existsSync(quasarConfigFilename))
    {
      const require = createRequire(import.meta.url);
      const cfg = require(quasarConfigFilename);
      if (typeof cfg.default === 'function')
      {
        const ctx = {
          dev: mode === 'development',
          prod: mode === 'production',
          debug: mode === 'debug',
          appPaths:
            {
              appDir: CWD,
              srcDir: join(CWD, 'src'),
              publicDir: join(CWD, 'public'),
            }
        };
        return {
          content: cfg.default(ctx),
          filename: quasarConfigFilename,
        };
      }
    }
  }
  return null;
}

function parseAssetProperty(prefix)
{
  return asset =>
  {
    if (typeof asset === 'string')
    {
      return {
        path: asset[0] === '~' ? asset.substring(1) : prefix + `/${asset}`
      };
    }

    return {
      ...asset,
      path:
        typeof asset.path === 'string'
          ? asset.path[0] === '~'
            ? asset.path.substring(1)
            : prefix + `/${asset.path}`
          : asset.path
    };
  };
}

function uniquePathFilter(value, index, self)
{
  return self.map(obj => obj.path).indexOf(value.path) === index;
}

export default function rsBuildQuasarConfig(objConfig, mode)
{
  if (objConfig)
  {
    objConfig.plugins = (objConfig.plugins || []).concat([
      {
        name: 'quasar-html',
        setup(api)
        {
          api.modifyHTML((html) =>
          {
            return html.replace(
              '<!-- quasar:entry-point -->',
              '<div id="q-app"></div>'
            );
          });
        }
      },
      pluginVue({
        vueLoaderOptions:
          {
            transformAssetUrls
          }
      }),
      pluginSass({
        sassLoaderOptions:
          {
            sourceMap: true,
            implementation: 'sass', // sass-embedded is not a valid Win32 application
            sassOptions:
              {
                charset: false, // IMPORTANT - otherwise it emits BOM mark after processing quasar.sass and this breaks lightningcss-loader (it either complains on *,*:before,*:after declaration or silently skips it if errorRecovery = true - the default)
                quietDeps: true, // ignore @import deprecation warning
                silenceDeprecations: ['import', 'global-builtin'],
              }
          },
      }),
      pluginEslint({
        enable: process.env.NODE_ENV === 'development',
        eslintPluginOptions:
          {
            extensions: ['js', 'mjs', 'cjs', 'vue'],
          },
      }),
      pluginStylelint({
        enable: process.env.NODE_ENV === 'development',
        stylelintPluginOptions:
          {
            context: resolve(__dirname, 'src'),
            configFile: resolve(__dirname, 'stylelint.config.mjs'),
            files: '**/*.{vue,css,scss}',
            globbyOptions: { extension: false }, // otherwise "fastGlob" does not find anything if the folder contains brace(s)
            quiet: false,
            emitErrors: true
          },
      }),
    ]);

    // load Quasar configuration and begin watching the file for changes
    let quasarCfg = getQuasarConf(CWD, mode);
    if (quasarCfg)
    {
      objConfig.dev = objConfig.dev || {};
      objConfig.dev.watchFiles = objConfig.dev.watchFiles || { type: 'restart' };
      objConfig.dev.watchFiles.paths = (objConfig.dev.watchFiles.paths || []).concat([__filename, quasarCfg.filename]);
      quasarCfg = quasarCfg.content;
    }
    else
    {
      quasarCfg = {};
    }

    // Specify HTML template and eventually define HTML variables
    objConfig.html = {
      favicon: false,
      template: objConfig.html?.template || quasarCfg.build?.htmlFilename || './index.html',
      templateParameters: {
        ...quasarCfg.htmlVariables,
        ...objConfig.html?.templateParameters,
      },
    };

    // load environment variables
    const { parsed } = loadEnv({ prefixes: ['VUE_APP_'] });
    const tempEnv = {
      ...quasarCfg.build?.env,
      NODE_ENV: process.env.NODE_ENV,
      DEV: mode === 'development',
      PROD: mode === 'production',
      DEBUGGING: mode === 'debug' || mode === 'development',
      MODE: mode,
      CLIENT: true,
      SERVER: false,
      VUE_ROUTER_MODE: quasarCfg.build?.vueRouterMode,
      VUE_ROUTER_BASE: quasarCfg.build?.vueRouterBase || quasarCfg.build?.publicPath || '/',
    };

    // expand variables inside another variables
    dotenvExpand.expand({
      parsed,
      processEnv: tempEnv,
    });
    // Filter out keys that cannot be used in JS as process.env.[key]
    // Examples: ProgramFiles(x86), BASH_FUNC_which%%
    const validKeyRE = /^[a-zA-Z_$][a-zA-Z0-9_$]+/;
    const validKeys = Object.keys(tempEnv).filter(key => validKeyRE.test(key));
    const customEnv = validKeys.reduce((acc, key) =>
    {
      const val = tempEnv[key];
      acc[`import.meta.env.${key}`] = acc[`process.env.${key}`] =
        val === 'true' || val === 'false'
          ? val // let's keep it as boolean and not transform it to string
          : JSON.stringify(val);
      return acc;
    }, {
      // quasar
      __QUASAR_VERSION__: pkgQuasar.version,
      __QUASAR_SSR__: false,
      __QUASAR_SSR_SERVER__: false,
      __QUASAR_SSR_CLIENT__: false,
      __QUASAR_SSR_PWA__: false,

      // vue
      __VUE_OPTIONS_API__: quasarCfg.build?.vueOptionsAPI !== false,
      __VUE_PROD_DEVTOOLS__: mode === 'debug',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: mode === 'debug', // Vue 3.4+

      // vue-i18n
      __VUE_I18N_FULL_INSTALL__: true,
      __VUE_I18N_LEGACY_API__: true,
      __VUE_I18N_PROD_DEVTOOLS__: mode === 'debug',
      __INTLIFY_PROD_DEVTOOLS__: mode === 'debug',
    });

    objConfig.source = objConfig.source || {};
    objConfig.source.define = {
      ...customEnv,
      ...objConfig.source.define,
    };

    // configure dev server
    objConfig.server = objConfig.server || {};
    objConfig.server.host = objConfig.server.host || quasarCfg.devServer?.host || '0.0.0.0';
    objConfig.server.port = objConfig.server.port || quasarCfg.devServer?.port || 9000;
    objConfig.server.historyApiFallback = quasarCfg.build?.historyApiFallback ? true : objConfig.server.historyApiFallback;
    objConfig.server.base = objConfig.server.base || quasarCfg.build?.publicPath || '/';
    objConfig.server.publicDir = objConfig.server.publicDir || {
      name: quasarCfg.devServer?.static?.directory || 'public',
    };
    if (!('https' in objConfig.server) && quasarCfg.devServer?.server?.type === 'https' && quasarCfg.devServer?.server?.options)
    {
      objConfig.server.https = {};
      for (const sslType in quasarCfg.devServer.server.options)
      {
        objConfig.server.https[sslType] = readFileSync(quasarCfg.devServer.server.options[sslType]);
      }
    }

    // configure dev proxy
    if (quasarCfg.devServer?.proxy && Array.isArray(quasarCfg.devServer.proxy))
    {
      objConfig.server.proxy = objConfig.server.proxy || {};
      quasarCfg.devServer.proxy.forEach(item =>
      {
        const proxyPath = typeof item.context === 'string' ? item.context : (item.context || [])[0];
        if (!objConfig.server.proxy[proxyPath])
        {
          objConfig.server.proxy[proxyPath] = item;
        }
      });
    }

    // enable WindiCSS
    objConfig.tools = objConfig.tools || {};
    objConfig.tools.postcss = objConfig.tools.postcss || {};
    objConfig.tools.postcss.postcssOptions = objConfig.tools.postcss.postcssOptions || {};
    objConfig.tools.postcss.postcssOptions.plugins = (objConfig.tools.postcss.postcssOptions.plugins || []).concat([postcssWindicss()]);

    // extend rsPack config
    objConfig.tools = objConfig.tools || {};
    const oldConfigFunc = objConfig.tools.rspack;
    objConfig.tools.rspack = (config, utils) =>
    {
      config.plugins = config.plugins || [];
      // auto-loading Quasar components and directives
      config.plugins.push(new QuasarLoaderPlugin());

      config.output = config.output || {};
      if (mode !== 'production')
      {
        // !!!!!!! -- https://github.com/vuejs/vue-cli/issues/2978#issuecomment-441426094
        // Group all Vue SFC files into a dedicated folder in the DevTools sources panel
        config.output.devtoolModuleFilenameTemplate = (info) =>
        {
          const resPath = normalize(info.resourcePath).split(sep).join('/');
          const isVue = resPath.match(/\.vue$/) && resPath.match(/^src/);
          const isGenerated = !!info.allLoaders;

          const generated = `rsbuild:///${resPath}?${info.hash}`;
          const vuesource = `vue:///${resPath}`;

          return isVue && !isGenerated ? vuesource : generated;
        };
        config.output.devtoolFallbackModuleFilenameTemplate = 'rspack:///[resource-path]?[hash]';
      }
      // Forces Rspack to generate readable string IDs for modules and chunks
      config.optimization = config.optimization || {};
      config.optimization.chunkIds = 'named';
      config.optimization.moduleIds = 'named';

      if (typeof oldConfigFunc === 'function')
      {
        oldConfigFunc(config, utils);
      }
      return config;
    };

    // add loaders in rsPack chain
    let quasarSrcExt = 'css';
    // we need a custom loader to inject Quasar SASS variables because @import must be inserted after all @use and @forward - hard requirement by the SASS compiler
    let sassPrefix = `@import 'quasar/src/css/variables.sass';\n`;
    let varsFilename = resolve(CWD, 'src/css/quasar.variables.scss');
    if (existsSync(varsFilename))
    {
      sassPrefix = `@import '~src/css/quasar.variables.scss', 'quasar/src/css/variables.sass';\n`;
      quasarSrcExt = 'sass';
    }
    else
    {
      varsFilename = resolve(CWD, 'src/css/quasar.variables.sass');
      if (existsSync(varsFilename))
      {
        sassPrefix = `@import '~src/css/quasar.variables.sass', 'quasar/src/css/variables.sass';\n`;
        quasarSrcExt = 'sass';
      }
    }
    const oldBundlerChain = objConfig.tools.bundlerChain;
    objConfig.tools.bundlerChain = (chain, utils) =>
    {
      chain.module
        .rule(utils.CHAIN_ID.RULE.SASS)
        .oneOf('sass')
        .after(utils.CHAIN_ID.ONE_OF?.CSS_MAIN)
        .use('quasar-scss-variables-loader')
        .loader(resolve(__dirname, './loaders/quasar.sass-vars.loader.mjs'))
        .options({
          prefix: sassPrefix,
        });

      // a loader to import SVG as Vue components
      const ruleSvg = chain.module.rule(utils.CHAIN_ID.RULE.SVG).test(/\.svg$/);

      ruleSvg
        .oneOf('svg-vue')
        .before(utils.CHAIN_ID.ONE_OF?.SVG_URL) // Priority matters
        .type('javascript/auto')
        .resourceQuery(/(^|\?)int($|&)/) // component SVGs must be in the form src="@/images/example.svg?int" !!!!!
        .use('vue-svg-loader')
        .loader(resolve(__dirname, './loaders/svg.loader.mjs'))
        .options({
          svgo:
            {
              plugins: [
                {
                  name: 'preset-default',
                  params:
                    {
                      overrides:
                        {
                          inlineStyles:
                            {
                              onlyMatchedOnce: false
                            },
                        }
                    }
                },
                'prefixIds',
                'removeDimensions',
              ]
            }
        });

      if (typeof oldBundlerChain === 'function')
      {
        oldBundlerChain(chain, utils);
      }
    };

    // set aliases
    objConfig.resolve = objConfig.resolve || {};
    objConfig.resolve.alias = Object.assign({
      src: join(CWD, 'src'),
      app: resolve(CWD),
      components: join(CWD, 'src/components'),
      layouts: join(CWD, 'src/layouts'),
      pages: join(CWD, 'src/pages'),
      views: join(CWD, 'src/views'),
      assets: join(CWD, 'src/assets'),
      css: join(CWD, 'src/css'),
      boot: join(CWD, 'src/boot'),
      stores: join(CWD, 'src/stores'),
    }, objConfig.resolve.alias);

    // update jsconfig.json
    /*
     src: appPaths.srcDir,
     app: appPaths.appDir,
     components: appPaths.resolve.src('components'),
     layouts: appPaths.resolve.src('layouts'),
     pages: appPaths.resolve.src('pages'),
     assets: appPaths.resolve.src('assets'),
     boot: appPaths.resolve.src('boot'),
     stores: appPaths.resolve.src('stores')
     */
    // generate entry files
    const tempDir = join(process.cwd(), '.quasar');
    if (!existsSync(tempDir))
    {
      mkdirSync(tempDir);
    }
    const entryConfig = {
      dev: mode === 'development',
      debugging: mode === 'debug' || mode === 'development',
      modeName: 'SPA UI',
      build: Object.assign({
        publicPath: '/',
        vueRouterMode: 'history',
      }, quasarCfg.build),
      framework: Object.assign({
        components: [],
        directives: [],
        plugins: [],
        config: {},
        lang: 'en-GB',
        iconSet: 'svg-mdi-v7',
      }, quasarCfg.framework),
      preFetch: quasarCfg.preFetch || false,
      extras: quasarCfg.extras || [],
      animations: quasarCfg.animations || [],
      css: [],
      boot: [],
      ctx:
        {
          mode:
            {
              ssr: false,
              pwa: false,
            }
        },
      sourceFiles:
        {
          rootComponent: 'src/App.vue',
          router: 'src/router/index',
          store: `src/stores/index`,
        }
    };
    entryConfig.framework.lang = formatQuasarAssetPath(entryConfig.framework.lang, 'lang');
    entryConfig.framework.iconSet = formatQuasarAssetPath(entryConfig.framework.iconSet, 'icon-set');
    entryConfig.metaConf = {
      hasLoadingBarPlugin: entryConfig.framework.plugins.includes('LoadingBar'),
      hasMetaPlugin: entryConfig.framework.plugins.includes('Meta'),
      versions:
        {
          vueRouter: getMajorVersion(pkgRouter.version),
        },
      css:
        {
          quasarSrcExt,
        },
    };
    if (quasarCfg.css?.length > 0)
    {
      entryConfig.css = quasarCfg.css
        .filter(_ => _)
        .map(parseAssetProperty('src/css'))
        .filter(asset => asset.path)
        .filter(uniquePathFilter);
    }
    if (quasarCfg.boot?.length > 0)
    {
      entryConfig.boot = quasarCfg.boot
        .filter(_ => _)
        .map(parseAssetProperty('boot'))
        .filter(asset => asset.path)
        .filter(uniquePathFilter);
    }

    // do we have a store?
    const storePath = resolve(process.cwd(), entryConfig.sourceFiles.store);
    Object.assign(entryConfig.metaConf, {
      hasStore: existsSync(storePath + '.js') || existsSync(storePath + '.mjs') || existsSync(storePath + '.ts') || existsSync(storePath + '.mts'),
      storePackage: 'pinia'
    });

    const eta = new Eta({
      useWith: true,
      debug: true,
    }); // get rid of "it" variable reference in templates to keep them compatible with lodash.template as used by Quasar App-Webpack
    [
      'app.js',
      'client-entry.js',
      'client-prefetch.js',
      'quasar-user-options.js'
    ].forEach(file =>
    {
      const content = readFileSync(resolve(__dirname, `templates/${file}`), 'utf-8');
      try
      {
        const compiled = eta.renderString(content, entryConfig);
        writeFileSync(join(tempDir, file), compiled, 'utf-8');
      }
      catch (err)
      {
        console.error('Failed to compile template ' + file);
        throw err;
      }
    });
    objConfig.source.entry = {
      index: resolve(process.cwd(), '.quasar/client-entry.js')
    };
  }
  return objConfig;
}
