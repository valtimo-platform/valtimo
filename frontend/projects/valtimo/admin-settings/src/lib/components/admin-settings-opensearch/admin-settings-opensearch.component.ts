/*
 *
 *  * Copyright 2015-2026 Ritense BV, the Netherlands.
 *  *
 *  * Licensed under EUPL, Version 1.2 (the "License");
 *  * you may not use this file except in compliance with the License.
 *  * You may obtain a copy of the License at
 *  *
 *  * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *  *
 *  * Unless required by applicable law or agreed to in writing, software
 *  * distributed under the License is distributed on an "AS IS" basis,
 *  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  * See the License for the specific language governing permissions and
 *  * limitations under the License.
 *
 */

import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  BehaviorSubject,
  finalize,
  interval,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  take,
  takeUntil,
  takeWhile,
} from 'rxjs';
import {ButtonModule, LoadingModule, ProgressBarModule, TagModule} from 'carbon-components-angular';
import {AdminSettingsManagementApiService} from '../../services';
import {ReindexStatusDto} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-opensearch',
  templateUrl: './admin-settings-opensearch.component.html',
  styleUrls: ['./admin-settings-opensearch.component.scss'],
  imports: [CommonModule, DatePipe, TranslateModule, ButtonModule, LoadingModule, ProgressBarModule, TagModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsOpensearchComponent implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _refresh$ = new BehaviorSubject<void>(undefined);

  public readonly startingReindex$ = new BehaviorSubject<boolean>(false);

  public readonly reindexStatus$: Observable<ReindexStatusDto | null> = this._refresh$.pipe(
    switchMap(() => this._apiService.getReindexStatus()),
    switchMap(status => {
      if (status?.status === 'RUNNING') {
        return interval(2000).pipe(
          startWith(0),
          switchMap(() => this._apiService.getReindexStatus()),
          takeWhile(s => s?.status === 'RUNNING', true),
          takeUntil(this._destroy$)
        );
      }
      return of(status);
    }),
    shareReplay(1)
  );

  public readonly isRunning$: Observable<boolean> = this.reindexStatus$.pipe(
    map(status => status?.status === 'RUNNING')
  );

  constructor(private readonly _apiService: AdminSettingsManagementApiService) {}

  public startReindex(): void {
    this.startingReindex$.next(true);
    this._apiService
      .startReindex()
      .pipe(
        take(1),
        finalize(() => this.startingReindex$.next(false))
      )
      .subscribe({
        next: () => this._refresh$.next(),
        error: err => {
          if (err.status === 409) {
            this._refresh$.next();
          }
        },
      });
  }

  public getStatusTagType(status: string): string {
    switch (status) {
      case 'RUNNING':
        return 'blue';
      case 'COMPLETED':
        return 'green';
      case 'FAILED':
        return 'red';
      case 'STOPPED':
        return 'gray';
      default:
        return 'gray';
    }
  }

  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
