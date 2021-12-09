/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Inject, Injectable} from '@angular/core';
import {TabImpl} from '@valtimo/contract';
import {DEFAULT_TABS, TAB_MAP} from './dossier.config';

@Injectable({
  providedIn: 'root'
})
export class TabService {
  private readonly tabMap: Map<string, object>;
  private readonly tabs: TabImpl[] = [];

  constructor(
    @Inject(TAB_MAP) tabMap: Map<string, object> = DEFAULT_TABS
  ) {
    this.tabMap = tabMap;
    let i = 0;
    this.tabMap.forEach((component, name, map) => {
      this.tabs.push(new TabImpl(name, i, component));
      i++;
    });
  }

  public getTabs(): TabImpl[] {
    return this.tabs;
  }

}
