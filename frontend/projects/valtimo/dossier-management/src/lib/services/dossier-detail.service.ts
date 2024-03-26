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

import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {DocumentDefinition, DocumentService} from '@valtimo/document';
import {EditorModel, PageTitleService} from '@valtimo/components';

@Injectable()
export class DossierDetailService implements OnDestroy {
  private readonly _loadingDocumentDefinition$ = new BehaviorSubject<boolean>(true);
  private readonly _previousSelectedVersionNumber$ = new BehaviorSubject<number | null>(null);
  private readonly _selectedVersionNumber$ = new BehaviorSubject<number | null>(null);
  private readonly _selectedDocumentDefinitionName$ = new BehaviorSubject<string>('');
  private readonly _documentDefinition$ = new BehaviorSubject<DocumentDefinition | null>(null);
  private readonly _documentDefinitionModel$: Observable<EditorModel> =
    this.documentDefinition$.pipe(
      map((definition: DocumentDefinition) => ({
        value: JSON.stringify(definition.schema, null, 2),
        language: 'json',
      }))
    );

  public get selectedVersionNumber$(): Observable<number | null> {
    return this._selectedVersionNumber$.pipe(filter(version => typeof version === 'number'));
  }

  public get previousSelectedVersionNumber$(): Observable<number | null> {
    return this._previousSelectedVersionNumber$.asObservable();
  }

  public get selectedDocumentDefinitionName$(): Observable<string> {
    return this._selectedDocumentDefinitionName$.pipe(filter(name => !!name));
  }

  public get selectedDocumentDefinitionIsReadOnly$(): Observable<boolean> {
    return this.documentDefinition$.pipe(
      map(definition => definition.readOnly),
      distinctUntilChanged()
    );
  }

  public get loadingDocumentDefinition$(): Observable<boolean> {
    return this._loadingDocumentDefinition$.asObservable();
  }

  public get documentDefinition$(): Observable<DocumentDefinition> {
    return this._documentDefinition$.pipe(filter(def => !!def));
  }

  public get documentDefinitionModel$(): Observable<EditorModel> {
    return this._documentDefinitionModel$;
  }

  private _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly pageTitleService: PageTitleService
  ) {
    this.openDocumentDefinitionSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public setSelectedVersionNumber(versionNumber: number): void {
    this._selectedVersionNumber$.next(versionNumber);
  }

  public setPreviousSelectedVersionNumber(versionNumber: number | null): void {
    this._previousSelectedVersionNumber$.next(versionNumber);
  }

  public setSelectedDocumentDefinitionName(name: string): void {
    this._selectedDocumentDefinitionName$.next(name);
  }

  public setLoadingDocumentDefinition(loading: boolean): void {
    this._loadingDocumentDefinition$.next(loading);
  }
  private openDocumentDefinitionSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.selectedVersionNumber$, this.selectedDocumentDefinitionName$])
        .pipe(
          tap(() => {
            this.pageTitleService.setCustomPageTitleSet(false);
            this.setLoadingDocumentDefinition(true);
          }),
          switchMap(([selectedVersion, selectedDocumentDefinitionName]) =>
            this.documentService.getDocumentDefinitionByVersion(
              selectedDocumentDefinitionName,
              selectedVersion
            )
          ),
          tap(res => {
            this._documentDefinition$.next(res);
            this.pageTitleService.setCustomPageTitle(res?.schema?.title || '-', true);
            this.setLoadingDocumentDefinition(false);
          })
        )
        .subscribe()
    );
  }
}
