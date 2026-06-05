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
 * Custom Muuri layout function — FFDH + CSS Grid Dense packing.
 *
 * Works on a virtual cell grid (columns × rows). Derives the column count
 * and row height from the actual item dimensions so that the algorithm
 * works identically for both case widgets (320px / 200px) and dashboard
 * widgets (275px / 220px) without hardcoding either constant. Items are
 * sorted by height descending (tallest first) so that tall items anchor
 * rows and shorter items backfill remaining cells — similar to CSS
 * Grid's `auto-flow: dense`.
 *
 * The result is a tight rectangular layout with gaps only at the
 * bottom-right, never sandwiched in the middle.
 *
 * Compatible with Muuri's custom layout function API (v0.9.x):
 *   layout(grid, layoutId, items, gridWidth, gridHeight, callback)
 */

/** Maximum number of grid columns to consider when detecting the column count. */
const MAX_COLS = 20;

/** Tolerance (in pixels) for floating-point width/height comparisons. */
const SNAP_PX = 1;

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

  // Detect the number of grid columns and row unit height from item
  // dimensions. This avoids hardcoding constants that differ between
  // the case widget system and the dashboard widget system.
  const totalCols = detectTotalCols(pxWidths, gridWidth);
  const colWidth = gridWidth / totalCols;
  const rowHeight = detectRowHeight(pxHeights);

  // Convert each item to column/row units.
  const colSpans: number[] = [];
  const rowSpans: number[] = [];
  for (let i = 0; i < items.length; i++) {
    colSpans.push(Math.max(1, Math.round(pxWidths[i] / colWidth)));
    rowSpans.push(Math.max(1, Math.round(pxHeights[i] / rowHeight)));
  }

  // Create sort order: height descending, then width descending for tie-breaking,
  // then original index ascending to preserve DOM order among equal-sized items.
  const order = items.map((_, i) => i);
  order.sort((a, b) => {
    const hd = rowSpans[b] - rowSpans[a];
    if (hd !== 0) return hd;
    const wd = colSpans[b] - colSpans[a];
    if (wd !== 0) return wd;
    return a - b;
  });

  // Occupancy grid: occupied[row][col] = true if cell is taken.
  // Start with a generous estimate; we'll grow as needed.
  let gridRows = 16;
  const occupied: boolean[][] = [];
  for (let r = 0; r < gridRows; r++) {
    occupied.push(new Array(totalCols).fill(false));
  }

  // Placed positions in grid units, indexed by original item index.
  const placedCol: number[] = new Array(items.length);
  const placedRow: number[] = new Array(items.length);

  // Place each item in sorted order.
  for (const idx of order) {
    const cw = colSpans[idx];
    const rh = rowSpans[idx];

    if (cw <= 0 || rh <= 0) {
      placedCol[idx] = 0;
      placedRow[idx] = 0;
      continue;
    }

    // Find first position (top-left scan) where item fits.
    let placed = false;
    for (let r = 0; !placed; r++) {
      // Grow occupancy grid if needed.
      while (r + rh > gridRows) {
        occupied.push(new Array(totalCols).fill(false));
        gridRows++;
      }

      for (let c = 0; c <= totalCols - cw; c++) {
        if (canPlace(occupied, r, c, rh, cw, gridRows)) {
          markOccupied(occupied, r, c, rh, cw);
          placedCol[idx] = c;
          placedRow[idx] = r;
          placed = true;
          break;
        }
      }
    }
  }

  // Convert grid positions to pixel coordinates.
  for (let i = 0; i < items.length; i++) {
    slots[i * 2] = Math.round(placedCol[i] * colWidth);
    slots[i * 2 + 1] = Math.round(placedRow[i] * rowHeight);
  }

  // Compute total layout height from the occupancy grid.
  let maxOccupiedRow = 0;
  for (let r = gridRows - 1; r >= 0; r--) {
    if (occupied[r].some(v => v)) {
      maxOccupiedRow = r + 1;
      break;
    }
  }
  const layoutHeight = Math.round(maxOccupiedRow * rowHeight);

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
 * Detect the number of grid columns by finding the largest n (up to
 * MAX_COLS) such that every item width is approximately an integer
 * multiple of gridWidth/n.
 */
function detectTotalCols(pxWidths: number[], gridWidth: number): number {
  for (let n = MAX_COLS; n >= 2; n--) {
    const unit = gridWidth / n;
    let valid = true;
    for (const w of pxWidths) {
      if (w < SNAP_PX) continue;
      const ratio = w / unit;
      if (Math.abs(ratio - Math.round(ratio)) > SNAP_PX / unit) {
        valid = false;
        break;
      }
    }
    if (valid) return n;
  }
  return 1;
}

/**
 * Detect the row unit height as the smallest positive item height.
 * All item heights are expected to be integer multiples of this unit
 * (e.g. 200, 400, 600 for case widgets or 220, 440, 660 for dashboard).
 */
function detectRowHeight(pxHeights: number[]): number {
  let minH = Infinity;
  for (const h of pxHeights) {
    if (h > SNAP_PX && h < minH) minH = h;
  }
  return minH === Infinity ? 200 : minH;
}

/**
 * Check if an item of size (rowSpan × colSpan) can be placed at (row, col).
 */
function canPlace(
  occupied: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number,
  gridRows: number
): boolean {
  if (row + rowSpan > gridRows) return false;
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      if (occupied[r][c]) return false;
    }
  }
  return true;
}

/**
 * Mark cells as occupied for an item placed at (row, col).
 */
function markOccupied(
  occupied: boolean[][],
  row: number,
  col: number,
  rowSpan: number,
  colSpan: number
): void {
  for (let r = row; r < row + rowSpan; r++) {
    for (let c = col; c < col + colSpan; c++) {
      occupied[r][c] = true;
    }
  }
}

export {muuriGapFreeLayout};
