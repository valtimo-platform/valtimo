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
import {Observable} from 'rxjs';
import {ValtimoVersion} from '../../models';
import {ConfigService} from '@valtimo/config';

@Injectable({
  providedIn: 'root',
})
export class VersionService {
  private valtimoEndpointUri: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService
  ) {
    this.valtimoEndpointUri = configService.config.valtimoApi.endpointUri;
  }

  public getVersion(): Observable<ValtimoVersion> {
    return this.http.get<ValtimoVersion>(`${this.valtimoEndpointUri}v1/valtimo/version`);
  }
}
