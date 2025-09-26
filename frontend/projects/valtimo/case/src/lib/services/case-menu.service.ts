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
import {CaseDefinition, DocumentService} from '@valtimo/document';
import {MenuItem} from '@valtimo/shared';
import {from, Observable, of, Subject, Subscription} from 'rxjs';
import {switchMap} from 'rxjs/operators';
import {SseService} from '@valtimo/sse';
import {MenuService} from '@valtimo/components';

@Injectable({providedIn: 'root'})
export class CaseMenuService implements OnDestroy {
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly documentService: DocumentService,
    private readonly sseService: SseService,
    private readonly menuService: MenuService
  ) {
    this.menuService.registerAppendMenuItemsFunction(this.appendCaseMenuItems.bind(this));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public appendCaseMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    return from(this.documentService.getCaseDefinitions({active: true})).pipe(
      switchMap(definitions => {
        const countMap = this.getCountMap(definitions);

        const caseItems: MenuItem[] = definitions.map((def, index) => ({
          link: ['/cases/' + def.caseDefinitionKey],
          title: def.name,
          iconClass: 'icon mdi mdi-dot-circle',
          sequence: index,
          show: true,
          ...(countMap && {count$: countMap.get(def.caseDefinitionKey)}),
        }));

        const index = menuItems.findIndex(i => i.title === 'Cases' || i.title === 'Dossiers');

        if (index >= 0) {
          menuItems[index].children = caseItems;
        }

        return of(menuItems);
      })
    );
  };

  private getCountMap(definitions: CaseDefinition[]): Map<string, Subject<number>> {
    const map = new Map<string, Subject<number>>();

    definitions.forEach(def => {
      map.set(def.caseDefinitionKey, new Subject<number>());
    });

    this._subscriptions.add(
      this.sseService
        .getSseMessagesObservableByEventType(['CASE_UNASSIGNED', 'CASE_ASSIGNED', 'CASE_CREATED'])
        .subscribe(() => this.updateCounts(map))
    );

    this.updateCounts(map);
    return map;
  }

  private updateCounts(map: Map<string, Subject<number>>): void {
    this.documentService.getOpenDocumentCount().subscribe(counts => {
      counts.forEach(entry => {
        const subject = map.get(entry.documentDefinitionName);
        if (subject) {
          subject.next(entry.openDocumentCount);
        }
      });
    });
  }
}
