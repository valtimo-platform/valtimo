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

import {HttpClient} from '@angular/common/http';
import {Injectable, OnDestroy} from '@angular/core';
import {BaseApiService, ConfigService} from '@valtimo/shared';
import {BehaviorSubject, Observable, Subscription, interval, map, of, take, tap} from 'rxjs';
import {
  ValuePathItem,
  ValuePathResponse,
  ValuePathSelectorCache,
  ValuePathSelectorPrefix,
  ValuePathType,
} from '../models';
import {deepmerge} from 'deepmerge-ts';
import {CaseDefinition} from '@valtimo/document';
import {isEqual} from 'lodash';

@Injectable({
  providedIn: 'root',
})
export class ValuePathSelectorService extends BaseApiService implements OnDestroy {
  private _prefixes: (ValuePathSelectorPrefix | string)[];
  private _caseDefinitionKey: string;
  private _caseDefinitionVersionTag: string;

  private _cache: ValuePathSelectorCache = {};
  private _caseDefinitionCache$ = new BehaviorSubject<CaseDefinition[] | null>(null);
  private readonly _subscriptions = new Subscription();

  constructor(
    protected readonly httpClient: HttpClient,
    protected readonly configService: ConfigService
  ) {
    super(httpClient, configService);
    this.openClearCacheSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setCaseDefinitionCache(cache: CaseDefinition[]): void {
    this._caseDefinitionCache$.pipe(take(1)).subscribe(currentCache => {
      if (!isEqual(cache, currentCache)) this._caseDefinitionCache$.next(cache);
    });
  }

  public getCaseDefinitionCache(): Observable<CaseDefinition[] | null> {
    return this._caseDefinitionCache$.asObservable();
  }

  public getResolvableKeys(
    prefixes: ValuePathSelectorPrefix[],
    caseDefinitionKey: string,
    type: ValuePathType = ValuePathType.FIELD,
    caseDefinitionVersionTag: string = null
  ): Observable<ValuePathItem[]> {
    this._prefixes = prefixes;
    this._caseDefinitionKey = caseDefinitionKey;
    this._caseDefinitionVersionTag = caseDefinitionVersionTag;

    const url = !caseDefinitionVersionTag
      ? `/management/v1/value-resolver/case-definition/${caseDefinitionKey}/keys`
      : `/management/v1/value-resolver/case-definition/${caseDefinitionKey}/version/${caseDefinitionVersionTag}/keys`;

    const prefixesWithoutCache: (ValuePathSelectorPrefix | string)[] = this._prefixes.filter(
      (prefix: ValuePathSelectorPrefix) => !this.getCacheResult(prefix, type)
    );

    return (
      prefixesWithoutCache.length > 0 || this._prefixes.length === 0
        ? this.httpClient.post<ValuePathResponse[]>(this.getApiUrl(url), {
            prefixes: prefixesWithoutCache,
            type,
          })
        : of([])
    ).pipe(
      tap((results: ValuePathResponse[]) => {
        if (this._prefixes.length === 0) this._prefixes = this.getPrefixesFromResults(results);

        if (type === ValuePathType.FIELD)
          this.cacheMapping(
            results.map((result: ValuePathResponse) => ({path: result.path})),
            type
          );
        else
          this.cacheMapping(
            results.reduce((acc, curr) => [...acc, ...this.mapCollectionItem(curr)], []),
            type
          );
      }),
      map(() =>
        this._prefixes.reduce(
          (acc, curr) => [...acc, ...(this.getCacheResult(curr, type) ?? [])],
          []
        )
      )
    );
  }

  private openClearCacheSubscription(): void {
    this._subscriptions.add(
      interval(60 * 1000).subscribe(() => {
        this._cache = {};
        this._caseDefinitionCache$.next(null);
      })
    );
  }

  private getCacheResult(
    prefix: ValuePathSelectorPrefix | string,
    type: ValuePathType
  ): ValuePathItem[] | undefined {
    return this._cache[this._caseDefinitionKey]?.[this._caseDefinitionVersionTag]?.[prefix]?.[type];
  }

  private mapCollectionItem(item: ValuePathResponse, parentPath?: string): ValuePathItem[] {
    const fieldChildren = [];
    const collectionChildren = [];

    item.children.forEach((child: ValuePathResponse) => {
      if (child.type === ValuePathType.FIELD) fieldChildren.push(child);
      else collectionChildren.push(child);
    });

    return [
      {
        path: `${parentPath ?? ''}${item.path}`,
        children: fieldChildren.map((child: ValuePathResponse) => child.path),
      },
      ...collectionChildren.reduce(
        (acc, curr) => [...acc, ...this.mapCollectionItem(curr, `${parentPath ?? ''}${item.path}`)],
        []
      ),
    ];
  }

  private cacheMapping(results: ValuePathItem[], type: ValuePathType): void {
    if (!results.length) return;

    const prefixResults = this._prefixes.reduce(
      (acc, curr) => ({
        ...acc,
        ...(!this.getCacheResult(curr, type) && {
          [curr]: {
            [type]: results.filter((result: ValuePathItem) => result.path.split(':')[0] === curr),
          },
        }),
      }),
      {}
    );

    const tempCache: ValuePathSelectorCache = {
      [this._caseDefinitionKey]: {
        [this._caseDefinitionVersionTag]: prefixResults,
      },
    };

    this._cache = deepmerge(this._cache, tempCache);
  }

  private getPrefixesFromResults(results: ValuePathResponse[]): string[] {
    return [...new Set(results.map((result: ValuePathResponse) => result.path.split(':')[0]))];
  }
}
