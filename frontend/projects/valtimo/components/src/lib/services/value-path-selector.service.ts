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
import {Injectable, OnDestroy} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/config';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  interval,
  map,
  Observable,
  of,
  Subscription,
  switchMap,
  take,
} from 'rxjs';
import {ValuePathSelectorCache, ValuePathSelectorPrefix, ValuePathVersionArgument} from '../models';
import {deepmerge} from 'deepmerge-ts';
import {DocumentDefinitions} from '@valtimo/document';
import {isEqual} from 'lodash';
import {tap} from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class ValuePathSelectorService extends BaseApiService implements OnDestroy {
  private _cache: ValuePathSelectorCache = {};
  private _documentDefinitionCache$ = new BehaviorSubject<DocumentDefinitions | null>(null);

  private readonly _subscriptions = new Subscription();

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
    this.openClearCacheSubscription();
  }

  public getResolvableKeysPerPrefix(
    prefixes: ValuePathSelectorPrefix[],
    documentDefinitionName: string,
    version: ValuePathVersionArgument = 'latest'
  ): Observable<string[]> {
    return of(version).pipe(
      switchMap(version => {
        const prefixesWithCache = prefixes.filter(
          prefix => !!this.getResultFromCache(prefix, documentDefinitionName, version)
        );
        const resultsFromCache = prefixesWithCache
          .map(prefix => this.getResultFromCache(prefix, documentDefinitionName, version))
          .reduce((acc, curr) => [...acc, ...curr], []);
        const prefixesWithoutCache = prefixes.filter(prefix => !prefixesWithCache.includes(prefix));
        const httpCall =
          typeof version !== 'number'
            ? this.httpClient
                .post<
                  string[]
                >(this.getApiUrl(`/v1/value-resolver/document-definition/${documentDefinitionName}/keys`), prefixesWithoutCache)
                .pipe(catchError(() => of([])))
            : this.httpClient
                .post<
                  string[]
                >(this.getApiUrl(`/v1/value-resolver/document-definition/${documentDefinitionName}/version/${version}/keys`), prefixesWithoutCache)
                .pipe(catchError(() => of([])));

        return combineLatest([
          prefixesWithoutCache.length > 0 ? httpCall : of([]),
          of(resultsFromCache),
        ]);
      }),
      tap(([result, resultsFromCache]) => {
        const combinedResults = [...result, ...resultsFromCache];
        prefixes.forEach(prefix => {
          const prefixResults = combinedResults.filter(valuePath => valuePath.includes(prefix));
          this.cacheResult(prefix, documentDefinitionName, version, prefixResults);
        });
        console.log(result, resultsFromCache);
      }),
      map(([result, resultsFromCache]) => [...result, ...resultsFromCache])
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setDocumentDefinitionCache(cache: DocumentDefinitions): void {
    this._documentDefinitionCache$.pipe(take(1)).subscribe(currentCache => {
      if (!isEqual(cache, currentCache)) this._documentDefinitionCache$.next(cache);
    });
  }

  public getDocumentDefinitionCache(): Observable<DocumentDefinitions | null> {
    return this._documentDefinitionCache$.asObservable();
  }

  private openClearCacheSubscription(): void {
    this._subscriptions.add(
      interval(60 * 1000).subscribe(() => {
        this._cache = {};
        this._documentDefinitionCache$.next(null);
      })
    );
  }

  private getResultFromCache(
    prefix: string,
    documentDefinitionName: string,
    version: ValuePathVersionArgument = 'latest'
  ): string[] | null {
    return this._cache[documentDefinitionName]?.[version]?.[prefix] || null;
  }

  private cacheResult(
    prefix: string,
    documentDefinitionName: string,
    version: ValuePathVersionArgument = 'latest',
    result: string[]
  ): void {
    const resultCacheObject: ValuePathSelectorCache = {
      [documentDefinitionName]: {
        [version]: {
          [prefix]: result,
        },
      },
    };

    if (!this.getResultFromCache(prefix, documentDefinitionName, version)) {
      this._cache = deepmerge(this._cache, resultCacheObject);
    }
  }
}
