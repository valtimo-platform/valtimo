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
import {Documents, SpecifiedDocuments} from '@valtimo/document';
import {BehaviorSubject, filter, map, Observable, take} from 'rxjs';
import {CaseListContext} from '../models';

@Injectable()
export class CaseListService {
  private readonly _context$ = new BehaviorSubject<CaseListContext | null>(null);

  private readonly _checkRefresh$ = new BehaviorSubject<boolean>(false);
  private readonly _forceRefresh$ = new BehaviorSubject<boolean>(false);

  public get context$(): Observable<CaseListContext | null> {
    return this._context$.asObservable();
  }

  public get caseDefinitionKey$(): Observable<string> {
    return this._context$.pipe(
      filter((ctx): ctx is CaseListContext => ctx?.type === 'definition'),
      map(ctx => ctx.key)
    );
  }

  public get groupKey$(): Observable<string> {
    return this._context$.pipe(
      filter((ctx): ctx is CaseListContext => ctx?.type === 'group'),
      map(ctx => ctx.key)
    );
  }

  get checkRefresh$(): Observable<boolean> {
    return this._checkRefresh$.asObservable();
  }

  get forceRefresh$(): Observable<boolean> {
    return this._forceRefresh$.asObservable();
  }

  public setContext(context: CaseListContext): void {
    this._context$.next(context);
  }

  public setCaseDefinitionKey(caseDefinitionKey: string): void {
    this._context$.next({type: 'definition', key: caseDefinitionKey});
  }

  public mapDocuments(
    documents: Documents | SpecifiedDocuments,
    hasApiColumnConfig: boolean,
    context?: CaseListContext
  ) {
    if (!hasApiColumnConfig) {
      return (documents as Documents).content.map(document => {
        const {content, ...others} = document;
        return {...content, ...others};
      });
    }

    return (documents as SpecifiedDocuments).content.reduce((acc, curr) => {
      const propsObject: Record<string, any> = {id: curr.id, locked: curr.locked};
      if (context?.type === 'group' && (curr as any).caseDefinitionKey) {
        propsObject.caseDefinitionKey = (curr as any).caseDefinitionKey;
      }
      curr.items?.forEach(item => {
        propsObject[item.key] = item.value;
      });
      return [...acc, propsObject];
    }, [] as Record<string, any>[]);
  }

  public forceRefresh(): void {
    this._forceRefresh$.pipe(take(1)).subscribe(forceRefresh => {
      this._forceRefresh$.next(!forceRefresh);
    });
  }

  public checkRefresh(): void {
    this._checkRefresh$.pipe(take(1)).subscribe(checkRefresh => {
      this._checkRefresh$.next(!checkRefresh);
    });
  }
}
