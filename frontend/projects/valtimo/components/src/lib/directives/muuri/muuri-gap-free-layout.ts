/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Custom Muuri layout function — "beautiful" gap-free packing.
 *
 * Each widget occupies a whole number of grid columns (1-4) and a whole
 * number of row units (height scales with content). The grid column count is
 * derived from the actual item dimensions so the algorithm works identically
 * for case widgets (320px / 200px) and dashboard widgets (275px / 220px)
 * without hardcoding either constant.
 *
 * Goal (in priority order):
 *   1. Never leave a gap trapped in the middle (a hole with a widget below it).
 *   2. Keep the block compact (minimise height) and push any unavoidable
 *      gaps to the bottom-right corner.
 *   3. Respect the source order as much as the above two allow.
 *
 * To achieve this we treat each section as a small 2D strip-packing problem
 * and search:
 *   - over the number of columns to actually use (sometimes a narrower block
 *     packs into a cleaner rectangle than spreading across every column);
 *   - over widget orderings (reordering is allowed to fill gaps).
 * Every candidate layout is scored and the prettiest one wins. Because the
 * packing only depends on the column/row spans and the column count (not the
 * exact pixel width) results are memoised and reused across resizes.
 *
 * Compatible with Muuri's custom layout function API (v0.9.x):
 *   layout(grid, layoutId, items, gridWidth, gridHeight, callback)
 */

/** Maximum number of grid columns to consider when detecting the column count. */
const MAX_COLS = 20;

/** Tolerance (in pixels) for floating-point width/height comparisons. */
const SNAP_PX = 1;

/**
 * How far (as a fraction of one column) an item width may deviate from a whole
 * number of columns and still be considered an integer span. Loose enough to
 * absorb sub-pixel column widths and widget margins, tight enough to reject a
 * grid that does not actually fit the widths.
 */
const COL_SNAP_RATIO = 0.12;

/** Above this item count we stop trying every permutation and use heuristics. */
const FULL_PERMUTATION_LIMIT = 7;

/** Scoring weights — tuned so each rule dominates the ones below it. */
const W_INTERNAL_GAP = 100000; // a hole with a widget below it: avoid at all costs
const W_BOTTOM_GAP = 1000; // an empty cell inside the full-width bounding box
const W_HEIGHT = 50; // prefer a compact (shorter) block
const W_GAP_NOT_RIGHT = 80; // push the bottom gaps towards the right
const W_INVERSION = 5; // respect the original order when everything else ties

interface Placement {
  cols: number[]; // column index per original item
  rows: number[]; // row index per original item
  height: number; // total rows used
}

/** Memoised packings keyed by span signature + column count. */
const layoutCache = new Map<string, Placement>();
const LAYOUT_CACHE_MAX = 256;

function muuriGapFreeLayout(
  grid: any,
  layoutId: number,
  items: any[],
  gridWidth: number,
  _gridHeight: number,
  callback: (layout: any) => void
): void {
  const slots = new Float32Array(items.length * 2);

  if (items.length === 0) {
    callback({id: layoutId, items, slots, width: gridWidth, height: 0, styles: {height: '0px'}});
    return;
  }

  // Pre-compute outer dimensions (pixels).
  const pxWidths: number[] = [];
  const pxHeights: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    pxWidths.push(item._width + item._marginLeft + item._marginRight);
    pxHeights.push(item._height + item._marginTop + item._marginBottom);
  }

  // Detect the column count and row unit from the item dimensions.
  const totalCols = detectTotalCols(pxWidths, gridWidth);
  const colWidth = gridWidth / totalCols;
  const rowHeight = detectRowHeight(pxHeights);

  // Convert each item to column/row units.
  const colSpans: number[] = [];
  const rowSpans: number[] = [];
  for (let i = 0; i < items.length; i++) {
    colSpans.push(Math.min(totalCols, Math.max(1, Math.round(pxWidths[i] / colWidth))));
    rowSpans.push(Math.max(1, Math.round(pxHeights[i] / rowHeight)));
  }

  const placement = packSection(colSpans, rowSpans, totalCols);

  // Convert grid positions to pixel coordinates.
  for (let i = 0; i < items.length; i++) {
    slots[i * 2] = Math.round(placement.cols[i] * colWidth);
    slots[i * 2 + 1] = Math.round(placement.rows[i] * rowHeight);
  }

  const layoutHeight = Math.round(placement.height * rowHeight);

  const el = grid._element;
  const isBorderBox = el ? getComputedStyle(el).boxSizing === 'border-box' : false;
  const borderTop = grid._borderTop || 0;
  const borderBottom = grid._borderBottom || 0;
  const totalHeight = isBorderBox ? layoutHeight + borderTop + borderBottom : layoutHeight;

  callback({
    id: layoutId,
    items,
    slots,
    styles: {height: totalHeight + 'px'},
    width: gridWidth,
    height: layoutHeight,
  });
}

/**
 * Pack one section. Searches over the number of columns to use and over item
 * orderings, scoring every candidate, and returns the prettiest placement.
 */
function packSection(colSpans: number[], rowSpans: number[], maxCols: number): Placement {
  const key = `${colSpans.join(',')}|${rowSpans.join(',')}|${maxCols}`;
  const cached = layoutCache.get(key);
  if (cached) return cached;

  const n = colSpans.length;
  let best: Placement | null = null;
  let bestScore = Infinity;

  for (let k = maxCols; k >= 1; k--) {
    // Widgets wider than the current column count become full-width.
    const cs = colSpans.map(c => Math.min(c, k));
    const orders = generateOrders(n, cs, rowSpans);

    for (const order of orders) {
      const placed = firstFitPack(order, cs, rowSpans, k);
      const score = scorePlacement(placed, cs, rowSpans, maxCols);
      if (score < bestScore) {
        bestScore = score;
        best = placed;
      }
    }
  }

  const result = best as Placement;
  if (layoutCache.size >= LAYOUT_CACHE_MAX) layoutCache.clear();
  layoutCache.set(key, result);
  return result;
}

/**
 * Place items (in the given order) into a `k`-column grid using top-left-first
 * first-fit. Returns the column/row of each item indexed by its original index.
 */
function firstFitPack(
  order: number[],
  colSpans: number[],
  rowSpans: number[],
  k: number
): Placement {
  const occupied: boolean[][] = [];
  let gridRows = 0;
  const cols = new Array<number>(colSpans.length);
  const rows = new Array<number>(colSpans.length);

  const ensureRows = (needed: number): void => {
    while (gridRows < needed) {
      occupied.push(new Array(k).fill(false));
      gridRows++;
    }
  };

  for (const idx of order) {
    const cw = colSpans[idx];
    const rh = rowSpans[idx];
    let placed = false;

    for (let r = 0; !placed; r++) {
      ensureRows(r + rh);
      for (let c = 0; c <= k - cw; c++) {
        if (canPlace(occupied, r, c, rh, cw)) {
          markOccupied(occupied, r, c, rh, cw);
          cols[idx] = c;
          rows[idx] = r;
          placed = true;
          break;
        }
      }
    }
  }

  let height = 0;
  for (let i = 0; i < colSpans.length; i++) {
    height = Math.max(height, rows[i] + rowSpans[i]);
  }

  return {cols, rows, height};
}

/**
 * Score a placement — lower is prettier. Encodes the priority order:
 * no trapped gaps > compact (short) block > gaps bottom-right > original order.
 *
 * Waste is always measured against the full available width (`maxCols`), so a
 * tall narrow tower that leaves whole columns empty on the right is correctly
 * seen as gappy rather than "gap free". A narrower block is therefore only
 * chosen when it does not add height and produces a cleaner gap placement.
 */
function scorePlacement(
  placed: Placement,
  colSpans: number[],
  rowSpans: number[],
  maxCols: number
): number {
  const {cols, rows, height} = placed;
  const n = colSpans.length;

  // Build the occupancy grid across the full available width.
  const occ: boolean[][] = [];
  for (let r = 0; r < height; r++) occ.push(new Array(maxCols).fill(false));
  for (let i = 0; i < n; i++) {
    for (let r = rows[i]; r < rows[i] + rowSpans[i]; r++) {
      for (let c = cols[i]; c < cols[i] + colSpans[i]; c++) occ[r][c] = true;
    }
  }

  let internalGaps = 0;
  let bottomGaps = 0;
  let gapNotRight = 0;
  for (let c = 0; c < maxCols; c++) {
    let lastFilled = -1;
    for (let r = 0; r < height; r++) if (occ[r][c]) lastFilled = r;
    for (let r = 0; r < height; r++) {
      if (occ[r][c]) continue;
      if (r < lastFilled) {
        internalGaps++;
      } else {
        bottomGaps++;
        gapNotRight += maxCols - 1 - c;
      }
    }
  }

  const inversions = countInversions(cols, rows, n);

  return (
    internalGaps * W_INTERNAL_GAP +
    bottomGaps * W_BOTTOM_GAP +
    height * W_HEIGHT +
    gapNotRight * W_GAP_NOT_RIGHT +
    inversions * W_INVERSION
  );
}

/**
 * Number of pairs whose reading order (top-to-bottom, left-to-right) differs
 * from their original order. Used as a tie-breaker to respect source order.
 */
function countInversions(cols: number[], rows: number[], n: number): number {
  const order = Array.from({length: n}, (_, i) => i).sort((a, b) =>
    rows[a] !== rows[b] ? rows[a] - rows[b] : cols[a] - cols[b]
  );
  const rank = new Array<number>(n);
  for (let pos = 0; pos < n; pos++) rank[order[pos]] = pos;

  let inversions = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) if (rank[i] > rank[j]) inversions++;
  }
  return inversions;
}

/**
 * Candidate orderings to try. For small sections every permutation is tried;
 * for larger sections a handful of size-based heuristics keeps it fast.
 */
function generateOrders(n: number, colSpans: number[], rowSpans: number[]): number[][] {
  const identity = Array.from({length: n}, (_, i) => i);
  if (n <= 1) return [identity];
  if (n <= FULL_PERMUTATION_LIMIT) return permutations(identity);

  const byArea = [...identity].sort(
    (a, b) => colSpans[b] * rowSpans[b] - colSpans[a] * rowSpans[a]
  );
  const byHeight = [...identity].sort(
    (a, b) => rowSpans[b] - rowSpans[a] || colSpans[b] - colSpans[a]
  );
  const byWidth = [...identity].sort(
    (a, b) => colSpans[b] - colSpans[a] || rowSpans[b] - rowSpans[a]
  );
  return dedupeOrders([identity, byArea, byHeight, byWidth]);
}

/** All permutations of the given index array (used only for small sections). */
function permutations(arr: number[]): number[][] {
  if (arr.length <= 1) return [arr];
  const result: number[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const perm of permutations(rest)) result.push([arr[i], ...perm]);
  }
  return result;
}

function dedupeOrders(orders: number[][]): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  for (const o of orders) {
    const key = o.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(o);
    }
  }
  return out;
}

/**
 * Detect the number of grid columns: the *coarsest* grid (smallest column
 * count, from 1 up to MAX_COLS) in which every item width is approximately a
 * whole number of columns. A coarser grid is always preferred — a finer grid
 * that merely happens to also divide the widths (e.g. describing 1x/2x widgets
 * as 6/12 columns) yields the exact same pixel layout but destabilises the
 * column spans and the packing search.
 */
function detectTotalCols(pxWidths: number[], gridWidth: number): number {
  for (let n = 1; n <= MAX_COLS; n++) {
    const unit = gridWidth / n;
    let valid = true;
    for (const w of pxWidths) {
      if (w < SNAP_PX) continue;
      const ratio = w / unit;
      if (Math.round(ratio) < 1 || Math.abs(ratio - Math.round(ratio)) > COL_SNAP_RATIO) {
        valid = false;
        break;
      }
    }
    if (valid) return n;
  }
  return 1;
}

/**
 * Detect the base row unit as the greatest common divisor of the item heights.
 * Heights are exact integer multiples of the base unit (e.g. 200 for case
 * widgets, 220 for dashboard widgets); the GCD recovers that base even when a
 * section happens to contain no single-row-tall widget.
 */
function detectRowHeight(pxHeights: number[]): number {
  let unit = 0;
  for (const h of pxHeights) {
    const rounded = Math.round(h);
    if (rounded > SNAP_PX) unit = gcd(unit, rounded);
  }
  return unit > SNAP_PX ? unit : 200;
}

function gcd(a: number, b: number): number {
  while (b > 0) {
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

/** Check if an item of size (rowSpan × colSpan) can be placed at (row, col). */
function canPlace(
  occupied: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): boolean {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (occupied[r][c]) return false;
    }
  }
  return true;
}

/** Mark cells as occupied for an item placed at (row, col). */
function markOccupied(
  occupied: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): void {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) occupied[r][c] = true;
  }
}

export {muuriGapFreeLayout};
