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

import {AccentColorDefinition} from '../models';

const ACCENT_COLOR_DEFINITIONS: AccentColorDefinition[] = [
  {
    cssVar: '--vcds-color-100',
    labelTranslationKey: 'adminSettings.appearance.colors.color100',
    defaultValue: '#002547',
  },
  {
    cssVar: '--vcds-color-90',
    labelTranslationKey: 'adminSettings.appearance.colors.color90',
    defaultValue: '#002c54',
  },
  {
    cssVar: '--vcds-color-80',
    labelTranslationKey: 'adminSettings.appearance.colors.color80',
    defaultValue: '#003361',
  },
  {
    cssVar: '--vcds-color-70',
    labelTranslationKey: 'adminSettings.appearance.colors.color70',
    defaultValue: '#286198',
  },
  {
    cssVar: '--vcds-color-60',
    labelTranslationKey: 'adminSettings.appearance.colors.color60',
    defaultValue: '#2b79bd',
  },
  {
    cssVar: '--vcds-color-50',
    labelTranslationKey: 'adminSettings.appearance.colors.color50',
    defaultValue: '#61aedf',
  },
  {
    cssVar: '--vcds-color-40',
    labelTranslationKey: 'adminSettings.appearance.colors.color40',
    defaultValue: '#8acff2',
  },
  {
    cssVar: '--vcds-color-30',
    labelTranslationKey: 'adminSettings.appearance.colors.color30',
    defaultValue: '#aadcf6',
  },
  {
    cssVar: '--vcds-color-20',
    labelTranslationKey: 'adminSettings.appearance.colors.color20',
    defaultValue: '#c9e9f9',
  },
  {
    cssVar: '--vcds-color-10',
    labelTranslationKey: 'adminSettings.appearance.colors.color10',
    defaultValue: '#e9f6fd',
  },
];

export {ACCENT_COLOR_DEFINITIONS};
