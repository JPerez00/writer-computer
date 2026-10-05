# Markdown Heading Top Padding Spec

> **Superseded (2026-10-04).** The padding was removed along with the shrunken blank lines: user feedback showed the gap above a heading read as half blank line, half margin, so deleting the blank line seemed to do nothing. Space between blocks now comes only from blank lines in the file, with headings padding their own line to the spacing scale in `prosemark-theme.css`. The `cm-markdown-heading` class is gone; `cm-heading-line` / `cm-heading-line-N` remain.

## Goal

Give every rendered Markdown heading in the editor a small amount of top
spacing so section breaks are easier to scan while preserving the existing
hanging ATX hash behavior.

## Design

- Add a generic `cm-markdown-heading` line-decoration class to Markdown
  heading lines.
- Continue emitting the existing `cm-heading-line` and `cm-heading-line-N`
  classes for compatibility with hanging hash positioning and level-specific
  styling.
- Treat ATX H1-H6 and Setext H1-H2 as Markdown headings for the line class.
- Keep ATX hash decorations and selection no-go zones ATX-only.
- Style `.cm-editor .cm-markdown-heading` with `padding-top: 1rem`.

## Validation

- Unit-test heading node classification for ATX and Setext heading names.
- Unit-test that Setext headings do not create ATX hash no-go zones.
- Run `vp check` and `vp test`.
