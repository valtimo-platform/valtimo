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

import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {DefinitionColumn, SortState} from '@valtimo/contract';

@Injectable({
  providedIn: 'root'
})
export class DossierService {
  private readonly definitions: any;

  constructor(private readonly configService: ConfigService) {
    this.definitions = configService.config.definitions;
  }

  getImplementationEnvironmentDefinitions(name: string) {
    return this.definitions.dossiers.find(definition => definition.name === name);
  }

  getDefinitionColumns(definitionNameId: string): Array<DefinitionColumn> {
    const config = this.configService.config;
    const customDefinitionTable = config.customDefinitionTables[definitionNameId];
    return customDefinitionTable || config.defaultDefinitionTable;
  }

  getInitialSortState(columns: Array<DefinitionColumn>): SortState {
    const defaultColumn = columns.find(column => column.default);
    return {
      isSorting: false,
      state: {name: defaultColumn ? defaultColumn.propertyName : columns[0].propertyName, direction: 'DESC'}
    };
  }

}
