import { describe, expect, it } from "vitest";
import { balanceChips, packRows } from "./chipWrap";

// The phone chip widths measured on /car (Clash, 11 px, px-4).
const BRAKES = [93, 82, 172, 123];
const SUSPENSION = [184, 134, 166, 257];
const DRIVETRAIN = [101, 62, 198, 84, 237, 117, 188, 158, 124, 207, 198];

const rowWidths = (rows: number[][], widths: number[], gap = 8) =>
  rows.map((row) => row.reduce((sum, index) => sum + widths[index], 0) + gap * (row.length - 1));

// Every way to split the chips into at most `rows` rows, for checking the search.
const bruteForce = (widths: number[], gap: number, rows: number) => {
  let best = { max: Infinity, squares: Infinity };
  const loads = new Array<number>(rows).fill(0);
  const walk = (next: number) => {
    if (next === widths.length) {
      const max = Math.max(...loads);
      const squares = loads.reduce((sum, load) => sum + load * load, 0);
      if (max < best.max || (max === best.max && squares < best.squares)) best = { max, squares };
      return;
    }
    for (let row = 0; row < rows; row += 1) {
      const before = loads[row];
      loads[row] = before === 0 ? widths[next] : before + gap + widths[next];
      walk(next + 1);
      loads[row] = before;
    }
  };
  walk(0);
  return best;
};

describe("chip balancing", () => {
  it("finds the most even split there is", () => {
    [
      [BRAKES, 2],
      [SUSPENSION, 3],
      [DRIVETRAIN.slice(0, 8), 3],
      [DRIVETRAIN.slice(0, 9), 4],
    ].forEach(([widths, rows]) => {
      const packed = packRows(widths as number[], 8, rows as number);
      expect({ max: packed.max, squares: packed.squares }).toEqual(
        bruteForce(widths as number[], 8, rows as number),
      );
    });
  });

  it("uses the fewest rows that fit, evened out", () => {
    const layout = balanceChips(BRAKES, 8, 4, 312);
    // Caliper and brake lines, then rotor and master cylinders: 224 and 262,
    // where filling each row in turn gives 183 and 303.
    expect(layout.rows).toEqual([
      [0, 3],
      [1, 2],
    ]);
    expect(rowWidths(layout.rows, BRAKES)).toEqual([224, 262]);
    expect(layout.width).toBe(262);
  });

  it("keeps label order in one row, and rows in the order of their first label", () => {
    expect(balanceChips(SUSPENSION, 8, 1, 312).rows).toEqual([[0, 1, 2, 3]]);
    const rows = balanceChips(DRIVETRAIN, 8, 5, 390).rows;
    rows.forEach((row) => expect(row).toEqual([...row].sort((a, b) => a - b)));
    expect(rows.map((row) => row[0])).toEqual([...rows.map((row) => row[0])].sort((a, b) => a - b));
    expect(rows.flat().sort((a, b) => a - b)).toEqual(DRIVETRAIN.map((_, index) => index));
  });

  it("fits the drivetrain into five rows on a big phone, where filling rows in turn scrolled", () => {
    const layout = balanceChips(DRIVETRAIN, 8, 5, 390);
    expect(layout.rows).toHaveLength(5);
    expect(layout.width).toBeLessThanOrEqual(390);
    const widths = rowWidths(layout.rows, DRIVETRAIN);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(60);
  });

  it("scrolls as little as it can when no number of rows fits", () => {
    const layout = balanceChips(DRIVETRAIN, 8, 4, 312);
    expect(layout.rows).toHaveLength(4);
    expect(layout.width).toBeGreaterThan(312);
    // Filling rows in turn needed 487.
    expect(layout.width).toBeLessThan(450);
    expect(layout.width).toBe(bruteForce(DRIVETRAIN.map(Math.ceil), 8, 4).max);
  });

  it("rounds fractional chips up, so a row never wraps early", () => {
    expect(balanceChips([100.2, 100.2], 8, 1, 150).width).toBe(210);
    expect(balanceChips([], 8, 3, 300)).toEqual({ rows: [], width: 0 });
  });
});
