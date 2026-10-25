import parser, { type Cell } from '@observablehq/parser';
import type { ElementContent, Properties } from 'hast';
import type { Code, Parent, Root, RootContent } from 'mdast';
import type { VFile } from 'vfile';

// The runtime's interpreter parses every cell with parser 4.2.0, the stricter
// of the runtime's two parsers. Splitting blocks with the same version means a
// block that builds also runs.
const { parseModule } = parser;

type OptionValue = string | boolean;

// Quarto's cell options, written as `//| echo: true` lines at the top of a
// block. `fig-cap`, `label` and `classes` take text of their own.
const optionLine = /^\/\/\|\s*([\w-]+)\s*:\s*(.*?)\s*$/;
const optionValues: Record<string, OptionValue[]> = { echo: [true, false], output: [true, false, 'all'], panel: ['input'] };
const textOptions: Record<string, RegExp> = { 'fig-cap': /^/, label: /^[^\s]+$/, classes: /^\S+(?:\s+\S+)*$/ };
const optionHelp = 'Use echo: true|false, output: true|false|all, panel: input, fig-cap: <caption>, label: <id> or classes: <class> <class>.';

/** A Markdown node that becomes the given HTML element. */
interface HtmlNode {
  type: 'observable';
  data: { hName: string; hProperties: Properties; hChildren?: ElementContent[] };
  children?: (HtmlNode | Code | { type: 'text'; value: string })[];
}

/**
  * Turns ```ojs code blocks into Observable cells, in the markup of Quarto's
  * OJS output. Blocks are split into cells here, so a syntax error fails the
  * build at its line; the client (`run` from ./client) evaluates them. In Astro,
  * a page with cells gets `observable: true` in its remark frontmatter.
 */
export default function remarkObservable() {
  return (tree: Root, file: VFile): void => {
    const blocks: { parent: Parent; index: number; node: Code }[] = [];
    const visit = (parent: Parent): void => parent.children.forEach((node, index) => {
      if (node.type === 'code' && node.lang === 'ojs') blocks.push({ parent, index, node });
      else if ('children' in node) visit(node);
    });
    visit(tree);
    blocks.forEach(({ parent, index, node }, block) => {
      parent.children[index] = observableBlock(node, block + 1, file) as unknown as RootContent;
    });
    // Lets an Astro layout load the client only on pages with cells.
    const frontmatter = (file.data as { astro?: { frontmatter?: Record<string, unknown> } }).astro?.frontmatter;
    if (blocks.length && frontmatter) frontmatter.observable = true;
  };
}

function optionLines(lines: string[]): string[] {
  const code = lines.findIndex(line => !optionLine.test(line));
  return code === -1 ? lines : lines.slice(0, code);
}

function observableBlock(node: Code, block: number, file: VFile): HtmlNode {
  const firstLine = (node.position?.start.line ?? 0) + 1;
  const lines = node.value.split('\n');
  const header = optionLines(lines).length;
  const options: Record<string, OptionValue> = { echo: false, output: true };
  lines.slice(0, header).forEach((line, index) => {
    const [, key, text] = line.match(optionLine)!;
    const value = text === 'true' ? true : text === 'false' ? false : text.replace(/^(["'])(.*)\1$/, '$2');
    if (key in textOptions ? !textOptions[key].test(String(value)) : !optionValues[key]?.includes(value)) {
      file.fail(`Unsupported Observable cell option \`${line.trim()}\`. ${optionHelp}`, { line: firstLine + index, column: 1 });
    }
    options[key] = value;
  });

  const source = lines.slice(header).join('\n');
  let cells: Cell[];
  try {
    ({ cells } = parseModule(source));
  } catch (error) {
    // The parser counts from the start of the code; report the position in the post instead.
    const { message, loc: { line = 1, column = 0 } = {} } = error as { message: string; loc?: { line?: number; column?: number } };
    file.fail(`Observable: ${message.replace(/ \(\d+:\d+\)$/, '')}`, { line: firstLine + header + line - 1, column: column + 1 });
  }

  const imports: string[] = [], quiet: string[] = [], outputs: HtmlNode[] = [];
  for (const cell of cells) {
    const cellSource = source.slice(cell.start, cell.end);
    if (cell.body.type === 'ImportDeclaration') imports.push(cellSource);
    else if (options.output === false) quiet.push(cellSource);
    else outputs.push(html('div', { className: ['cell-output', 'cell-output-display'] }, [{
      type: 'element',
      tagName: 'div',
      // The runtime shows the value of an expression but only the views (inputs) of named cells, as Quarto does.
      properties: { id: `ojs-cell-${block}-${outputs.length + 1}`, dataNodetype: cell.id ? 'declaration' : 'expression', dataOjsSource: cellSource },
      children: [],
    }]));
  }

  const classes = typeof options.classes === 'string' ? options.classes.split(/\s+/) : [];
  const properties: Properties = { className: ['cell', ...(options.panel === 'input' ? ['panel-input', 'card', 'bg-light', 'p-2'] : []), ...classes] };
  if (typeof options.label === 'string') properties.id = options.label;
  if (options.output === 'all') properties.dataOutput = 'all';
  if (imports.length) properties.dataOjsImport = imports.join('\n');
  if (quiet.length) properties.dataOjsQuiet = quiet.join('\n');
  if (!options.echo && !outputs.length) properties.hidden = true;
  const caption = options['fig-cap'];
  const figure: HtmlNode | undefined = typeof caption === 'string'
    ? { ...html('figure', { className: ['figure'] }), children: [...outputs, html('figcaption', { className: ['figure-caption'] }, [{ type: 'text', value: caption }])] }
    : undefined;
  return {
    ...html('div', properties),
    // An echoed block is an ordinary code block, highlighted like the rest of the page.
    children: [...(options.echo ? [{ type: 'code', lang: 'js', value: source } satisfies Code] : []), ...(figure ? [figure] : outputs)],
  };
}

function html(tagName: string, properties: Properties, children?: ElementContent[]): HtmlNode {
  return { type: 'observable', data: { hName: tagName, hProperties: properties, ...(children && { hChildren: children }) } };
}
