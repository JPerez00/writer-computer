import { EditorSelection, type SelectionRange } from "@codemirror/state";
import { Direction, type EditorView, type KeyBinding, keymap } from "@codemirror/view";

// Home / End (and Cmd-←/→ on macOS) move to the visual line boundary, as in
// `@codemirror/commands`' `moveByLineBoundary`, with one guard. CodeMirror
// finds a wrapped row's end with `posAtCoords` at the row's right edge, and
// hidden markup there (an escape's `\`, a folded link's URL) can resolve to a
// position on the wrong side of the caret: End on the last row of
// `…an escaped \*x\*, and a [link](…).` landed before the second `\*`, so
// End + Enter split the paragraph. A boundary move never goes backwards (or,
// for Home, forwards), so when it does, use the document line's boundary.
function moveByLineBoundary(
  view: EditorView,
  start: SelectionRange,
  forward: boolean,
): SelectionRange {
  const line = view.lineBlockAt(start.head);
  let moved = view.moveToLineBoundary(start, forward);
  const wrongWay = forward ? moved.head < start.head : moved.head > start.head;
  if (wrongWay || (moved.head === start.head && moved.head !== (forward ? line.to : line.from))) {
    moved = view.moveToLineBoundary(start, forward, false);
  }
  if (!forward && moved.head === line.from && line.length) {
    const head = view.state.sliceDoc(line.from, Math.min(line.from + 100, line.to));
    const space = /^\s*/.exec(head)?.[0].length ?? 0;
    if (space && start.head !== line.from + space) {
      moved = EditorSelection.cursor(line.from + space);
    }
  }
  return moved;
}

function boundaryCommand(direction: "forward" | "backward" | "left" | "right", extend: boolean) {
  return (view: EditorView): boolean => {
    const { selection } = view.state;
    const ranges = selection.ranges.map((range) => {
      const ltr = view.textDirectionAt(range.head) === Direction.LTR;
      const forward =
        direction === "forward" || (direction === "right" && ltr) || (direction === "left" && !ltr);
      const moved = moveByLineBoundary(view, range, forward);
      return extend ? EditorSelection.range(range.anchor, moved.head) : moved;
    });
    const next = EditorSelection.create(ranges, selection.mainIndex);
    // Consumed even when nothing moves: falling through would hand the key to
    // `defaultKeymap`'s unguarded command, which is the bug this guards.
    if (!next.eq(selection)) {
      view.dispatch({ selection: next, scrollIntoView: true, userEvent: "select" });
    }
    return true;
  };
}

const bindings: KeyBinding[] = [
  {
    key: "Home",
    run: boundaryCommand("backward", false),
    shift: boundaryCommand("backward", true),
    preventDefault: true,
  },
  {
    key: "End",
    run: boundaryCommand("forward", false),
    shift: boundaryCommand("forward", true),
    preventDefault: true,
  },
  {
    mac: "Cmd-ArrowLeft",
    run: boundaryCommand("left", false),
    shift: boundaryCommand("left", true),
    preventDefault: true,
  },
  {
    mac: "Cmd-ArrowRight",
    run: boundaryCommand("right", false),
    shift: boundaryCommand("right", true),
    preventDefault: true,
  },
];

export const lineBoundaryKeymap = keymap.of(bindings);
