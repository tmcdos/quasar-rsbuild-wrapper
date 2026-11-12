'use strict';

import { compile } from '@vue/compiler-dom';
import { optimize } from 'svgo';

function svgToVue(content, options = {})
{
  const { svgoConfig = {}, svgoPath = null } = options;

  let result = content;

  if (svgoConfig !== false)
  {
    result = optimize(content, {
      ...svgoConfig,
      path: svgoPath,
    }).data;
  }

  // Compile SVG string into Vue 3 render function code
  const { code } = compile(result, {
    mode: 'module',
    whitespace: 'condense',
  });

  // Export the compiled render function as a standard Vue 3 component
  return `
    ${code}
    export default { render };
  `;
}

export default function vueSVGcomponent(content)
{
  const callback = this.async();
  const options = this.getOptions() || {};

  try
  {
    const result = svgToVue(content, {
      svgoConfig: options.svgo,
      svgoPath: this.resourcePath,
    });
    callback(null, result);
  }
  catch (e)
  {
    callback(e);
  }
}
