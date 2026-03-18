/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {HttpClient, HttpParams} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {BaseApiService, ConfigService, Page} from '@valtimo/shared';
import {map, Observable} from 'rxjs';
import {PluginManagementService} from '@valtimo/plugin';
import {PluginConfiguration} from '../../zaken-api';

@Injectable({
  providedIn: 'root',
})
export class DocumentenApiPreviewService extends BaseApiService {
  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService,
    private readonly pluginManagementService: PluginManagementService
  ) {
    super(httpClient, configService);
  }

  public canGeneratePreview(): Observable<boolean> {
    return this.pluginManagementService
      .getPluginConfigurationsByPluginDefinitionKey('documentenapipreview')
      .pipe(map(configurations => configurations.length > 0));
  }
}
