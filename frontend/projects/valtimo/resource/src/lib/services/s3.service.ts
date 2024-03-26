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
import {HttpClient, HttpHeaders} from '@angular/common/http';
import {Observable} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {Resource, S3Resource, ResourceDto} from '../models';

@Injectable({
  providedIn: 'root',
})
export class S3Service {
  private valtimoApiConfig: any;

  constructor(
    private http: HttpClient,
    private configService: ConfigService
  ) {
    this.valtimoApiConfig = configService.config.valtimoApi;
  }

  public getPreSignedUrl(fileName: string): Observable<string> {
    const headers = new HttpHeaders().set('Content-Type', 'text/plain; charset=utf-8');
    const options = {headers, responseType: 'text' as 'text'};
    return this.http.get(
      `${this.valtimoApiConfig.endpointUri}v1/resource/pre-signed-url/${fileName}`,
      options
    );
  }

  public upload(url: URL, file: File): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', file.type);
    return this.http.put(url.toString(), file, {headers});
  }

  public registerResource(s3ResourceDTO: S3Resource): Observable<Resource> {
    return this.http.put<Resource>(
      `${this.valtimoApiConfig.endpointUri}v1/resource`,
      s3ResourceDTO
    );
  }

  public get(resourceId: string): Observable<ResourceDto> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json;charset=UTF-8');
    return this.http.get<ResourceDto>(
      `${this.valtimoApiConfig.endpointUri}v1/resource/${resourceId}`,
      {headers}
    );
  }

  public delete(resourceId: string): Observable<any> {
    const headers = new HttpHeaders().set('Content-Type', 'application/json;charset=UTF-8');
    return this.http.delete(`${this.valtimoApiConfig.endpointUri}v1/resource/${resourceId}`, {
      headers,
    });
  }
}
