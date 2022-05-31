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

// "pluginManagement": {
//   "labels": {
//     "pluginName": "Plug-in-naam",
//       "identifier": "Identifier",
//       "configurationName": "Configuratienaam"
//   }
// }

import {Component} from '@angular/core';
import {BehaviorSubject, combineLatest} from 'rxjs';
import {TableColumn} from '@valtimo/user-interface';
import {PluginService} from '../../services';
import {TranslateService} from '@ngx-translate/core';
import {map, tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-plugin-management',
  templateUrl: './plugin-management.component.html',
  styleUrls: ['./plugin-management.component.scss'],
})
export class PluginManagementComponent {
  readonly loading$ = new BehaviorSubject<boolean>(true);
  readonly columns$ = new BehaviorSubject<Array<TableColumn>>([
    {
      labelTranslationKey: 'pluginManagement.labels.pluginName',
      dataKey: 'pluginName',
    },
    {
      labelTranslationKey: 'pluginManagement.labels.identifier',
      dataKey: 'definitionKey',
    },
    {
      labelTranslationKey: 'pluginManagement.labels.configurationName',
      dataKey: 'title',
    },
  ]);
  readonly pluginConfigurations$ = combineLatest([
    this.pluginService.getAllPluginConfigurations(),
    this.translateService.stream('key'),
  ]).pipe(
    map(([pluginConfigurations]) =>
      pluginConfigurations.map(configuration => ({
        ...configuration,
        pluginName: this.translateService.instant(`plugin.${configuration.definitionKey}.title`),
      }))
    ),
    tap(() => {
      this.loading$.next(false);
    })
  );

  constructor(
    private readonly pluginService: PluginService,
    private readonly translateService: TranslateService
  ) {}
}
