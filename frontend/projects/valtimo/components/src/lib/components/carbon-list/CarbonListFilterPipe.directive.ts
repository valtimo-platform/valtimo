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

import {Pipe, PipeTransform} from '@angular/core';
import {TableItem} from 'carbon-components-angular';

@Pipe({
  name: 'listFilter',
})
export class CarbonListFilterPipe implements PipeTransform {
  transform(list: TableItem[][], filterText: string): TableItem[][] {
    list = list || [];

    return !filterText
      ? list
      : list.filter((row: TableItem[]) =>
          row.some((item: TableItem) =>
            item.data.toString().toLowerCase().includes(filterText.toLowerCase())
          )
        );
  }
}
