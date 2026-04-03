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

import {EventEmitter, Injectable} from '@angular/core';
import {DocumentService, StartableItem} from '@valtimo/document';
import {
  BehaviorSubject,
  Subject,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  Observable,
  switchMap,
} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WidgetsService {
  private readonly _documentId$ = new BehaviorSubject<string | null>(null);
  private readonly _activeProcessKey$ = new BehaviorSubject<string | null>(null);
  private readonly _refreshWidgets$ = new Subject<void>();
  public readonly startProcessEvent = new EventEmitter();

  public readonly refreshWidgets$ = this._refreshWidgets$.asObservable();

  public set documentId(value: string) {
    this._documentId$.next(value);
  }

  private readonly startableItems$ = this._documentId$.pipe(
    filter((documentId: string | null) => !!documentId),
    switchMap((documentId: string) => this.documentService.getStartableItems({caseDocumentId: documentId})),
    distinctUntilChanged()
  );

  public get activeProcess$(): Observable<StartableItem> {
    return combineLatest([this._activeProcessKey$, this.startableItems$]).pipe(
      map(([activeProcessKey, items]: [string, StartableItem[]]) => {
        return items.find((item: StartableItem) => activeProcessKey === item.key);
      })
    );
  }

  constructor(private readonly documentService: DocumentService) {}

  public startProcess(processDocumentDefinitionKey: string): void {
    this._activeProcessKey$.next(processDocumentDefinitionKey);
    this.startProcessEvent.emit();
  }

  public finishProcess(): void {
    this._activeProcessKey$.next(null);
  }

  public refreshWidgets(): void {
    this._refreshWidgets$.next();
  }
}
