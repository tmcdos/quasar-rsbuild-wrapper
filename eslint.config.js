import js from '@eslint/js';
import importX from 'eslint-plugin-import';
import perfectionist from 'eslint-plugin-perfectionist';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import globals from 'globals';
import neostandard from 'neostandard';

export default [
  ...neostandard({
    semi: true,
  }),
  {
    /**
     * Ignore the following files.
     * Please note that pluginQuasar.configs.recommended() already ignores
     * the "node_modules" folder for you (and all other Quasar project
     * relevant folders and files).
     *
     * ESLint requires "ignores" key to be the only one in this object
     */
    ignores: ['templates']
  },

  js.configs.recommended,

  {
    languageOptions:
      {
        ecmaVersion: 'latest',
        globals:
        {
          ...globals.browser,
          ...globals.node, // SSR, Electron, config files
          Capacitor: 'readonly',
          browser: 'readonly', // BEX related
          chrome: 'readonly', // BEX related
          cordova: 'readonly',
          ga: 'readonly', // Google Analytics
          process: 'readonly' // process.env.*
        },

        sourceType: 'module'
      },
    plugins:
      {
        import: importX,
        perfectionist,
        'simple-import-sort': simpleImportSort,
      },
    // add your custom rules here
    rules:
    {
      '@stylistic/array-element-newline': ['error', 'consistent'],
      '@stylistic/brace-style': ['error', 'allman'],
      '@stylistic/comma-dangle': [
        'error',
        {
          arrays: 'only-multiline',
          exports: 'never',
          functions: 'never',
          imports: 'only-multiline',
          objects: 'only-multiline'
        }
      ],
      '@stylistic/curly-newline': ['error', 'always'],
      // allow async-await
      '@stylistic/generator-star-spacing': 'off',
      '@stylistic/max-statements-per-line': ['error', { max: 1 }],
      '@stylistic/no-confusing-arrow': 'error',
      '@stylistic/object-curly-newline': [
        'error',
        {
          ExportDeclaration: {
            minProperties: 3,
            multiline: true
          },
          ImportDeclaration: { multiline: true },
          ObjectExpression: {
            consistent: true,
            minProperties: 2,
            multiline: true
          },
          ObjectPattern: { multiline: true }
        }
      ],
      '@stylistic/object-property-newline': [
        'error',
        { allowAllPropertiesOnSameLine: false }
      ],
      '@stylistic/quotes': [
        'error',
        'single',
        {
          allowTemplateLiterals: true,
          avoidEscape: true
        }
      ],
      '@stylistic/space-before-function-paren': ['error', {
        anonymous: 'never',
        asyncArrow: 'always',
        named: 'never'
      }],
      '@stylistic/spaced-comment': 'off',
      'block-scoped-var': 'error',
      'consistent-return': 'error',
      curly: ['error', 'all'],

      'default-param-last': ['error'],
      'func-names': ['error', 'as-needed'],
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],

      'getter-return': 'error',
      'grouped-accessor-pairs': ['error', 'getBeforeSet'],
      'import/default': 'error',
      'import/export': 'error',
      'import/extensions': 'off',
      'import/first': 'error',
      'import/named': 'error',
      'import/namespace': 'error',
      'import/newline-after-import': 'error',
      'import/no-duplicates': 'error',
      'import/no-unresolved': [
        'error',
        {
          ignore: ['windi.css'],
        }
      ],

      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-constant-binary-expression': 'error',
      'no-constructor-return': 'error',
      // allow debugger during development only
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'no-dupe-else-if': 'error',
      'no-lonely-if': 'error',
      'no-loop-func': 'error',
      'no-negated-in-lhs': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-promise-executor-return': 'error',
      'no-setter-return': 'error',
      'no-shadow': 'error',
      'no-spaced-func': 'error',
      'no-unsafe-optional-chaining': ['error', { disallowArithmeticOperators: true }],
      'no-useless-concat': 'error',
      'no-var': ['error'],
      'nonblock-statement-body-position': ['error', 'beside'],
      'one-var': [
        'error',
        {
          initialized: 'never',
          uninitialized: 'always'
        }
      ],
      'perfectionist/sort-array-includes': ['error',
        {
          ignoreCase: true,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-switch-case': ['error',
        {
          ignoreCase: true,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'perfectionist/sort-variable-declarations': ['error',
        {
          ignoreCase: true,
          order: 'asc',
          type: 'alphabetical',
        },
      ],
      'promise/param-names': ['error', {
        resolvePattern: '^_?resolved?$'
      }],
      radix: 'error',
      'require-atomic-updates': 'error',

      'require-await': 'error',
      'require-yield': 'error',
      /// semi: ['error', 'always'],
      'semi-style': ['error', 'last'],
      'simple-import-sort/exports': 'error',
      // 'import/no-extraneous-dependencies': 'error',
      'simple-import-sort/imports': 'error',
      'vars-on-top': 'error',
    },
    settings:
      {
        'import/resolver':
          {
            node: {},
            typescript:
              {
                alwaysTryTypes: true,
                project: './jsconfig.json',
              },
          },
      }
  },
];
