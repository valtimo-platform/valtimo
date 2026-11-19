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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {DocumentService} from '@valtimo/document';
import {ProcessLinkService, TaskWithProcessLink} from '@valtimo/process-link';
import {SseService} from '@valtimo/sse';
import {BehaviorSubject, NEVER, Observable, of, Subject} from 'rxjs';
import {CaseDetailLayoutService} from '../../services';
import {CaseDetailTaskListComponent} from './case-detail-task-list.component';

describe('CaseDetailTaskListComponent', () => {
  let fixture: ComponentFixture<CaseDetailTaskListComponent>;
  let refreshTasks$: BehaviorSubject<null>;
  let processLinkService: jasmine.SpyObj<ProcessLinkService>;

  const taskWithProcessLink = (id: string, name: string): TaskWithProcessLink =>
    ({
      task: {id, name, created: '2026-10-22T10:00:00Z', priority: 50},
      processLinkActivityResult: null,
    }) as unknown as TaskWithProcessLink;

  const renderedTaskNames = (): string[] =>
    Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('.task__title')).map(element =>
      element.textContent.trim()
    );

  beforeEach(() => {
    refreshTasks$ = new BehaviorSubject<null>(null);
    processLinkService = jasmine.createSpyObj('ProcessLinkService', ['getTasksWithProcessLinks']);

    TestBed.configureTestingModule({
      imports: [CaseDetailTaskListComponent, TranslateModule.forRoot()],
      providers: [
        {provide: ActivatedRoute, useValue: {params: of({documentId: 'document-1'})}},
        {provide: SseService, useValue: {getSseEventObservable: () => NEVER}},
        {
          provide: DocumentService,
          useValue: {
            findProcessDocumentInstances: () =>
              of([{id: {processInstanceId: 'process-instance-1'}}]),
          },
        },
        {provide: PermissionService, useValue: {requestPermission: () => of(true)}},
        {provide: CaseDetailLayoutService, useValue: {refreshTasks$}},
        {provide: ProcessLinkService, useValue: processLinkService},
      ],
    });
  });

  it('hides a completed task while the task list reloads', () => {
    const initialTasks$ = new Subject<TaskWithProcessLink[]>();
    const reloadedTasks$ = new Subject<TaskWithProcessLink[]>();
    processLinkService.getTasksWithProcessLinks.and.returnValues(
      initialTasks$ as Observable<TaskWithProcessLink[]>,
      reloadedTasks$ as Observable<TaskWithProcessLink[]>
    );

    fixture = TestBed.createComponent(CaseDetailTaskListComponent);
    fixture.detectChanges();
    initialTasks$.next([taskWithProcessLink('task-1', 'Task 1')]);
    fixture.detectChanges();
    expect(renderedTaskNames()).toEqual(['Task 1']);

    refreshTasks$.next(null);
    fixture.detectChanges();

    expect(renderedTaskNames()).toEqual([]);
    expect(fixture.nativeElement.querySelector('cds-loading')).not.toBeNull();

    reloadedTasks$.next([taskWithProcessLink('task-2', 'Task 2')]);
    fixture.detectChanges();

    expect(renderedTaskNames()).toEqual(['Task 2']);
  });
});
