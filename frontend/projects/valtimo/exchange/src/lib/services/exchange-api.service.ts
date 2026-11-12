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

import {HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {
  BaseApiService,
  ConfigService,
  InterceptorSkip,
  InterceptorSkipHeader,
  Page,
} from '@valtimo/shared';
import {catchError, from, map, Observable, of, switchMap, throwError} from 'rxjs';
import {ExchangeArtifact, ExchangeConfiguration} from '../models';

@Injectable({providedIn: 'root'})
export class ExchangeApiService extends BaseApiService {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly httpClient: HttpClient
  ) {
    super(httpClient, configService);
  }

  public getConfiguration(): Observable<ExchangeConfiguration> {
    return this.httpClient.get<ExchangeConfiguration>(this.getApiUrl('v1/exchange/configuration'), {
      headers: new HttpHeaders().set(InterceptorSkip, '403,404'),
    });
  }

  public getArtifact(publicationId: string, artifactId: string): Observable<ExchangeArtifact> {
    return this.httpClient.get<ExchangeArtifact>(this.artifactUrl(publicationId, artifactId), {
      headers: InterceptorSkipHeader,
    });
  }

  public getArtifactContent(publicationId: string, artifactId: string): Observable<File> {
    return this.httpClient
      .get(`${this.artifactUrl(publicationId, artifactId)}/content`, {
        headers: InterceptorSkipHeader,
        observe: 'response',
        responseType: 'blob',
      })
      .pipe(
        map(
          (response: HttpResponse<Blob>) =>
            new File([response.body as Blob], this.fileNameFrom(response, artifactId), {
              type: 'application/zip',
            })
        ),
        catchError((error: unknown) => this.parseBlobError(error))
      );
  }

  /** 404 means not installed. Any other failure also reads as not installed. */
  public buildingBlockInstalled(key: string, versionTag: string | null): Observable<boolean> {
    const headers = new HttpHeaders().set(InterceptorSkip, 'all');

    if (versionTag) {
      return this.httpClient
        .get(
          this.getApiUrl(
            `management/v1/building-block/${encodeURIComponent(key)}/version/${encodeURIComponent(versionTag)}`
          ),
          {
            headers,
          }
        )
        .pipe(
          map(() => true),
          catchError(() => of(false))
        );
    }

    return this.httpClient
      .get<Page<unknown>>(
        this.getApiUrl(`management/v1/building-block/${encodeURIComponent(key)}/version`),
        {
          headers,
          params: {page: 0, size: 1, all: true},
        }
      )
      .pipe(
        map(page => (page?.content?.length ?? 0) > 0),
        catchError(() => of(false))
      );
  }

  private artifactUrl(publicationId: string, artifactId: string): string {
    return this.getApiUrl(
      `management/v1/exchange/publications/${encodeURIComponent(publicationId)}/artifacts/${encodeURIComponent(artifactId)}`
    );
  }

  private fileNameFrom(response: HttpResponse<Blob>, artifactId: string): string {
    const disposition = response.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return match?.[1] ?? `${artifactId}.zip`;
  }

  /** Blob error bodies are unreadable as JSON; re-throw with the parsed `{message}` body. */
  private parseBlobError(error: unknown): Observable<never> {
    if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
      return throwError(() => error);
    }

    return from(error.error.text()).pipe(
      map(text => {
        try {
          return JSON.parse(text);
        } catch {
          return null;
        }
      }),
      switchMap(body =>
        throwError(
          () =>
            new HttpErrorResponse({
              error: body,
              status: error.status,
              statusText: error.statusText,
              url: error.url ?? undefined,
            })
        )
      )
    );
  }
}
