/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" basis, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.See the License for the specific language governing permissions and limitations under the License.
 */

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable, of} from 'rxjs';
import {
  FormFlowDefinition,
  FormFlowInstance,
  PluginConfiguration,
  PluginDefinition,
  PluginFunction,
} from '../models';
import {ConfigService} from '@valtimo/config';
import {delay} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ProcessLinkService {
  getPluginDefinitions(): Observable<Array<PluginDefinition>> {
    return of([{identifier: 'openzaak', name: 'Open Zaak'}]).pipe(delay(500));
  }

  getPluginConfigurations(pluginDefinitionId: string): Observable<Array<PluginConfiguration>> {
    return of([
      {
        id: '1ebdad87-3899-4ab7-b4ad-403237b17dbd',
        name: 'Den Haag Open Zaak',
      },
    ]).pipe(delay(500));
  }

  getPluginFunctions(pluginDefinitionId: string): Observable<Array<PluginFunction>> {
    return of([
      {
        identifier: 'create-zaak',
        name: 'Zaak aanmaken',
      },
      {
        identifier: 'set-status',
        name: 'Status van de Zaak wijzigen',
      },
      {
        identifier: 'set-resultaat',
        name: 'Resultaat toevoegen aan de Zaak',
      },
      {
        identifier: 'set-besluit',
        name: 'Besluit toevoegen aan de Zaak',
      },
    ]).pipe(delay(500));
  }

  getAllPluginConfigurations(): Observable<Array<PluginConfiguration>> {
    return of([
      {
        id: '1ebdad87-3899-4ab7-b4ad-403237b17dbd',
        name: 'Den Haag Open Zaak',
      },
    ]).pipe(delay(500));
  }
}
