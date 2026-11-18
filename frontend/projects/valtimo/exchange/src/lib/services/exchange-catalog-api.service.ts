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

import {HttpBackend, HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {inject, Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/shared';
import {catchError, Observable, switchMap, take, throwError} from 'rxjs';
import {
  ExchangePublicationDto,
  ExchangePublicationType,
  ExchangeRequestError,
  ExchangeSearchResultDto,
  ExchangeSort,
  ExchangeTagsDto,
} from '../models';

interface ExchangeSearchRequest {
  readonly name: string;
  readonly types: ReadonlyArray<ExchangePublicationType>;
  readonly tags: ReadonlyArray<string>;
  readonly sort: ExchangeSort;
  readonly page: number;
  readonly size: number;
}

@Injectable()
export class ExchangeCatalogApiService {
  // Bypass interceptors: no Valtimo token to the Exchange
  private readonly _http = new HttpClient(inject(HttpBackend));

  constructor(private readonly configService: ConfigService) {}

  public search(request: ExchangeSearchRequest): Observable<ExchangeSearchResultDto> {
    let params = new HttpParams()
      .set('sort', request.sort)
      .set('page', request.page)
      .set('size', request.size);

    if (request.name) params = params.set('name', request.name);
    request.types.forEach(type => (params = params.append('publicationType', type)));
    request.tags.forEach(tag => (params = params.append('tag', tag)));

    return this.get<ExchangeSearchResultDto>('/api/v1/publications/search', params);
  }

  public getTags(): Observable<ExchangeTagsDto> {
    return this.get<ExchangeTagsDto>('/api/v1/publications/tags');
  }

  public getPublication(id: string): Observable<ExchangePublicationDto> {
    return this.get<ExchangePublicationDto>(`/api/v1/publications/${encodeURIComponent(id)}`);
  }

  private get<T>(path: string, params?: HttpParams): Observable<T> {
    return this.configService.exchangeConfiguration$.pipe(
      take(1),
      switchMap(configuration => {
        if (!configuration?.enabled || !configuration.url) {
          return throwError(() => new ExchangeRequestError('notConfigured'));
        }

        return this._http.get<T>(`${configuration.url}${path}`, {params});
      }),
      catchError((error: unknown) =>
        throwError(() =>
          error instanceof ExchangeRequestError
            ? error
            : new ExchangeRequestError(
                error instanceof HttpErrorResponse && error.status === 404
                  ? 'notFound'
                  : 'unavailable'
              )
        )
      )
    );
  }
}

export {ExchangeSearchRequest};
