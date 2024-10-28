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

import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {Observable} from 'rxjs';
import {ExtensionListItem,} from '../models';

@Injectable({providedIn: 'root'})
export class ExtensionService {

  private readonly valtimoEndpointUri: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly http: HttpClient
  ) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/`;
  }

  public getExtensions(): Observable<Array<ExtensionListItem>> {
    return this.http.get<Array<ExtensionListItem>>(
      `${this.valtimoEndpointUri}v1/extension`
    );
  }

  public installExtension(
    extensionId: string,
    version: string
  ): Observable<Blob> {
    return this.http.post<Blob>(
      `${this.valtimoEndpointUri}v1/extension/${extensionId}/install/${version}`,
      null,
      {responseType: 'blob' as 'json'}
    );
  }

  public updateExtension(
    extensionId: string,
    toVersion: string
  ): Observable<Blob> {
    return this.http.post<Blob>(
      `${this.valtimoEndpointUri}v1/extension/${extensionId}/update/${toVersion}`,
      null,
      {responseType: 'blob' as 'json'}
    );
  }

  public uninstallExtension(
    extensionId: string
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}v1/extension/${extensionId}`
    );
  }
}
