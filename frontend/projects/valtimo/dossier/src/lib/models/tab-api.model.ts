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

enum ApiTabType {
  STANDARD = 'standard',
  FORMIO = 'formio',
  CUSTOM = 'custom',
  WIDGETS = 'widgets',
}

interface ApiTabItem {
  name: string | null;
  key: string;
  type: ApiTabType;
  contentKey: string;
  createdOn?: string;
  createdBy?: string;
  showTasks?: boolean;
}

interface TabSelectItem {
  icon: string;
  title: string;
  type: ApiTabType;
  disabled: boolean;
  disabledTooltipTranslationKey?: string;
}

export {ApiTabType, ApiTabItem, TabSelectItem};
