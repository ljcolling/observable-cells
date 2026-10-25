export interface RunOptions {
    /** A CSS selector for the element whose width is Observable's `width`, such as the article column. Defaults to `<main>`. */
    width?: string;
    /** Stops the cells and clears their outputs when aborted, as when a component unmounts. */
    signal?: AbortSignal;
}
/**
  * Evaluates the cells that the remark plugin rendered into the page, from a
  * module script or after the content mounts. Resolves to a function that stops
  * the cells and clears their outputs, for content that is replaced without a
  * page load.
 */
export declare function run({ width, signal }?: RunOptions): Promise<() => void>;
