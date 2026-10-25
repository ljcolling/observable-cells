export interface QuartoRuntime {
  /** Evaluates cells and shows their output in the element with this id. */
  interpret(source: string, targetElementId: string, inline?: boolean): Promise<unknown>;
  /** Evaluates cells without showing anything. */
  interpretQuiet(source: string): Promise<unknown>;
}

export interface QuartoOjs {
  /** Undefined in file:// pages and Qt WebEngine viewers, where the runtime shows a message instead of starting. */
  runtime: QuartoRuntime | undefined;
  /** The connector to the Observable runtime, whose `dispose()` stops every cell. Undefined where `runtime` is. */
  ojsConnector: { runtime: { dispose(): void } } | undefined;
  /** Prefixes for local `import` and `FileAttachment` paths. */
  paths: { runtimeToDoc?: string; runtimeToRoot?: string; docToRoot?: string };
}

/** Creates the runtime, and `window._ojs`. `widthElement` is the element whose width is `width` (default `<main>`). */
export function initializeRuntime(options?: { widthElement?: Element | null }): QuartoOjs;
