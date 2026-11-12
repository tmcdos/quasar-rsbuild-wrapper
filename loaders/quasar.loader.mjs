import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { customAlphabet } from 'nanoid';
import autoImportData from 'quasar/dist/transforms/auto-import.json' with { type: 'json' };
import importMap from 'quasar/dist/transforms/import-map.json' with { type: 'json' };
import { compileTemplate, parse as parseComponent } from 'vue/compiler-sfc';

const customID = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 20);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compRegex = new RegExp(autoImportData.regex.components, 'g');
//const dirRegex = new RegExp(autoImportData.regex.directives, 'g');

function importTransformation(importName)
{
  const file = importMap[importName];
  if (!file)
  {
    throw new Error('Unknown import from Quasar: ' + importName);
  }
  return 'quasar/' + file;
}

function transform(itemArray)
{
  return itemArray
    .map(name => `import ${name} from '${importTransformation(name)}';`)
    .join('\n');
}

export default async function quasarLoaderFunc(content, sourceMap)
{
  this.async();
  this.cacheable();

  if (!this.resourceQuery)
  {
    const readFile = pathName => new Promise((resolved, reject) =>
    {
      this.fs.readFile(pathName, function getFileContent(err, data)
      {
        if (err)
        {
          reject(err);
        }
        else
        {
          resolved(data);
        }
      });
    });

    this.addDependency(this.resourcePath);

    const tags = new Set();
    const attrs = new Set();
    const file = (await readFile(this.resourcePath)).toString('utf8');
    const { descriptor: component } = parseComponent(file, { filename: this.resourcePath });
    if (component.template)
    {
      let templateContent = component.template.content;

      // Handle external template files (.src)
      if (component.template.src)
      {
        const externalFile = (await new Promise((resolved, reject) =>
        {
          this.resolve(dirname(this.resourcePath), component.template.src, (err, result) =>
          {
            if (err)
            {
              reject(err);
            }
            else
            {
              resolved(result);
            }
          });
        }
        ));
        templateContent = (await readFile(externalFile)).toString('utf8');
      }

      // Compile template and inspect the AST using Vue 3 compilerOptions
      compileTemplate({
        compilerOptions:
          {
            nodeTransforms: [
              (node) =>
              {
                // In Vue 3 AST, NodeTypes.ELEMENT = 1
                if (node.type === 1)
                {
                  if (node.tag === 'component')
                  {
                    (node.props || []).forEach(prop =>
                    {
                      if (prop.type === 7 && prop.rawName === ':is')
                      {
                        const comp = prop.exp.loc.source.match(compRegex);
                        (comp || []).forEach(compName =>
                        {
                          if (autoImportData.importName[compName])
                          {
                            tags.add(compName);
                          }
                        });
                      }
                    });
                  }
                  else if (autoImportData.importName[node.tag])
                  {
                    tags.add(node.tag);
                  }

                  if (node.props)
                  {
                    node.props.forEach((prop) =>
                    {
                      // In Vue 3 AST, NodeTypes.DIRECTIVE = 7
                      if (prop.type === 7)
                      {
                        if (autoImportData.importName['v-' + prop.name])
                        {
                          attrs.add('v-' + prop.name);
                        }
                      }
                    });
                  }
                }
              }
            ]
          },
        filename: this.resourcePath,
        id: customID(), // Required by compileTemplate
        source: templateContent,
      });
    }
    let importStatements = '';
    let installStatements = '';
    if (tags.size)
    {
      const comp = Array.from(tags).map(name => autoImportData.importName[name]);
      importStatements += transform(comp, importTransformation);
      installStatements += `qInstall(script, 'components', {${comp.join(',')}});`;
    }
    if (attrs.size)
    {
      const dir = Array.from(attrs).map(name => autoImportData.importName[name]);
      importStatements += transform(dir, importTransformation);
      installStatements += `qInstall(script, 'directives', {${dir.join(',')}});`;
    }
    const from = JSON.stringify(resolve(__dirname, './runtime.auto-import.mjs'));
    // stringifyRequest needed so it doesn't
    // mess up consistency of hashes between builds
    const newContent = (tags.size + attrs.size)
      ? `
/* quasar-auto-import */
${importStatements}
import qInstall from ${from};
${installStatements}
`
      : '';
    const index = this.mode === 'development' ? content.indexOf('/* hot reload */') : -1;

    content =
      index === -1
        ? content + '\n\n' + newContent
        : content.slice(0, index) + newContent + '\n\n' + content.slice(index);
  }

  this.callback(null, content, sourceMap);
}
