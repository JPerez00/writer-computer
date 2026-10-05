import { describe, expect, test } from "vite-plus/test";
import { __test } from "../src/components/editor-area/heading-decorations";

const { getMarkdownHeadingLevel } = __test;

describe("getMarkdownHeadingLevel", () => {
  test("returns levels for ATX headings", () => {
    expect(getMarkdownHeadingLevel("ATXHeading1")).toBe(1);
    expect(getMarkdownHeadingLevel("ATXHeading6")).toBe(6);
  });

  test("returns levels for Setext headings", () => {
    expect(getMarkdownHeadingLevel("SetextHeading1")).toBe(1);
    expect(getMarkdownHeadingLevel("SetextHeading2")).toBe(2);
  });

  test("returns null for non-heading nodes", () => {
    expect(getMarkdownHeadingLevel("Paragraph")).toBeNull();
    expect(getMarkdownHeadingLevel("ATXHeading7")).toBeNull();
    expect(getMarkdownHeadingLevel("SetextHeading3")).toBeNull();
  });
});
