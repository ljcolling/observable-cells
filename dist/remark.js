import parser from '@observablehq/parser';
// The runtime's interpreter parses every cell with parser 4.2.0, the stricter
// of the runtime's two parsers. Splitting blocks with the same version means a
// block that builds also runs.
const { parseModule } = parser;
// Quarto's cell options, written as `//| echo: true` lines at the top of a
// block. `fig-cap`, `label` and `classes` take text of their own.
const optionLine = /^\/\/\|\s*([\w-]+)\s*:\s*(.*?)\s*$/;
const optionValues = { echo: [true, false], output: [true, false, 'all'], panel: ['input'] };
const textOptions = { 'fig-cap': /^/, label: /^[^\s]+$/, classes: /^\S+(?:\s+\S+)*$/ };
const optionHelp = 'Use echo: true|false, output: true|false|all, panel: input, fig-cap: <caption>, label: <id> or classes: <class> <class>.';
/**
  * Turns ```ojs code blocks into Observable cells, in the markup of Quarto's
  * OJS output. Blocks are split into cells here, so a syntax error fails the
  * build at its line; the client (`run` from ./client) evaluates them. In Astro,
  * a page with cells gets `observable: true` in its remark frontmatter.
 */
export default function remarkObservable() {
    return (tree, file) => {
        const blocks = [];
        const visit = (parent) => parent.children.forEach((node, index) => {
            if (node.type === 'code' && node.lang === 'ojs')
                blocks.push({ parent, index, node });
            else if ('children' in node)
                visit(node);
        });
        visit(tree);
        blocks.forEach(({ parent, index, node }, block) => {
            parent.children[index] = observableBlock(node, block + 1, file);
        });
        // Lets an Astro layout load the client only on pages with cells.
        const frontmatter = file.data.astro?.frontmatter;
        if (blocks.length && frontmatter)
            frontmatter.observable = true;
    };
}
function optionLines(lines) {
    const code = lines.findIndex(line => !optionLine.test(line));
    return code === -1 ? lines : lines.slice(0, code);
}
function observableBlock(node, block, file) {
    const firstLine = (node.position?.start.line ?? 0) + 1;
    const lines = node.value.split('\n');
    const header = optionLines(lines).length;
    const options = { echo: false, output: true };
    lines.slice(0, header).forEach((line, index) => {
        const [, key, text] = line.match(optionLine);
        const value = text === 'true' ? true : text === 'false' ? false : text.replace(/^(["'])(.*)\1$/, '$2');
        if (key in textOptions ? !textOptions[key].test(String(value)) : !optionValues[key]?.includes(value)) {
            file.fail(`Unsupported Observable cell option \`${line.trim()}\`. ${optionHelp}`, { line: firstLine + index, column: 1 });
        }
        options[key] = value;
    });
    const source = lines.slice(header).join('\n');
    let cells;
    try {
        ({ cells } = parseModule(source));
    }
    catch (error) {
        // The parser counts from the start of the code; report the position in the post instead.
        const { message, loc: { line = 1, column = 0 } = {} } = error;
        file.fail(`Observable: ${message.replace(/ \(\d+:\d+\)$/, '')}`, { line: firstLine + header + line - 1, column: column + 1 });
    }
    const imports = [], quiet = [], outputs = [];
    for (const cell of cells) {
        const cellSource = source.slice(cell.start, cell.end);
        if (cell.body.type === 'ImportDeclaration')
            imports.push(cellSource);
        else if (options.output === false)
            quiet.push(cellSource);
        else
            outputs.push(html('div', { className: ['cell-output', 'cell-output-display'] }, [{
                    type: 'element',
                    tagName: 'div',
                    // The runtime shows the value of an expression but only the views (inputs) of named cells, as Quarto does.
                    properties: { id: `ojs-cell-${block}-${outputs.length + 1}`, dataNodetype: cell.id ? 'declaration' : 'expression', dataOjsSource: cellSource },
                    children: [],
                }]));
    }
    const classes = typeof options.classes === 'string' ? options.classes.split(/\s+/) : [];
    const properties = { className: ['cell', ...(options.panel === 'input' ? ['panel-input', 'card', 'bg-light', 'p-2'] : []), ...classes] };
    if (typeof options.label === 'string')
        properties.id = options.label;
    if (options.output === 'all')
        properties.dataOutput = 'all';
    if (imports.length)
        properties.dataOjsImport = imports.join('\n');
    if (quiet.length)
        properties.dataOjsQuiet = quiet.join('\n');
    if (!options.echo && !outputs.length)
        properties.hidden = true;
    const caption = options['fig-cap'];
    const figure = typeof caption === 'string'
        ? { ...html('figure', { className: ['figure'] }), children: [...outputs, html('figcaption', { className: ['figure-caption'] }, [{ type: 'text', value: caption }])] }
        : undefined;
    return {
        ...html('div', properties),
        // An echoed block is an ordinary code block, highlighted like the rest of the page.
        children: [...(options.echo ? [{ type: 'code', lang: 'js', value: source }] : []), ...(figure ? [figure] : outputs)],
    };
}
function html(tagName, properties, children) {
    return { type: 'observable', data: { hName: tagName, hProperties: properties, ...(children && { hChildren: children }) } };
}
