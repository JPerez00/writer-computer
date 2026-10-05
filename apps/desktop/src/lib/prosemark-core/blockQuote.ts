import { syntaxTree, syntaxTreeAvailable } from "@codemirror/language";
import {
  type EditorState,
  Prec,
  RangeSet,
  type Range,
  type StateCommand,
  StateEffect,
} from "@codemirror/state";
import type { SyntaxNode } from "@lezer/common";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  keymap,
  type DecorationSet,
} from "@codemirror/view";
import { treeChanged, renderedRanges, renderedRangesChanged } from "./utils";

class NestedBlockQuoteBorder extends WidgetType {
  constructor(public offset: number) {
    super();
  }

  eq(other: NestedBlockQuoteBorder): boolean {
    return this.offset === other.offset;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-nested-blockquote-border";
    span.style = `--blockquote-border-offset: ${this.offset.toString()}px`;
    return span;
  }

  ignoreEvent(_event: Event) {
    return false;
  }
}

interface NestedBorder {
  pos: number;
  offset: number;
}

// Each rendered blockquote once (one can span several rendered ranges).
function renderedBlockquotes(view: EditorView, visit: (node: SyntaxNode) => void): void {
  const seen = new Set<number>();
  const tree = syntaxTree(view.state);
  for (const { from, to } of renderedRanges(view)) {
    tree.iterate({
      from,
      to,
      enter(node) {
        if (node.type.name != "Blockquote") return;
        if (!seen.has(node.from)) {
          seen.add(node.from);
          visit(node.node);
        }
        return false;
      },
    });
  }
}

const blockquoteLine = Decoration.line({ attributes: { class: "cm-blockquote-line" } });

// The bar on every line of a rendered blockquote. Built from the tree in
// `update`, not in a measure callback: decorations a plugin sets while
// measuring aren't read until the next view update, so the bars lagged one
// update behind and a freshly opened note showed none until a key was pressed.
function buildLineDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  renderedBlockquotes(view, (node) => {
    const startLine = view.state.doc.lineAt(node.from).number;
    const endLine = view.state.doc.lineAt(node.to).number;
    for (let i = startLine; i <= endLine; i++) {
      decos.push(blockquoteLine.range(view.state.doc.line(i).from));
    }
  });
  return RangeSet.of(decos, true);
}

// Nested quotes draw their extra bar at the inner `>`'s horizontal offset,
// which only the DOM knows.
function measureNestedBorders(view: EditorView): NestedBorder[] {
  const borders: NestedBorder[] = [];
  renderedBlockquotes(view, (node) => {
    node.cursor().iterate((child) => {
      if (child.type.name !== "QuoteMark") return;
      const line = view.state.doc.lineAt(child.from);
      if (child.from == line.from) return;
      const offset =
        (view.coordsAtPos(child.from)?.left ?? 0) - (view.coordsAtPos(line.from)?.left ?? 0);
      borders.push({ pos: child.from, offset });
    });
  });
  return borders;
}

const sameBorders = (a: NestedBorder[], b: NestedBorder[]) =>
  a.length === b.length && a.every((x, i) => x.pos === b[i]?.pos && x.offset === b[i]?.offset);

// An effect-only transaction that makes the view re-read the plugin's
// decorations after a measurement changed them.
const nestedBordersMeasured = StateEffect.define<null>();

export const blockQuoteExtension = ViewPlugin.fromClass(
  class {
    lines: DecorationSet;
    nested: NestedBorder[] = [];
    decorations: DecorationSet;
    destroyed = false;

    constructor(view: EditorView) {
      this.lines = buildLineDecorations(view);
      this.decorations = this.lines;
      this.requestMeasure(view);
    }

    update(u: ViewUpdate) {
      if (u.docChanged || renderedRangesChanged(u) || treeChanged(u)) {
        this.lines = buildLineDecorations(u.view);
        // Until re-measured, keep the nested bars where their text moved.
        this.nested = this.nested.map((b) => ({ ...b, pos: u.changes.mapPos(b.pos) }));
        this.compose();
        this.requestMeasure(u.view);
      }
    }

    compose() {
      const widgets = this.nested.map(({ pos, offset }) =>
        Decoration.widget({ widget: new NestedBlockQuoteBorder(offset) }).range(pos),
      );
      this.decorations = this.lines.update({ add: widgets, sort: true });
    }

    requestMeasure(view: EditorView) {
      // Measuring (coordsAtPos) must be done through requestMeasure
      view.requestMeasure({
        key: this,
        read: (v) => measureNestedBorders(v),
        write: (nested, v) => {
          if (sameBorders(nested, this.nested)) return;
          this.nested = nested;
          this.compose();
          // Dispatching is not allowed mid-measure; the next microtask is
          // outside it.
          queueMicrotask(() => {
            if (!this.destroyed) v.dispatch({ effects: nestedBordersMeasured.of(null) });
          });
        },
      });
    }

    destroy() {
      this.destroyed = true;
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// A quote line holding nothing but the `> ` markers Enter continues with.
// A bare `>` typed by hand (a spacer before a nested quote) doesn't match, so
// Enter there still continues the quote.
const EMPTY_QUOTE_LINE_RE = /^(?:[ \t]{0,3}>[ \t])+$/;

function isInBlockquote(state: EditorState, pos: number): boolean {
  for (
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1);
    node;
    node = node.parent
  ) {
    if (node.name === "Blockquote") return true;
  }
  return false;
}

// Enter on an empty quote line leaves one level of quoting in place, the way
// Enter on an empty list item leaves the list (lang-markdown would add a `>`
// spacer line and need a second Enter): `> > ` becomes `> `, and `> ` becomes
// an empty line. Nothing is inserted and nothing below moves.
export const blockQuoteEnter: StateCommand = ({ state, dispatch }) => {
  if (state.readOnly || state.selection.ranges.length !== 1) return false;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head);
  if (!sel.empty || sel.head !== line.to || !EMPTY_QUOTE_LINE_RE.test(line.text)) return false;
  // Trust the prefix past the committed parse; otherwise require a quote.
  if (syntaxTreeAvailable(state, line.to) && !isInBlockquote(state, line.from)) return false;

  const insert = line.text.slice(0, line.text.lastIndexOf(">"));
  dispatch(
    state.update({
      changes: { from: line.from, to: line.to, insert },
      selection: { anchor: line.from + insert.length },
      scrollIntoView: true,
      userEvent: "delete.empty-quote-marker",
    }),
  );
  return true;
};

export const blockQuoteKeymap = Prec.highest(keymap.of([{ key: "Enter", run: blockQuoteEnter }]));
