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
import {Documents, SpecifiedDocuments} from '@valtimo/document';
import {BehaviorSubject, map, Observable, take} from 'rxjs';
import {DossierColumnService} from '../services';

@Injectable()
export class DossierListService {
  private readonly _documentDefinitionName$ = new BehaviorSubject<string>('');

  private readonly _hasEnvColumnConfig$: Observable<boolean> = this.documentDefinitionName$.pipe(
    map(documentDefinitionName =>
      this.dossierColumnService.hasEnvironmentConfig(documentDefinitionName)
    )
  );

  private readonly _checkRefresh$ = new BehaviorSubject<boolean>(false);
  private readonly _forceRefresh$ = new BehaviorSubject<boolean>(false);

  public get documentDefinitionName$(): Observable<string> {
    return this._documentDefinitionName$.asObservable();
  }

  public get hasEnvColumnConfig$(): Observable<boolean> {
    return this._hasEnvColumnConfig$;
  }

  get checkRefresh$(): Observable<boolean> {
    return this._checkRefresh$.asObservable();
  }

  get forceRefresh$(): Observable<boolean> {
    return this._forceRefresh$.asObservable();
  }

  constructor(private readonly dossierColumnService: DossierColumnService) {}

  public setDocumentDefinitionName(documentDefinitionName: string): void {
    this._documentDefinitionName$.next(documentDefinitionName);
  }

  public mapDocuments(
    documents: Documents | SpecifiedDocuments,
    hasEnvColumnConfig: boolean,
    hasApiColumnConfig: boolean
  ) {
    if (hasEnvColumnConfig || !hasApiColumnConfig) {
      return (documents as Documents).content.map(document => {
        const {content, ...others} = document;
        return {...content, ...others};
      });
    }

    return (documents as SpecifiedDocuments).content.reduce((acc, curr) => {
      const propsObject = {id: curr.id, locked: curr.locked};
      curr.items?.forEach(item => {
        propsObject[item.key] = item.value;
      });
      return [...acc, propsObject];
    }, []);
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
