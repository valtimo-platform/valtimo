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

import {WidgetColor} from '../models';

type WidgetColorThemeVariant = 'light' | 'dark';

interface WidgetColorVariant {
  text: string | null;
  accent: string | null;
  background: string | null;
  layer: string | null;
}

type WidgetColorTheme = Record<WidgetColorThemeVariant, WidgetColorVariant>;

const WIDGET_COLOR_ITEMS: WidgetColor[] = [
  WidgetColor.WHITE,
  WidgetColor.HIGHCONTRAST,
  WidgetColor.BLUE,
  WidgetColor.PERIWINKLE,
  WidgetColor.PURPLE,
  WidgetColor.TURQOISE,
  WidgetColor.GREEN,
  WidgetColor.BROWN,
  WidgetColor.RED,
  WidgetColor.ORANGE,
  WidgetColor.YELLOW,
];

const DEFAULT_WIDGET_COLOR_THEME: WidgetColorTheme = {
  light: {text: null, accent: null, background: null, layer: null},
  dark: {text: null, accent: null, background: null, layer: null},
};

const WIDGET_COLOR_THEME_MAP: Record<WidgetColor, WidgetColorTheme> = {
  [WidgetColor.WHITE]: DEFAULT_WIDGET_COLOR_THEME,
  [WidgetColor.HIGHCONTRAST]: {
    light: {
      text: '#F4F4F4',
      accent: '#393939',
      background: '#161616',
      layer: '#262626',
    },
    dark: {
      text: '#161616',
      accent: '#C6C6C6',
      background: '#FFFFFF',
      layer: '#F4F4F4',
    },
  },
  [WidgetColor.BLUE]: {
    light: {
      text: '#314A5EFF',
      accent: '#468CBEFF',
      background: '#E2EDF5FF',
      layer: '#F6FBFFFF',
    },
    dark: {
      text: '#E2EDF5FF',
      accent: '#468CBEFF',
      background: '#314A5EFF',
      layer: '#1A2D3CFF',
    },
  },
  [WidgetColor.PERIWINKLE]: {
    light: {
      text: '#1A146AFF',
      accent: '#4A42BEFF',
      background: '#D5D3F0FF',
      layer: '#EBEAFDFF',
    },
    dark: {
      text: '#D5D3F0FF',
      accent: '#4A42BEFF',
      background: '#1A146AFF',
      layer: '#0B0742FF',
    },
  },
  [WidgetColor.PURPLE]: {
    light: {
      text: '#603361FF',
      accent: '#B965BCFF',
      background: '#F4E6F4FF',
      layer: '#FBF5FBFF',
    },
    dark: {
      text: '#F4E6F4FF',
      accent: '#B965BCFF',
      background: '#603361FF',
      layer: '#3F203FFF',
    },
  },
  [WidgetColor.TURQOISE]: {
    light: {
      text: '#297063FF',
      accent: '#359C85FF',
      background: '#ECF8F6FF',
      layer: '#F8FFFEFF',
    },
    dark: {
      text: '#ECF8F6FF',
      accent: '#359C85FF',
      background: '#297063FF',
      layer: '#184A40FF',
    },
  },
  [WidgetColor.GREEN]: {
    light: {
      text: '#245B25FF',
      accent: '#3F9C40FF',
      background: '#E8F3E8FF',
      layer: '#F8FFF8FF',
    },
    dark: {
      text: '#E8F3E8FF',
      accent: '#3F9C40FF',
      background: '#245B25FF',
      layer: '#153C15FF',
    },
  },
  [WidgetColor.BROWN]: {
    light: {
      text: '#6E5326FF',
      accent: '#A07837FF',
      background: '#ECE4D7FF',
      layer: '#F6F2EBFF',
    },
    dark: {
      text: '#ECE4D7FF',
      accent: '#A07837FF',
      background: '#6E5326FF',
      layer: '#493617FF',
    },
  },
  [WidgetColor.RED]: {
    light: {
      text: '#7C2C2DFF',
      accent: '#D34F51FF',
      background: '#F6DCDCFF',
      layer: '#FFEBEBFF',
    },
    dark: {
      text: '#F6DCDCFF',
      accent: '#D34F51FF',
      background: '#7C2C2DFF',
      layer: '#561D1EFF',
    },
  },
  [WidgetColor.ORANGE]: {
    light: {
      text: '#673D13FF',
      accent: '#CC6300FF',
      background: '#FFE5CCFF',
      layer: '#FFF1E4FF',
    },
    dark: {
      text: '#FFE5CCFF',
      accent: '#CC6300FF',
      background: '#673D13FF',
      layer: '#41270CFF',
    },
  },
  [WidgetColor.YELLOW]: {
    light: {
      text: '#6F5C29FF',
      accent: '#FAD165FF',
      background: '#FEF6E0FF',
      layer: '#FFFBF1FF',
    },
    dark: {
      text: '#FEF6E0FF',
      accent: '#FAD165FF',
      background: '#6F5C29FF',
      layer: '#483B17FF',
    },
  },
};

const WIDGET_COLOR_ILLUSTRATION_MAP: Record<WidgetColor, string> = {
  [WidgetColor.YELLOW]: 'valtimo-layout/img/widget-management/color/yellow.svg',
  [WidgetColor.ORANGE]: 'valtimo-layout/img/widget-management/color/orange.svg',
  [WidgetColor.RED]: 'valtimo-layout/img/widget-management/color/red.svg',
  [WidgetColor.BROWN]: 'valtimo-layout/img/widget-management/color/brown.svg',
  [WidgetColor.GREEN]: 'valtimo-layout/img/widget-management/color/green.svg',
  [WidgetColor.TURQOISE]: 'valtimo-layout/img/widget-management/color/turqoise.svg',
  [WidgetColor.PURPLE]: 'valtimo-layout/img/widget-management/color/purple.svg',
  [WidgetColor.PERIWINKLE]: 'valtimo-layout/img/widget-management/color/periwinkle.svg',
  [WidgetColor.BLUE]: 'valtimo-layout/img/widget-management/color/blue.svg',
  [WidgetColor.WHITE]: 'valtimo-layout/img/widget-management/color/default.svg',
  [WidgetColor.HIGHCONTRAST]: 'valtimo-layout/img/widget-management/color/highContrast.svg',
};

export {
  WIDGET_COLOR_ILLUSTRATION_MAP,
  WIDGET_COLOR_ITEMS,
  WIDGET_COLOR_THEME_MAP,
  type WidgetColorThemeVariant,
  type WidgetColorVariant,
};
