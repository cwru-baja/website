/**
 * Balanced rows for the phone's part chips. A chapter's labels have no reading
 * order - each was placed where its part sits on the still - so the chips are
 * packed into as few rows as fit, as evenly as they go, instead of filling each
 * row in turn and leaving a ragged edge. Then they are put back in label order
 * as far as that allows: rows by their first label, chips in a row by label.
 */
export interface ChipLayout {
  /** Chip indices, row by row. */
  rows: number[][];
  /** The widest row, which is how wide the block is. */
  width: number;
}

interface Packing {
  bins: number[][];
  /** The widest row. */
  max: number;
  /** Sum of squared row widths: lower is more even, for the same total. */
  squares: number;
}

// Past this many placements the search keeps the best split it has found. The
// first one it reaches is already the classic greedy (widest chip into the
// narrowest row), and the chapters today need a few thousand at most.
const SEARCH_BUDGET = 200_000;

/**
 * The most even split of these widths into at most `rows` rows: the narrowest
 * widest row, and of those, the one with the least lopsided rows. An exact
 * search - there are never more than a dozen or so chips - that places the
 * widest chips first and tries the narrowest row first, and never tries two
 * rows that are equally full, since they would give the same splits.
 */
export const packRows = (widths: number[], gap: number, rows: number): Packing => {
  const order = widths
    .map((_, index) => index)
    .sort((left, right) => widths[right] - widths[left] || left - right);
  const loads = new Array<number>(rows).fill(0);
  const bins: number[][] = Array.from({ length: rows }, () => []);
  const best: Packing = { bins: [], max: Infinity, squares: Infinity };
  let budget = SEARCH_BUDGET;

  const place = (next: number, max: number, squares: number) => {
    // Rows only get wider, so a split already no better than the best is done.
    if (max > best.max || (max === best.max && squares >= best.squares)) return;
    if (next === order.length) {
      Object.assign(best, { bins: bins.map((bin) => [...bin]), max, squares });
      return;
    }
    if ((budget -= 1) < 0) return;
    const chip = order[next];
    const tried = new Set<number>();
    const byLoad = loads
      .map((_, row) => row)
      .sort((left, right) => loads[left] - loads[right] || left - right);
    for (const row of byLoad) {
      const before = loads[row];
      if (tried.has(before)) continue;
      tried.add(before);
      const after = before === 0 ? widths[chip] : before + gap + widths[chip];
      loads[row] = after;
      bins[row].push(chip);
      place(next + 1, Math.max(max, after), squares - before * before + after * after);
      loads[row] = before;
      bins[row].pop();
    }
  };

  place(0, 0, 0);
  return best;
};

/**
 * The chips in the fewest rows, up to `maxRows`, that fit in `room`. When no
 * number of rows fits, it is `maxRows` rows as narrow as they go, which the
 * caller scrolls sideways. Widths are rounded up first, so fractional chip
 * widths never break a row the layout didn't plan for.
 */
export const balanceChips = (
  widths: number[],
  gap: number,
  maxRows: number,
  room: number,
): ChipLayout => {
  const whole = widths.map((width) => Math.ceil(width));
  if (!whole.length) return { rows: [], width: 0 };
  let packed = packRows(whole, gap, 1);
  for (let rows = 2; packed.max > room && rows <= Math.min(maxRows, whole.length); rows += 1) {
    packed = packRows(whole, gap, rows);
  }
  return {
    rows: packed.bins
      .filter((bin) => bin.length)
      .map((bin) => [...bin].sort((left, right) => left - right))
      .sort((left, right) => left[0] - right[0]),
    width: packed.max,
  };
};
