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

import {BehaviorSubject, combineLatest, map, Observable, of, switchMap} from 'rxjs';
import {DocumentService, StartableItem} from '@valtimo/document';
import {BasicWidget} from '@valtimo/layout';

export class WidgetProcess {
  private readonly _baseDocumentId$ = new BehaviorSubject<string | null>(null);
  private readonly _baseWidgetConfiguration$ = new BehaviorSubject<BasicWidget | null>(null);
  protected set baseDocumentId(value: string) {
    this._baseDocumentId$.next(value);
  }
  protected set baseWidgetConfiguration(value: BasicWidget) {
    this._baseWidgetConfiguration$.next(value);
  }
  protected get baseDocumentId(): string {
    return this._baseDocumentId$.getValue();
  }

  private readonly _startableItems$ = combineLatest([
    this._baseDocumentId$,
    this._baseWidgetConfiguration$,
  ]).pipe(
    switchMap(([documentId, widgetConfiguration]: [string | null, BasicWidget | null]) => {
      if (
        !documentId ||
        !widgetConfiguration ||
        !widgetConfiguration.actions?.[0]?.processDefinitionKey
      ) {
        return of(null);
      }
      return this.documentService.getStartableItems({caseDocumentId: documentId});
    })
  );

  /** The startable items are the same PBAC-aware source the case's "start" menu uses. */
  public readonly canCreateCamundaExecution$: Observable<boolean> = combineLatest([
    this._startableItems$,
    this._baseWidgetConfiguration$,
  ]).pipe(
    map(([startableItems, widgetConfiguration]: [StartableItem[] | null, BasicWidget | null]) => {
      const processDefinitionKey = widgetConfiguration?.actions?.[0]?.processDefinitionKey;

      return !!startableItems?.some(
        (item: StartableItem) => item.key === processDefinitionKey && !!item.processDefinitionId
      );
    })
  );

  constructor(protected readonly documentService: DocumentService) {}
}
