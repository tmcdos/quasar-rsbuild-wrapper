import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVueRules(compiler)
{
  const rules = compiler.options.module.rules;

  // Naive approach without RuleSet or RuleSetCompiler
  return rules.map((rule, index) => (
    rule.test && rule.test.toString().includes('vue')
      ? {
          index,
          rule: { ...rule }
        }
      : null
  )).filter(v => v != null);
}

export default class QuasarLoaderPlugin
{
  constructor(options)
  {
    this.options = options || {};
  }

  apply(compiler)
  {
    const vueRules = getVueRules(compiler);

    if (!vueRules.length)
    {
      throw new Error(
        `[QuasarLoaderPlugin Error] No matching rule for vue-loader found.\n` +
        `Make sure there is at least one root-level rule that uses vue-loader and QuasarLoaderPlugin is applied after VueLoaderPlugin.`
      );
    }

    vueRules.forEach(this.updateVueRule.bind(this));

    const rules = [...compiler.options.module.rules];
    vueRules.forEach(({ rule, index }) =>
    {
      rules[index] = rule;
    });
    compiler.options.module.rules = rules;
  }

  updateVueRule({ rule })
  {
    rule.oneOf = [
      {
        resourceQuery: '?',
        use: rule.use
      },
      {
        use: [
          {
            loader: resolve(__dirname, 'quasar.loader.mjs'),
            options:
            {
              attrsMatch: this.options.attrsMatch || [],
              match: this.options.match || [],
              registerStylesSSR: this.options.registerStylesSSR || false
            }
          },
          ...rule.use
        ]
      },
    ];
    delete rule.use;
  }
}
