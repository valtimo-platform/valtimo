/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Component} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {DocumentService, ProcessDocumentInstance} from '@valtimo/document';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {ListItem} from 'carbon-components-angular/dropdown';

@Component({
  selector: 'valtimo-dossier-detail-tab-progress',
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.css'],
})
export class DossierDetailTabProgressComponent {
  private readonly processDocumentInstances$: Observable<Array<ProcessDocumentInstance>> =
    this.route.paramMap.pipe(
      switchMap((params: ParamMap) =>
        this.documentService.findProcessDocumentInstances(params.get('documentId'))
      ),
      map(processDocumentInstances =>
        processDocumentInstances.map(processDocumentInstance => ({
          ...processDocumentInstance,
          startedOn: new Date(processDocumentInstance.startedOn),
        }))
      ),
      map(processDocumentInstances =>
        processDocumentInstances.sort((a, b) =>
          a.isActive === b.isActive
            ? b.startedOn.getTime() - a.startedOn.getTime()
            : a.isActive
            ? -1
            : 1
        )
      ),
      tap(processDocumentInstances => {
        if (processDocumentInstances.length > 0) {
          this.selectedProcessInstanceId$.next(processDocumentInstances[0].id.processInstanceId);
        }
      })
    );

  public readonly processInstanceItems$: Observable<Array<ListItem>> =
    this.processDocumentInstances$.pipe(
      map(processDocumentInstances =>
        processDocumentInstances.map((processDocumentInstance, index) => ({
          processInstanceId: processDocumentInstance.id.processInstanceId,
          content: processDocumentInstance.processName || '-',
          selected: index === 0,
        }))
      )
    );

  public readonly selectedProcessInstanceId$ = new BehaviorSubject<string | null>(null);
  public readonly selectedProcessInstance$ = combineLatest([
    this.processDocumentInstances$,
    this.selectedProcessInstanceId$,
  ]).pipe(
    map(([processDocumentInstances, selectedProcessInstanceId]) =>
      processDocumentInstances.find(
        instance => instance.id.processInstanceId === selectedProcessInstanceId
      )
    )
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService
  ) {}

  public loadProcessInstance(processInstanceId: any) {
    if (!!processInstanceId) {
      this.selectedProcessInstanceId$.next(processInstanceId);
    }
  }
}
