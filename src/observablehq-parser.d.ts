// The parts of @observablehq/parser 4.2.0 (which has no types) used by the remark plugin.
declare module '@observablehq/parser' {
  export interface Cell {
    start: number;
    end: number;
    /** The cell's name, or null for an expression. */
    id: object | null;
    body: { type: string };
  }
  const parser: {
    /** Splits notebook source into cells. Errors carry `loc`, the line and column of the problem. */
    parseModule(input: string): { cells: Cell[] };
  };
  export default parser;
}
