/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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

import {CaseWidgetConfigurationBin, CaseWidgetPackResult, MaxRectsResult} from '../models';
import MaxRectsBinPack from 'rects-bin-pack';

const packBins = (
  configurationBins: CaseWidgetConfigurationBin[],
  containerWidth: number
): CaseWidgetPackResult => {
  const pack = new MaxRectsBinPack.MaxRectsBinPack(containerWidth, 1000000, false);
  const results: MaxRectsResult[] = pack.insert2(
    configurationBins,
    MaxRectsBinPack.BestShortSideFit
  );
  const tallestResult = results.reduce((acc, curr) => {
    const currHeight = curr.y + curr.height;

    return currHeight > acc ? currHeight : acc;
  }, 0);

  return {
    width: containerWidth,
    height: tallestResult,
    items: results.map(result => ({
      width: result.width,
      height: result.height,
      x: result.x,
      y: result.y,
      item: {
        configurationKey: result.configurationKey,
        width: result.width,
        height: result.height,
      },
    })),
  };
};

export {packBins};
