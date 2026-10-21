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

import {Injectable} from '@angular/core';
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigService, InterceptorSkip} from '@valtimo/shared';
import {NotificatiesApiManualAbonnement} from '../models';

@Injectable({
  providedIn: 'root',
})
export class NotificatiesApiPluginService {
  private readonly valtimoEndpointUri: string;

  constructor(
    private readonly http: HttpClient,
    configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config?.valtimoApi?.endpointUri;
  }

  // A 404 means the configuration is not saved as manual yet, which the form shows as a hint.
  public getManualAbonnement(configurationId: string): Observable<NotificatiesApiManualAbonnement> {
    return this.http.get<NotificatiesApiManualAbonnement>(
      `${this.valtimoEndpointUri}management/v1/notificatiesapi/configurations/${configurationId}/manual-abonnement`,
      {headers: new HttpHeaders().set(InterceptorSkip, '404')}
    );
  }
}
