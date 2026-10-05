import type {
  BlockContext,
  LeafBlock,
  LeafBlockParser,
  Line,
  MarkdownConfig,
} from "@lezer/markdown";

// A single `-` under a line of text does not make that line an H2.
//
// CommonMark accepts any run of `-` (or `=`) as a setext heading underline,
// so starting a bullet under a paragraph (`text⏎-`, then `text⏎- `) briefly
// turned the paragraph into a heading until the bullet's first letter
// arrived. Writer asks for at least two dashes (`--`); a single `=` still
// works. With one dash the paragraph ends there and the `-` line is parsed on
// its own, as the empty list item the writer is typing.
//
// Runs just before lezer's `SetextHeading` leaf parser. Ending the leaf
// without consuming the line (adding the element and returning true, like
// lezer's own link-reference parser) leaves the line for the next block.
// Only public lezer API is used, so two rare cases differ slightly from what
// lezer itself would build: a lone `-` lazily under a quoted paragraph starts
// a bullet outside the quote, and a quoted paragraph ended this way doesn't
// carry its continuation lines' `>` marks.
const isSingleDash = (line: Line): boolean => {
  if (line.next !== 45 /* - */ || line.indent >= line.baseIndent + 4) return false;
  return /^-[ \t]*$/.test(line.text.slice(line.pos));
};

class SingleDashUnderlineGuard implements LeafBlockParser {
  nextLine(cx: BlockContext, line: Line, leaf: LeafBlock): boolean {
    if (!isSingleDash(line)) return false;
    cx.addLeafElement(
      leaf,
      cx.elt(
        "Paragraph",
        leaf.start,
        leaf.start + leaf.content.length,
        cx.parser.parseInline(leaf.content, leaf.start),
      ),
    );
    return true;
  }

  finish(): boolean {
    return false;
  }
}

export const setextDashUnderlineExtension: MarkdownConfig = {
  parseBlock: [
    {
      name: "SingleDashUnderlineGuard",
      leaf: () => new SingleDashUnderlineGuard(),
      before: "SetextHeading",
    },
  ],
};
