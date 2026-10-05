import { describe, expect, test } from "vite-plus/test";
import { EditorSelection, EditorState, type Transaction } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { blockQuoteEnter } from "../src/lib/prosemark-core/blockQuote";
import { withFullParse } from "./helpers/parsed-state";

// `doc` with `|` marking the caret; returns the result the same way, or null
// when the command declined.
function enter(marked: string): string | null {
  const caret = marked.indexOf("|");
  const state = withFullParse(
    EditorState.create({
      doc: marked.replace("|", ""),
      extensions: [markdown({ extensions: [GFM] })],
      selection: EditorSelection.single(caret),
    }),
  );
  let next: EditorState | null = null;
  const ran = blockQuoteEnter({
    state,
    dispatch: (tr: Transaction) => {
      next = tr.state;
    },
  });
  if (!ran || !next) return null;
  const s: EditorState = next;
  const doc = s.doc.toString();
  const head = s.selection.main.head;
  return `${doc.slice(0, head)}|${doc.slice(head)}`;
}

describe("blockQuoteEnter", () => {
  test("an empty `> ` ends the quote in place", () => {
    expect(enter("> A quoted line\n> |")).toBe("> A quoted line\n|");
  });

  test("an empty `> > ` steps out to the outer quote in place", () => {
    expect(enter("> outer\n> > nested\n> > |")).toBe("> outer\n> > nested\n> |");
  });

  test("an empty `> ` after a blank line ends the quote in place", () => {
    expect(enter("> a\n\n> |")).toBe("> a\n\n|");
  });

  test("ending a quote right above another block moves nothing below", () => {
    expect(enter("> a\n> |\n## Next")).toBe("> a\n|\n## Next");
  });

  test("leaves a quote line with text to lang-markdown", () => {
    expect(enter("> text|")).toBeNull();
  });

  test("leaves a bare `>` spacer typed by hand to lang-markdown", () => {
    expect(enter("> a\n>|")).toBeNull();
  });

  test("ignores `> ` inside a fenced code block", () => {
    expect(enter("```\n> |\n```")).toBeNull();
  });
});
