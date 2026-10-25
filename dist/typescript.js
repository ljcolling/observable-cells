import { transformSync } from 'amaro';
// Observable syntax that TypeScript does not accept, blanked before stripping and restored after:
// notebook imports, `viewof` and `mutable`, and `name =` before a block cell, which would otherwise be an object literal.
const masks = [
    /^import\s*\{[^}]*\}(?:\s*with\s*\{[^}]*\})?\s*from\s*(?:"[^"\n]*"|'[^'\n]*')/gm,
    /^(?:viewof\s+|mutable\s+)?[A-Za-z_$][\w$]*\s*=\s*(?=\{)/gm,
    /\b(?:viewof|mutable)\s+(?=[A-Za-z_$])/g,
];
// Cells may use top-level return, await and yield.
const prefix = 'async function* cells() {\n';
const suffix = '\n}';
/**
 * Erases the TypeScript types in a block of Observable cells, replacing them with spaces so that every other
 * character keeps its position. Throws like the Observable parser, with a 1-based line and 0-based column.
 */
export function stripTypes(source) {
    let masked = source;
    for (const mask of masks)
        masked = masked.replace(mask, match => match.replace(/[^\n]/g, ' '));
    let code;
    try {
        code = transformSync(prefix + masked + suffix, { mode: 'strip-only' }).code;
    }
    catch (error) {
        const { message, startLine = 1, startColumn = 0 } = error;
        const lines = source.split('\n');
        // An error on the closing line of the wrapper is at the end of the block.
        const line = Math.min(startLine - 1, lines.length);
        const column = startLine - 1 > lines.length ? lines.at(-1).length : startColumn;
        throw Object.assign(new SyntaxError(message.replace(/ in strip-only mode$/, ': only types that can be erased are')), { loc: { line, column } });
    }
    const stripped = code.slice(prefix.length, code.length - suffix.length);
    if (stripped.length !== source.length)
        throw new Error('Stripping TypeScript types moved the code');
    return stripped.replace(/[\s\S]/g, (char, index) => masked[index] === source[index] ? char : source[index]);
}
