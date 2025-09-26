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

import {Injectable, OnDestroy} from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  startWith,
  Subject,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {DocumentDefinition, DocumentService} from '@valtimo/document';
import {EditorModel, PageTitleService} from '@valtimo/components';

@Injectable()
export class CaseDetailService implements OnDestroy {
  private readonly _loadingDocumentDefinition$ = new BehaviorSubject<boolean>(true);
  private readonly _previousSelectedCaseDefinitionVersionTag$ = new BehaviorSubject<string | null>(
    null
  );
  private readonly _selectedCaseDefinitionVersionTag$ = new BehaviorSubject<string | null>(null);
  private readonly _selectedCaseDefinitionKey$ = new BehaviorSubject<string>('');
  private readonly _documentDefinition$ = new BehaviorSubject<DocumentDefinition | null>(null);
  private readonly _documentDefinitionModel$: Observable<EditorModel> =
    this.documentDefinition$.pipe(
      map((definition: DocumentDefinition | null) => ({
        value: JSON.stringify(definition?.schema, null, 2),
        language: 'json',
      }))
    );
  private readonly _reloadDocumentDefinition$ = new Subject<void>();

  public get selectedCaseDefinitionVersionTag$(): Observable<string | null> {
    return this._selectedCaseDefinitionVersionTag$.pipe(
      filter(version => typeof version === 'string'),
      distinctUntilChanged()
    );
  }

  public get previousSelectedCaseDefinitionVersionTag$(): Observable<string | null> {
    return this._previousSelectedCaseDefinitionVersionTag$.asObservable();
  }

  public get selectedCaseDefinitionKey$(): Observable<string> {
    return this._selectedCaseDefinitionKey$.pipe(
      filter(name => !!name),
      distinctUntilChanged()
    );
  }

  public get selectedDocumentDefinitionIsReadOnly$(): Observable<boolean> {
    return this.documentDefinition$.pipe(
      map(definition => definition?.readOnly ?? false),
      distinctUntilChanged()
    );
  }

  public get loadingDocumentDefinition$(): Observable<boolean> {
    return this._loadingDocumentDefinition$.pipe(distinctUntilChanged());
  }

  public get documentDefinition$(): Observable<DocumentDefinition | null> {
    return this._documentDefinition$.pipe(
      filter(def => !!def),
      distinctUntilChanged()
    );
  }

  public get documentDefinitionModel$(): Observable<EditorModel> {
    return this._documentDefinitionModel$.pipe(distinctUntilChanged());
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

  public setSelectedCaseDefinitionVersionTag(versionTag: string): void {
    this._selectedCaseDefinitionVersionTag$.next(versionTag);
  }

  public setPreviousSelectedCaseDefinitionVersionTag(versionTag: string | null): void {
    this._previousSelectedCaseDefinitionVersionTag$.next(versionTag);
  }

  public setSelectedCaseDefinitionKey(key: string): void {
    this._selectedCaseDefinitionKey$.next(key);
  }

  public setLoadingDocumentDefinition(loading: boolean): void {
    this._loadingDocumentDefinition$.next(loading);
  }

  public reloadDocumentDefinition(): void {
    this._reloadDocumentDefinition$.next(null);
  }

  private openDocumentDefinitionSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        this.selectedCaseDefinitionVersionTag$,
        this.selectedCaseDefinitionKey$,
        this._reloadDocumentDefinition$.pipe(startWith(null)),
      ])
        .pipe(
          tap(() => {
            this.pageTitleService.setCustomPageTitleSet(false);
            this.setLoadingDocumentDefinition(true);
          }),
          switchMap(([selectedVersionTag, selectedKey]) =>
            this.documentService.getDocumentDefinitionByVersion(selectedKey, selectedVersionTag)
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
