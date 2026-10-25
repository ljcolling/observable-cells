import type { Root } from 'mdast';
import type { VFile } from 'vfile';
/**
  * Turns ```ojs code blocks into Observable cells, in the markup of Quarto's
  * OJS output. Blocks are split into cells here, so a syntax error fails the
  * build at its line; the client (`run` from ./client) evaluates them. In Astro,
  * a page with cells gets `observable: true` in its remark frontmatter.
 */
export default function remarkObservable(): (tree: Root, file: VFile) => void;
