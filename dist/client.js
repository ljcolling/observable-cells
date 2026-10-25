import { initializeRuntime } from '../runtime/quarto-ojs-runtime.js';
/**
  * Evaluates the cells that the remark plugin rendered into the page, from a
  * module script or after the content mounts. Resolves to a function that stops
  * the cells and clears their outputs, for content that is replaced without a
  * page load.
 */
export async function run({ width, signal } = {}) {
    if (signal?.aborted)
        return () => { };
    const { runtime, paths, ojsConnector } = initializeRuntime({ widthElement: width ? document.querySelector(width) : null });
    // The runtime declines to start in file:// pages and Qt WebEngine viewers, and shows its own message.
    if (!runtime)
        return () => { };
    const outputs = [];
    const stop = () => {
        ojsConnector?.runtime.dispose();
        // The runtime adds each output to its cell's element.
        for (const element of outputs)
            element.replaceChildren();
    };
    signal?.addEventListener('abort', stop, { once: true });
    // The runtime is bundled away from the page. Resolve relative imports
    // against the page, and FileAttachment("/data.csv") against the site:
    // docToRoot is the relative path from the page's directory to the root, such
    // as "../..".
    paths.runtimeToDoc = new URL('.', location.href).href.slice(0, -1);
    paths.docToRoot = new URL('.', location.href).pathname.split('/').slice(1, -1).map(() => '..').join('/');
    // Notebook imports load asynchronously. Register them before the cells that
    // use them enter the graph; otherwise those cells briefly evaluate with the
    // imported names undefined and show errors.
    await Promise.allSettled(Array.from(document.querySelectorAll('[data-ojs-import]'), element => runtime.interpretQuiet(element.dataset.ojsImport)));
    // Aborted while the imports loaded: the runtime is stopped, and a later run
    // may already own the outputs.
    if (signal?.aborted)
        return stop;
    for (const element of document.querySelectorAll('[data-ojs-quiet], [data-ojs-source]')) {
        if (element.dataset.ojsQuiet)
            runtime.interpretQuiet(element.dataset.ojsQuiet);
        if (element.dataset.ojsSource) {
            runtime.interpret(element.dataset.ojsSource, element.id);
            outputs.push(element);
        }
    }
    return stop;
}
