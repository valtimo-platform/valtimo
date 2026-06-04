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
 * Custom Muuri layout function that produces a gap-free, left-aligned
 * layout while preserving item order.
 *
 * Algorithm: Skyline Bottom-Left with waste-map backfill and two-item
 * lookahead.
 *
 * Items are processed in DOM order. For each item the algorithm:
 *   1. Tries to place it inside an existing waste rectangle (backfill).
 *   2. If no waste rect fits, evaluates every valid skyline position.
 *      For each candidate position, it simulates placing the *next*
 *      unplaced item on the resulting skyline and picks the position
 *      that minimises total skyline unevenness after both placements.
 *      This two-step lookahead prevents greedy single-step choices
 *      from creating cascading gaps.
 *
 * Compatible with Muuri's custom layout function API (v0.9.x):
 *   layout: function(grid, layoutId, items, gridWidth, gridHeight, callback)
 */

interface SkylineSegment {
  x: number;
  y: number;
  width: number;
}

interface WasteRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EPS = 0.5;

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

  const outerWidths: number[] = [];
  const outerHeights: number[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    outerWidths.push(item._width + item._marginLeft + item._marginRight);
    outerHeights.push(item._height + item._marginTop + item._marginBottom);
  }

  const skyline: SkylineSegment[] = [{x: 0, y: 0, width: gridWidth}];
  const wasteRects: WasteRect[] = [];
  let layoutHeight = 0;

  for (let i = 0; i < items.length; i++) {
    const w = outerWidths[i];
    const h = outerHeights[i];

    if (w <= 0 || h <= 0) {
      slots[i * 2] = 0;
      slots[i * 2 + 1] = 0;
      continue;
    }

    // --- Phase 1: try to place in a waste rectangle (backfill) ---
    let placed = false;
    let bestWasteIdx = -1;
    let bestWasteY = Infinity;
    let bestWasteX = Infinity;

    for (let wi = 0; wi < wasteRects.length; wi++) {
      const wr = wasteRects[wi];
      if (w <= wr.width + EPS && h <= wr.height + EPS) {
        if (
          wr.y < bestWasteY - EPS ||
          (Math.abs(wr.y - bestWasteY) < EPS && wr.x < bestWasteX)
        ) {
          bestWasteY = wr.y;
          bestWasteX = wr.x;
          bestWasteIdx = wi;
        }
      }
    }

    if (bestWasteIdx >= 0) {
      const wr = wasteRects[bestWasteIdx];
      slots[i * 2] = Math.round(wr.x);
      slots[i * 2 + 1] = Math.round(wr.y);

      const bottom = wr.y + h;
      if (bottom > layoutHeight) layoutHeight = bottom;

      const rightW = wr.width - w;
      const bottomH = wr.height - h;
      wasteRects.splice(bestWasteIdx, 1);
      if (rightW > EPS) {
        wasteRects.push({x: wr.x + w, y: wr.y, width: rightW, height: h});
      }
      if (bottomH > EPS) {
        wasteRects.push({x: wr.x, y: wr.y + h, width: wr.width, height: bottomH});
      }
      placed = true;
    }

    if (placed) continue;

    // --- Phase 2: skyline placement with two-item lookahead ---

    // Find the next non-zero-sized item for lookahead.
    let nextW = 0;
    let nextH = 0;
    for (let ni = i + 1; ni < items.length; ni++) {
      if (outerWidths[ni] > EPS && outerHeights[ni] > EPS) {
        nextW = outerWidths[ni];
        nextH = outerHeights[ni];
        break;
      }
    }

    let bestScore = Infinity;
    let bestY = Infinity;
    let bestX = Infinity;
    let bestSegIdx = -1;

    for (let si = 0; si < skyline.length; si++) {
      const startX = skyline[si].x;
      if (startX + w > gridWidth + EPS) break;

      let maxY = 0;
      let coveredWidth = 0;
      for (let sj = si; sj < skyline.length && coveredWidth < w - EPS; sj++) {
        if (skyline[sj].y > maxY) maxY = skyline[sj].y;
        coveredWidth += skyline[sj].width;
      }
      if (coveredWidth < w - EPS) continue;

      const placedBottom = maxY + h;
      const itemRight = startX + w;

      // Simulate skyline after placing this item.
      const sim1 = simulateSkyline(skyline, startX, itemRight, placedBottom);

      // One-step unevenness.
      const uneven1 = skylineUnevenness(sim1);

      // Two-step lookahead: simulate the next item's best placement.
      let uneven2 = 0;
      if (nextW > EPS && nextH > EPS) {
        uneven2 = bestNextUnevenness(sim1, nextW, nextH, gridWidth);
      }

      const resultHeight = Math.max(layoutHeight, placedBottom);
      const score =
        (uneven1 + uneven2) * 1e6 + resultHeight * 1e2 + startX * 0.001;

      if (score < bestScore - EPS) {
        bestScore = score;
        bestY = maxY;
        bestX = startX;
        bestSegIdx = si;
      }
    }

    if (bestSegIdx < 0) {
      bestY = layoutHeight;
      bestX = 0;
      bestSegIdx = 0;
    }

    slots[i * 2] = Math.round(bestX);
    slots[i * 2 + 1] = Math.round(bestY);

    const bottom = bestY + h;
    if (bottom > layoutHeight) layoutHeight = bottom;

    // Update skyline and collect waste.
    applySkylineUpdate(skyline, wasteRects, bestX, bestX + w, bestY, bottom, bestSegIdx);
  }

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
 * Find the minimum unevenness achievable by placing an item of size
 * (nextW × nextH) on the given skyline. Returns the best unevenness.
 */
function bestNextUnevenness(
  skyline: SkylineSegment[],
  nextW: number,
  nextH: number,
  gridWidth: number
): number {
  let best = Infinity;

  for (let si = 0; si < skyline.length; si++) {
    const startX = skyline[si].x;
    if (startX + nextW > gridWidth + EPS) break;

    let maxY = 0;
    let coveredWidth = 0;
    for (let sj = si; sj < skyline.length && coveredWidth < nextW - EPS; sj++) {
      if (skyline[sj].y > maxY) maxY = skyline[sj].y;
      coveredWidth += skyline[sj].width;
    }
    if (coveredWidth < nextW - EPS) continue;

    const sim = simulateSkyline(skyline, startX, startX + nextW, maxY + nextH);
    const u = skylineUnevenness(sim);
    if (u < best) best = u;
  }

  return best === Infinity ? 0 : best;
}

/**
 * Compute skyline unevenness: total area between each segment and the
 * maximum height. A flat skyline returns 0.
 */
function skylineUnevenness(skyline: SkylineSegment[]): number {
  if (skyline.length <= 1) return 0;
  let maxY = 0;
  for (let i = 0; i < skyline.length; i++) {
    if (skyline[i].y > maxY) maxY = skyline[i].y;
  }
  let area = 0;
  for (let i = 0; i < skyline.length; i++) {
    const gap = maxY - skyline[i].y;
    if (gap > EPS) area += gap * skyline[i].width;
  }
  return area;
}

/**
 * Simulate the skyline after placing an item, without mutation.
 */
function simulateSkyline(
  skyline: SkylineSegment[],
  startX: number,
  itemRight: number,
  placedBottom: number
): SkylineSegment[] {
  const result: SkylineSegment[] = [];

  for (let si = 0; si < skyline.length; si++) {
    const seg = skyline[si];
    const segRight = seg.x + seg.width;

    if (segRight <= startX + EPS || seg.x >= itemRight - EPS) {
      result.push({x: seg.x, y: seg.y, width: seg.width});
    } else if (seg.x >= startX - EPS && segRight <= itemRight + EPS) {
      // Fully covered — skip.
    } else if (seg.x < startX - EPS && segRight > itemRight - EPS) {
      // Spans both sides — split.
      result.push({x: seg.x, y: seg.y, width: startX - seg.x});
      result.push({x: itemRight, y: seg.y, width: segRight - itemRight});
    } else if (seg.x < startX - EPS) {
      result.push({x: seg.x, y: seg.y, width: startX - seg.x});
    } else {
      result.push({x: itemRight, y: seg.y, width: segRight - itemRight});
    }
  }

  result.push({x: startX, y: placedBottom, width: itemRight - startX});
  result.sort((a, b) => a.x - b.x);

  let i = 0;
  while (i < result.length - 1) {
    const a = result[i];
    const b = result[i + 1];
    if (Math.abs((a.x + a.width) - b.x) < EPS && Math.abs(a.y - b.y) < EPS) {
      a.width += b.width;
      result.splice(i + 1, 1);
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Mutate the real skyline: collect waste rects and update segments.
 */
function applySkylineUpdate(
  skyline: SkylineSegment[],
  wasteRects: WasteRect[],
  startX: number,
  itemRight: number,
  placedY: number,
  placedBottom: number,
  startSegIdx: number
): void {
  let sx = startX;
  let segIdx = startSegIdx;

  while (segIdx < skyline.length && sx < itemRight - EPS) {
    const seg = skyline[segIdx];
    const segRight = seg.x + seg.width;
    const overlapLeft = Math.max(sx, seg.x);
    const overlapRight = Math.min(itemRight, segRight);
    const overlapWidth = overlapRight - overlapLeft;

    if (overlapWidth > EPS) {
      const gapHeight = placedY - seg.y;
      if (gapHeight > EPS) {
        wasteRects.push({
          x: overlapLeft,
          y: seg.y,
          width: overlapWidth,
          height: gapHeight,
        });
      }
    }

    if (segRight <= itemRight + EPS) {
      skyline.splice(segIdx, 1);
    } else {
      const trimAmount = itemRight - seg.x;
      seg.x = itemRight;
      seg.width -= trimAmount;
      segIdx++;
    }
    sx = overlapRight;
  }

  skyline.splice(startSegIdx, 0, {x: startX, y: placedBottom, width: itemRight - startX});
  mergeSkyline(skyline);
}

function mergeSkyline(skyline: SkylineSegment[]): void {
  let i = 0;
  while (i < skyline.length - 1) {
    const a = skyline[i];
    const b = skyline[i + 1];
    if (Math.abs((a.x + a.width) - b.x) < EPS && Math.abs(a.y - b.y) < EPS) {
      a.width += b.width;
      skyline.splice(i + 1, 1);
    } else {
      i++;
    }
  }
}

export {muuriGapFreeLayout};
