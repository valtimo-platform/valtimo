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

import {Component} from '@angular/core';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {DocumentService, LoadedValue, ProcessDocumentInstance} from '@valtimo/document';
import {SkippableTimer} from '@valtimo/process';
import {GlobalNotificationService} from '@valtimo/shared';
import {TranslateService} from '@ngx-translate/core';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {ListItem} from 'carbon-components-angular/dropdown';
import {CaseProcessTimerService} from '../../../../services';

@Component({
  standalone: false,
  selector: 'valtimo-case-detail-tab-progress',
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss'],
})
export class CaseDetailTabProgressComponent {
  private readonly _documentId$: Observable<string | null> = this.route.paramMap.pipe(
    map((params: ParamMap) => params.get('documentId')),
    shareReplay({bufferSize: 1, refCount: true})
  );

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
          a.active === b.active ? b.startedOn.getTime() - a.startedOn.getTime() : a.active ? -1 : 1
        )
      ),
      tap(processDocumentInstances => {
        if (processDocumentInstances.length > 0) {
          this.selectedProcessInstanceId$.next(processDocumentInstances[0].id.processInstanceId);
        }
      })
    );

  public readonly processInstanceItems$: Observable<LoadedValue<Array<ListItem>>> =
    this.processDocumentInstances$.pipe(
      map(processDocumentInstances =>
        processDocumentInstances.map((processDocumentInstance, index) => ({
          processInstanceId: processDocumentInstance.id.processInstanceId,
          content: processDocumentInstance.processName || '-',
          selected: index === 0,
        }))
      ),
      map(processInstanceItems => ({
        value: processInstanceItems,
        isLoading: false,
      })),
      startWith({isLoading: true})
    );

  public readonly selectedProcessInstanceId$ = new BehaviorSubject<string | null>(null);
  public readonly selectedProcessInstance$: Observable<LoadedValue<ProcessDocumentInstance>> =
    combineLatest([this.processDocumentInstances$, this.selectedProcessInstanceId$]).pipe(
      map(([processDocumentInstances, selectedProcessInstanceId]) =>
        processDocumentInstances.find(
          instance => instance.id.processInstanceId === selectedProcessInstanceId
        )
      ),
      map(processInstanceItems => ({
        value: processInstanceItems,
        isLoading: false,
      })),
      startWith({isLoading: true})
    );

  public readonly diagramReloadToken$ = new BehaviorSubject<number>(0);
  public readonly showSkipConfirm$ = new BehaviorSubject<boolean>(false);

  private readonly _reloadTimers$ = new BehaviorSubject<void>(undefined);

  /**
   * The endpoint only returns the timers the user is allowed to complete, so no separate permission
   * check is needed here. Checking the `complete` permission on `OperatonTimer` up front would not
   * work for permissions that are conditional on the timer or the case it belongs to.
   */
  public readonly skippableTimers$: Observable<Array<SkippableTimer>> = combineLatest([
    this._documentId$,
    this.selectedProcessInstanceId$,
    this._reloadTimers$,
  ]).pipe(
    switchMap(([documentId, processInstanceId]) => {
      if (!documentId || !processInstanceId) {
        return of<Array<SkippableTimer>>([]);
      }
      return this.caseProcessTimerService.getSkippableTimers(documentId, processInstanceId).pipe(
        map(jobs => jobs.map(job => ({jobId: job.id, activityId: job.activityId}))),
        catchError(() => of<Array<SkippableTimer>>([]))
      );
    }),
    startWith<Array<SkippableTimer>>([]),
    shareReplay({bufferSize: 1, refCount: true})
  );

  public readonly canSkipTimer$: Observable<boolean> = this.skippableTimers$.pipe(
    map(timers => timers.length > 0)
  );

  private readonly _pendingSkip$ = new BehaviorSubject<SkippableTimer | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly documentService: DocumentService,
    private readonly caseProcessTimerService: CaseProcessTimerService,
    private readonly notificationService: GlobalNotificationService,
    private readonly translateService: TranslateService
  ) {}

  public loadProcessInstance(processInstanceId: string): void {
    if (!!processInstanceId) {
      this.selectedProcessInstanceId$.next(processInstanceId);
    }
  }

  public onRequestSkipTimer(timer: SkippableTimer): void {
    this._pendingSkip$.next(timer);
    this.showSkipConfirm$.next(true);
  }

  public onConfirmSkipTimer(): void {
    this.showSkipConfirm$.next(false);
    const timer = this._pendingSkip$.value;
    const processInstanceId = this.selectedProcessInstanceId$.value;

    this._documentId$.pipe(take(1)).subscribe(documentId => {
      if (!timer || !documentId || !processInstanceId) {
        this._pendingSkip$.next(null);
        return;
      }

      this.caseProcessTimerService.skipTimer(documentId, processInstanceId, timer.jobId).subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('progress.skipTimer.successToast'),
            message: '',
          });
          this._pendingSkip$.next(null);
          this._reloadTimers$.next();
          this.diagramReloadToken$.next(this.diagramReloadToken$.value + 1);
        },
        // HTTP failures are surfaced globally by HttpErrorInterceptor; only reset local state here.
        error: () => {
          this._pendingSkip$.next(null);
        },
      });
    });
  }

  public onCancelSkipTimer(): void {
    this.showSkipConfirm$.next(false);
    this._pendingSkip$.next(null);
  }
}
