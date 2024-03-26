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

import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {combineLatest, Observable} from 'rxjs';
import {
  PluginConfiguration,
  PluginConfigurationWithLogo,
  PluginDefinition,
  PluginFunction,
} from '../models';
import {ConfigService} from '@valtimo/config';
import {map} from 'rxjs/operators';
import {PluginService} from './plugin.service';
import {DomSanitizer} from '@angular/platform-browser';

@Injectable({
  providedIn: 'root',
})
export class PluginManagementService {
  private readonly VALTIMO_API_ENDPOINT_URI = this.configService.config.valtimoApi.endpointUri;

  constructor(
    private readonly configService: ConfigService,
    private readonly pluginService: PluginService,
    private readonly sanitizer: DomSanitizer,
    private readonly http: HttpClient
  ) {}

  getPluginDefinitions(): Observable<Array<PluginDefinition>> {
    return this.http.get<Array<PluginDefinition>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/definition`
    );
  }

  getPluginFunctions(pluginDefinitionId: string): Observable<Array<PluginFunction>> {
    return this.http.get<Array<PluginFunction>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/definition/${pluginDefinitionId}/action`
    );
  }

  getAllPluginConfigurations(): Observable<Array<PluginConfiguration>> {
    return this.http.get<Array<PluginConfiguration>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration`
    );
  }

  getPluginConfigurationsByPluginDefinitionKey(
    pluginDefinitionKey: string
  ): Observable<Array<PluginConfiguration>> {
    return this.http.get<Array<PluginConfiguration>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration?pluginDefinitionKey=${pluginDefinitionKey}`
    );
  }

  getPluginConfigurationsByCategory(categoryId: string): Observable<Array<PluginConfiguration>> {
    return this.http.get<Array<PluginConfiguration>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration?category=${categoryId}`
    );
  }

  getPluginConfigurationsWithActionsForActivityType(
    activityType: string
  ): Observable<Array<PluginConfiguration>> {
    return this.http.get<Array<PluginConfiguration>>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration?activityType=${activityType}`
    );
  }

  getAllPluginConfigurationsWithLogos(
    activityType?: string
  ): Observable<Array<PluginConfigurationWithLogo>> {
    return activityType && activityType.length > 0
      ? this.returnPluginConfigurationsWithLogos(
          this.getPluginConfigurationsWithActionsForActivityType(activityType)
        )
      : this.returnPluginConfigurationsWithLogos(this.getAllPluginConfigurations());
  }

  savePluginConfiguration(
    pluginConfiguration: PluginConfiguration
  ): Observable<PluginConfiguration> {
    return this.http.post<PluginConfiguration>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration`,
      pluginConfiguration
    );
  }

  updatePluginConfiguration(
    configurationId: string,
    newConfigurationId: string,
    configurationTitle: string,
    configurationProperties: object
  ): Observable<PluginConfiguration> {
    return this.http.put<PluginConfiguration>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration/${configurationId}`,
      {
        newId: newConfigurationId,
        title: configurationTitle,
        properties: configurationProperties,
      }
    );
  }

  deletePluginConfiguration(configurationId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.VALTIMO_API_ENDPOINT_URI}v1/plugin/configuration/${configurationId}`
    );
  }

  private returnPluginConfigurationsWithLogos(
    pluginConfigurations$: Observable<Array<PluginConfiguration>>
  ): Observable<Array<PluginConfigurationWithLogo>> {
    return combineLatest([pluginConfigurations$, this.pluginService.pluginSpecifications$]).pipe(
      map(([pluginConfigurations, pluginSpecifications]) =>
        pluginConfigurations?.map(pluginConfiguration => {
          const pluginSpecification = pluginSpecifications.find(
            specification => specification.pluginId === pluginConfiguration?.pluginDefinition?.key
          );

          return {
            ...pluginConfiguration,
            ...(pluginSpecification?.pluginLogoBase64 && {
              pluginLogoBase64: this.sanitizer.bypassSecurityTrustResourceUrl(
                pluginSpecification?.pluginLogoBase64
              ),
            }),
          };
        })
      )
    );
  }
}
