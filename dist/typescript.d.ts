/**
 * Erases the TypeScript types in a block of Observable cells, replacing them with spaces so that every other
 * character keeps its position. Throws like the Observable parser, with a 1-based line and 0-based column.
 */
export declare function stripTypes(source: string): string;
