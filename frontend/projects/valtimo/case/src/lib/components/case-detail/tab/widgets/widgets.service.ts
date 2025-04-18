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
import {DocumentService, ProcessDefinitionCaseDefinition} from '@valtimo/document';
import {BehaviorSubject, distinctUntilChanged, filter, Observable, switchMap} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class WidgetsService {
  private readonly _activeProcessKey$ = new BehaviorSubject<string | null>(null);
  public readonly startProcessEvent = new EventEmitter();

  public get activeProcess$(): Observable<ProcessDefinitionCaseDefinition[]> {
    return this._activeProcessKey$.pipe(
      filter((processDocumentDefinition: string | null) => !!processDocumentDefinition),
      switchMap((processDefinitionKey: string) =>
        this.documentService.findProcessDefinitionCaseDefinitions(processDefinitionKey)
      ),
      distinctUntilChanged()
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
}
