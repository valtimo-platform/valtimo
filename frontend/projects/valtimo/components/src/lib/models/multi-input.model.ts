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

import {FormOutput} from '../models';
import {ListItem} from 'carbon-components-angular';

type MultiInputType = 'keyValue' | 'value' | 'keyDropdownValue' | 'arbitraryAmount';

interface MultiInputKeyValue {
  uuid?: string;
  key?: string;
  value?: string;
  dropdown?: string;
  [index: string]: string;
}

interface MultiInputFormValue {
  uuid?: string;
  value: FormOutput | object;
  expanded?: boolean;
}

type MultiInputValues = Array<MultiInputKeyValue>;

type MultiInputFormsValues = Array<MultiInputFormValue>;

type MultiInputOutput = MultiInputValues | Array<string>;

interface ListItemWithId extends ListItem {
  id: string;
}

interface ArbitraryInputTitles {
  [indexKey: string]: string;
}

export {
  MultiInputType,
  MultiInputValues,
  MultiInputKeyValue,
  MultiInputOutput,
  MultiInputFormValue,
  MultiInputFormsValues,
  ListItemWithId,
  ArbitraryInputTitles,
};
