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
 * Custom Muuri layout function that produces a gap-free layout while
 * respecting item order as much as possible.
 *
 * Algorithm (two-phase):
 *   Phase 1 — Global assignment: greedily assign all items to row-groups
 *   using span-descending partition matching (minimises gaps). Then sort
 *   the row-groups by their earliest item index so that earlier items
 *   appear near the top of the layout.
 *
 *   Phase 2 — Row-group placement: place each row-group's items
 *   side-by-side, each at its own per-column height-map Y (not a
 *   shared row Y). Tries all column orderings to minimise max
 *   bottom. Leftovers are placed via dense gap-filling.
 *
 * Compatible with Muuri's custom layout function API (v0.9.x):
 *   layout: function(grid, layoutId, items, gridWidth, gridHeight, callback)
 */
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

  // Collect each item's outer dimensions.
  const outerWidths: number[] = [];
  const outerHeights: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    outerWidths.push(item._width + item._marginLeft + item._marginRight);
    outerHeights.push(item._height + item._marginTop + item._marginBottom);
  }

  // Detect the column unit from the narrowest item.
  let colUnit = gridWidth;
  for (let i = 0; i < outerWidths.length; i++) {
    if (outerWidths[i] > 0 && outerWidths[i] < colUnit) {
      colUnit = outerWidths[i];
    }
  }

  const numCols = Math.max(1, Math.round(gridWidth / colUnit));
  const actualColWidth = gridWidth / numCols;

  // Convert item widths to column-span counts.
  const itemColSpans: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const span = Math.round(outerWidths[i] / actualColWidth);
    itemColSpans.push(Math.max(1, Math.min(span, numCols)));
  }

  // ---------- Phase 1: Global assignment ----------

  /**
   * Generate all integer partitions of `n` with parts in 1..maxPart and
   * at most `maxLen` parts. Returned in span-descending order.
   */
  function partitions(n: number, maxPart: number, maxLen: number): number[][] {
    const result: number[][] = [];
    const current: number[] = [];
    function gen(remaining: number, largest: number, depth: number): void {
      if (remaining === 0) { result.push(current.slice()); return; }
      if (depth >= maxLen) return;
      const hi = Math.min(remaining, largest);
      for (let p = hi; p >= 1; p--) {
        current.push(p);
        gen(remaining - p, p, depth + 1);
        current.pop();
      }
    }
    gen(n, maxPart, 0);
    return result;
  }

  const allParts = partitions(numCols, numCols, numCols);

  // Build span → item-index buckets (original order within each span).
  const spanBuckets: number[][] = new Array(numCols + 1);
  for (let s = 0; s <= numCols; s++) spanBuckets[s] = [];
  for (let i = 0; i < items.length; i++) {
    spanBuckets[itemColSpans[i]].push(i);
  }
  // Pointer into each bucket: how many items have been consumed so far.
  const bucketPtr: number[] = new Array(numCols + 1).fill(0);

  // Greedily assign items to row-groups using span-descending partitions.
  // Each row-group is an array of item indices whose spans sum to numCols.
  const rowGroups: number[][] = [];
  let assigned = true;
  while (assigned) {
    assigned = false;
    for (const part of allParts) {
      // Check if enough items remain for this partition.
      const need: number[] = new Array(numCols + 1).fill(0);
      for (const p of part) need[p]++;
      let ok = true;
      for (let s = 1; s <= numCols; s++) {
        if (bucketPtr[s] + need[s] > spanBuckets[s].length) { ok = false; break; }
      }
      if (!ok) continue;

      // Assign earliest available items of each span.
      const group: number[] = [];
      for (let s = 1; s <= numCols; s++) {
        for (let k = 0; k < need[s]; k++) {
          group.push(spanBuckets[s][bucketPtr[s] + k]);
        }
        bucketPtr[s] += need[s];
      }
      rowGroups.push(group);
      assigned = true;
      break; // restart — bucket pointers changed
    }
  }

  // Collect leftover items (couldn't form a complete row).
  const leftovers: number[] = [];
  for (let s = 1; s <= numCols; s++) {
    for (let k = bucketPtr[s]; k < spanBuckets[s].length; k++) {
      leftovers.push(spanBuckets[s][k]);
    }
  }

  // Sort row-groups by their minimum (earliest) item index.
  for (const group of rowGroups) {
    group.sort((a, b) => a - b); // within group: original order left-to-right
  }
  rowGroups.sort((a, b) => a[0] - b[0]);

  // Sort leftovers by original index.
  leftovers.sort((a, b) => a - b);

  // ---------- Phase 2: Row-group placement with height-map ----------
  //
  // Place each row-group as a unit: items are laid out side-by-side on
  // the same row, starting at the lowest Y where all required columns
  // are available. This preserves the perfect width-packing from Phase 1
  // and keeps row-group items visually together.
  //
  // After all row-groups are placed, use a height-map-based backfill to
  // close small gaps caused by height differences between items within
  // a row. Leftovers are placed individually at the best position.

  const heightMap = new Float64Array(numCols);
  let layoutHeight = 0;

  /**
   * Generate all permutations of a small array (used for row-group
   * column ordering — groups are typically 2-3 items).
   */
  function permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = arr.slice(0, i).concat(arr.slice(i + 1));
      for (const perm of permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }

  /**
   * Evaluate a column ordering for a row-group: place items left-to-right
   * in the given order, each at its per-column height-map Y. Returns
   * the maximum bottom Y after placing all items (lower is better) and
   * the per-item assignments.
   */
  function evalOrdering(ordering: number[]): {
    assignments: {idx: number; col: number; y: number}[];
    maxBottom: number;
  } {
    // Simulate placement on a copy of the height-map so that
    // later items in the ordering see the effect of earlier ones.
    const simMap = new Float64Array(heightMap);
    const assignments: {idx: number; col: number; y: number}[] = [];
    let col = 0;
    let maxBottom = 0;
    for (const idx of ordering) {
      const span = itemColSpans[idx];
      const h = outerHeights[idx];
      // Per-item Y: the max simulated height-map value for this item's columns.
      let itemY = 0;
      for (let cc = col; cc < col + span; cc++) {
        if (simMap[cc] > itemY) itemY = simMap[cc];
      }
      assignments.push({idx, col, y: itemY});
      const bottom = itemY + h;
      for (let cc = col; cc < col + span; cc++) {
        simMap[cc] = bottom;
      }
      if (bottom > maxBottom) maxBottom = bottom;
      col += span;
    }
    return {assignments, maxBottom};
  }

  // Place all row-groups. For each group, try all column orderings
  // and pick the one that minimises the maximum bottom Y. Each item
  // is placed at its own per-column Y (not a shared row Y), which
  // eliminates gaps when items have different heights.
  for (const group of rowGroups) {
    const perms = group.length <= 4 ? permutations(group) : [group];
    let bestAssignments: {idx: number; col: number; y: number}[] = [];
    let bestMaxBottom = Infinity;

    for (const ordering of perms) {
      const {assignments, maxBottom} = evalOrdering(ordering);
      if (maxBottom < bestMaxBottom) {
        bestMaxBottom = maxBottom;
        bestAssignments = assignments;
      }
    }

    for (const {idx, col, y} of bestAssignments) {
      const span = itemColSpans[idx];
      const h = outerHeights[idx];

      slots[idx * 2] = Math.round(col * actualColWidth);
      slots[idx * 2 + 1] = y;

      const bottom = y + h;
      for (let cc = col; cc < col + span; cc++) {
        heightMap[cc] = bottom;
      }
      if (bottom > layoutHeight) layoutHeight = bottom;
    }
  }

  // Place leftovers individually at the best height-map position.
  // Use findBestCol to find the lowest available position.
  function findBestCol(span: number): {col: number; y: number} {
    let bestCol = 0;
    let bestY = Infinity;
    for (let c = 0; c <= numCols - span; c++) {
      let maxY = 0;
      for (let cc = c; cc < c + span; cc++) {
        if (heightMap[cc] > maxY) maxY = heightMap[cc];
      }
      if (maxY < bestY) {
        bestY = maxY;
        bestCol = c;
      }
    }
    return {col: bestCol, y: bestY};
  }

  // Build leftover placement queue, but use a dense approach:
  // repeatedly find the lowest point in the height-map and place
  // the best-fitting leftover item there.
  const placedLeftovers = new Set<number>();

  while (placedLeftovers.size < leftovers.length) {
    // Find the minimum height in the height-map.
    let minH = heightMap[0];
    for (let c = 1; c < numCols; c++) {
      if (heightMap[c] < minH) minH = heightMap[c];
    }

    // Find all gap regions at the minimum height.
    const gapRegions: {start: number; span: number}[] = [];
    let regionStart = -1;
    for (let c = 0; c <= numCols; c++) {
      if (c < numCols && heightMap[c] <= minH + 0.5) {
        if (regionStart === -1) regionStart = c;
      } else {
        if (regionStart !== -1) {
          gapRegions.push({start: regionStart, span: c - regionStart});
          regionStart = -1;
        }
      }
    }

    // Sort gap regions widest first.
    gapRegions.sort((a, b) => b.span - a.span);

    let placedAny = false;
    for (const gap of gapRegions) {
      // Find the best-fitting unplaced leftover for this gap.
      // Best fit = span closest to gap width, earliest index as tiebreaker.
      let bestIdx = -1;
      let bestSpan = 0;
      for (const idx of leftovers) {
        if (placedLeftovers.has(idx)) continue;
        const s = itemColSpans[idx];
        if (s <= gap.span && s > bestSpan) {
          bestSpan = s;
          bestIdx = idx;
          if (s === gap.span) break;
        }
      }

      if (bestIdx !== -1) {
        const span = itemColSpans[bestIdx];
        const h = outerHeights[bestIdx];

        // Place at the best column within the gap region.
        let bestCol = gap.start;
        let bestY = Infinity;
        for (let c = gap.start; c <= gap.start + gap.span - span; c++) {
          let maxY = 0;
          for (let cc = c; cc < c + span; cc++) {
            if (heightMap[cc] > maxY) maxY = heightMap[cc];
          }
          if (maxY < bestY) { bestY = maxY; bestCol = c; }
        }

        slots[bestIdx * 2] = Math.round(bestCol * actualColWidth);
        slots[bestIdx * 2 + 1] = bestY;

        const bottom = bestY + h;
        for (let cc = bestCol; cc < bestCol + span; cc++) {
          heightMap[cc] = bottom;
        }
        if (bottom > layoutHeight) layoutHeight = bottom;

        placedLeftovers.add(bestIdx);
        placedAny = true;
        break; // re-evaluate height-map
      }
    }

    if (!placedAny) {
      // No leftover fits any gap. Force-place the next unplaced leftover.
      for (const idx of leftovers) {
        if (placedLeftovers.has(idx)) continue;
        const span = itemColSpans[idx];
        const h = outerHeights[idx];
        const {col, y} = findBestCol(span);

        slots[idx * 2] = Math.round(col * actualColWidth);
        slots[idx * 2 + 1] = y;

        const bottom = y + h;
        for (let cc = col; cc < col + span; cc++) {
          heightMap[cc] = bottom;
        }
        if (bottom > layoutHeight) layoutHeight = bottom;

        placedLeftovers.add(idx);
        break;
      }
    }
  }

  // Muuri expects layout.styles to set the container height.
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

export {muuriGapFreeLayout};
