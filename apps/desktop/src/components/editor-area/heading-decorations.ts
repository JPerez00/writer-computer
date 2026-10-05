import {
  Decoration,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
  ViewPlugin,
} from "@codemirror/view";
import { type Extension } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { HEADING_SCALES } from "@/lib/prosemark-core/syntaxHighlighting";
import { renderedRanges, renderedRangesChanged, treeChanged } from "@/lib/prosemark-core/utils";

const ATX_HEADING_RE = /^ATXHeading([1-6])$/;
const SETEXT_HEADING_RE = /^SetextHeading([1-2])$/;

const lineDecos: Record<number, Decoration> = {};
for (let level = 1; level <= 6; level++) {
  lineDecos[level] = Decoration.line({
    attributes: {
      class: `cm-heading-line cm-heading-line-${level}`,
      style: `--ws-heading-scale: ${HEADING_SCALES[level - 1]!.toString()}`,
    },
  });
}

function getMarkdownHeadingLevel(name: string): number | null {
  const atx = ATX_HEADING_RE.exec(name);
  if (atx) return Number(atx[1]);

  const setext = SETEXT_HEADING_RE.exec(name);
  if (setext) return Number(setext[1]);

  return null;
}

function buildDecorations(view: EditorView): DecorationSet {
  const decos: { from: number; to: number; deco: Decoration }[] = [];
  const tree = syntaxTree(view.state);
  // A heading can touch two rendered ranges (a setext heading with the caret
  // on its underline, scrolled out of the viewport); decorate it once.
  const seen = new Set<number>();

  for (const { from, to } of renderedRanges(view)) {
    tree.iterate({
      from,
      to,
      enter(node) {
        const level = getMarkdownHeadingLevel(node.name);
        if (level === null) return undefined;
        if (seen.has(node.from)) return false;
        seen.add(node.from);

        const lineFrom = view.state.doc.lineAt(node.from).from;
        decos.push({ from: lineFrom, to: lineFrom, deco: lineDecos[level]! });
        return false;
      },
    });
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(
    decos.map(({ from, to, deco }) => deco.range(from, to)),
    true,
  );
}

const headingPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || renderedRangesChanged(update) || treeChanged(update)) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

// Heading line styling only. The `#` marks are ordinary markdown syntax:
// shown inline while the caret is on the line and hidden otherwise by the
// default hide spec, like every other mark.
export const headingDecorations: Extension = headingPlugin;

// Exported for tests.
export const __test = {
  getMarkdownHeadingLevel,
};
