import { describe, expect, test } from "vite-plus/test";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { GFM } from "@lezer/markdown";
import { prosemarkMarkdownSyntaxExtensions } from "../src/lib/prosemark-core/markdown";

// Top-level block node names of `doc`.
function blocks(doc: string): string[] {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM, prosemarkMarkdownSyntaxExtensions] })],
  });
  const tree = ensureSyntaxTree(state, doc.length, 1000)!;
  const names: string[] = [];
  for (let child = tree.topNode.firstChild; child; child = child.nextSibling)
    names.push(child.name);
  return names;
}

describe("setext heading underlines", () => {
  test("a single `-` under text starts a bullet instead of making a heading", () => {
    expect(blocks("this is working\n-")).toEqual(["Paragraph", "BulletList"]);
    expect(blocks("this is working\n- ")).toEqual(["Paragraph", "BulletList"]);
    expect(blocks("this is working\n- very")).toEqual(["Paragraph", "BulletList"]);
  });

  test("two or more dashes still make an H2", () => {
    expect(blocks("Title\n--")).toEqual(["SetextHeading2"]);
    expect(blocks("Title\n---")).toEqual(["SetextHeading2"]);
  });

  test("a single `=` still makes an H1", () => {
    expect(blocks("Title\n=")).toEqual(["SetextHeading1"]);
  });

  test("a single `-` after a multi-line paragraph keeps every line in the paragraph", () => {
    expect(blocks("one\ntwo\n-")).toEqual(["Paragraph", "BulletList"]);
  });
});
