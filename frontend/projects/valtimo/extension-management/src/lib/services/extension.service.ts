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
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}`;

    const initFileJs = 'frontend/esm2022/frontend.mjs'
    //const initFileJs = 'frontend/fesm2022/frontend.mjs'
    //const initFileJs = 'frontend-bundle.js'
    //const initFileJs = 'init.js'

    this.getExtensionIds('STARTED', initFileJs).subscribe(extensionIds =>
      extensionIds.forEach(extensionId => {
        import(/* webpackIgnore: true */this.getFileUrl(extensionId, initFileJs)).then(result => {
          console.log(result);
        });
      })
    );
  }

  public getExtensions(): Observable<Array<ExtensionListItem>> {
    return this.http.get<Array<ExtensionListItem>>(
      `${this.valtimoEndpointUri}management/v1/extension`
    );
  }

  public installExtension(
    extensionId: string,
    version: string
  ): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}/install/${version}`,
      null,
    );
  }

  public updateExtension(
    extensionId: string,
    toVersion: string
  ): Observable<void> {
    return this.http.post<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}/update/${toVersion}`,
      null,
    );
  }

  public uninstallExtension(
    extensionId: string
  ): Observable<void> {
    return this.http.delete<void>(
      `${this.valtimoEndpointUri}management/v1/extension/${extensionId}`
    );
  }

  public getExtensionIds(state: string, file: string): Observable<Array<string>> {
    return this.http.get<Array<string>>(
      `.${this.valtimoEndpointUri}v1/public/extension/id?state=${state}&file=${file}`
    );
  }

  public getFileUrl(extensionId: string, file: string): string {
    return `${location.origin}${this.valtimoEndpointUri}v1/public/extension/${extensionId}/file/${file}`
  }

  public getFile(file: string, extensionId: string): Observable<string> {
    return this.http.get<string>(
      `${this.valtimoEndpointUri}v1/public/extension/${extensionId}/file/${file}`
    );
  }
}
