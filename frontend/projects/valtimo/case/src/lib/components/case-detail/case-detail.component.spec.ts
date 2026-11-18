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

import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {of, Subject} from 'rxjs';
import {CaseDetailTaskPanelService} from '../../services/case-detail-task-panel.service';
import {CaseDetailComponent} from './case-detail.component';

describe('CaseDetailComponent', () => {
  const documentId = 'doc-1';
  let component: CaseDetailComponent;
  let documentService: {getStartableItems: jasmine.Spy};
  let sseEvents: Record<string, Subject<unknown>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CaseDetailTaskPanelService,
          useValue: {available$: of(false), visible$: of(false)},
        },
      ],
    });

    sseEvents = {
      CASE_STATUS_UPDATED: new Subject<unknown>(),
      DOCUMENT_UPDATED: new Subject<unknown>(),
      TASK_UPDATE: new Subject<unknown>(),
    };
    const sseService = {
      getSseEventObservable: (type: string) => (sseEvents[type] ??= new Subject<unknown>()),
    };
    documentService = {
      getStartableItems: jasmine.createSpy('getStartableItems').and.returnValue(of([])),
    };

    const route = {
      snapshot: {paramMap: {get: (key: string) => (key === 'documentId' ? documentId : null)}},
      paramMap: of({get: () => documentId}),
      params: of({documentId}),
    };
    const caseDetailLayoutService = {
      taskAndProcessLinkOpenedInPanel$: of(null),
      startFormPanel$: of(null),
      formDisplaySize$: of('medium'),
      caseDetailLayout$: of(null),
      tabContentContainerMaxHeight$: of(null),
    };

    component = TestBed.runInInjectionContext(
      () =>
        new CaseDetailComponent(
          {} as any,
          {} as any,
          {currentTheme$: of(null)} as any,
          {} as any,
          documentService as any,
          caseDetailLayoutService as any,
          {} as any,
          {refreshDocument$: of(null), refresh: () => {}} as any,
          {$tabHorizontalOverflowDisabled: of(false), showTaskList$: of(false)} as any,
          {} as any,
          {isLoggedIn: () => false} as any,
          {} as any,
          {} as any,
          {compactMode$: of(false), smallTitle$: of(false)} as any,
          {} as any,
          {} as any,
          {instant: (key: string) => key, stream: () => of('')} as any,
          {} as any,
          route as any,
          {} as any,
          {} as any,
          {getUserSubject: () => of(null)} as any,
          sseService as any,
          document
        )
    );
  });

  describe('start menu live refresh', () => {
    const open = () => (component as any).openStartableItemsSseSubscription();
    const close = () => (component as any)._subscriptions.unsubscribe();

    it('reloads the startable items when the internal status of the case changes', fakeAsync(() => {
      open();
      sseEvents['CASE_STATUS_UPDATED'].next({documentId});
      tick(300);

      expect(documentService.getStartableItems).toHaveBeenCalledWith({caseDocumentId: documentId});
      close();
    }));

    it('reloads the startable items when the case is updated', fakeAsync(() => {
      open();
      sseEvents['DOCUMENT_UPDATED'].next({documentId});
      tick(300);

      expect(documentService.getStartableItems).toHaveBeenCalledWith({caseDocumentId: documentId});
      close();
    }));

    it('ignores status changes of other cases', fakeAsync(() => {
      open();
      sseEvents['CASE_STATUS_UPDATED'].next({documentId: 'other'});
      tick(300);

      expect(documentService.getStartableItems).not.toHaveBeenCalled();
      close();
    }));
  });
});
