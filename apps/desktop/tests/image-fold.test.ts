import { beforeEach, describe, expect, test } from "vite-plus/test";
import { EditorSelection, EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { ensureSyntaxTree } from "@codemirror/language";
import { GFM } from "@lezer/markdown";
import { foldExtension } from "../src/lib/prosemark-core/main";
import { __testImage, imageExtension } from "../src/lib/prosemark-core/fold/image";

const doc = "before\n\n![diagram](assets/diagram.png)\n\nafter";

function makeState(anchor = 0): EditorState {
  let state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), imageExtension],
    selection: EditorSelection.single(anchor),
  });
  ensureSyntaxTree(state, doc.length, 1000);
  state = state.update({ selection: state.selection }).state;
  return state;
}

function findImageWidget(state: EditorState): { estimatedHeight: number } {
  let found: { estimatedHeight: number } | undefined;
  state.field(foldExtension).between(0, state.doc.length, (_from, _to, decoration) => {
    const widget = (decoration.spec as { widget?: { estimatedHeight?: number } }).widget;
    if (typeof widget?.estimatedHeight === "number") {
      found = widget as { estimatedHeight: number };
    }
  });
  if (!found) throw new Error("Expected a folded image widget");
  return found;
}

describe("imageExtension height stability", () => {
  beforeEach(() => {
    __testImage.imageHeightCache.clear();
  });

  test("unmeasured images report unknown height (-1)", () => {
    const widget = findImageWidget(makeState());
    expect(widget.estimatedHeight).toBe(-1);
  });

  test("widgets rebuilt after a measurement reuse the cached height", () => {
    __testImage.imageHeightCache.set("assets/diagram.png", 240);
    const widget = findImageWidget(makeState());
    expect(widget.estimatedHeight).toBe(240);
  });
});

describe("imageExtension while the destination is being typed", () => {
  const imageWidgets = (state: EditorState): number => {
    let count = 0;
    state.field(foldExtension).between(0, state.doc.length, (_from, _to, decoration) => {
      if ((decoration.spec as { widget?: unknown }).widget) count++;
    });
    return count;
  };
  const urlFrom = doc.indexOf("assets");
  const imageEnd = doc.indexOf(")") + 1;

  test("no preview while the caret is inside the URL", () => {
    expect(imageWidgets(makeState(urlFrom + 3))).toBe(0);
  });

  test("the preview shows once the caret is past the closing paren", () => {
    expect(imageWidgets(makeState(imageEnd))).toBe(1);
  });

  test("the preview shows while the caret is in the alt text", () => {
    expect(imageWidgets(makeState(doc.indexOf("diagram") + 2))).toBe(1);
  });
});
