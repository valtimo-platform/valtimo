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

import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule, DatePipe} from '@angular/common';
import {FormBuilder, FormGroup, ReactiveFormsModule} from '@angular/forms';
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
import {
  ButtonModule,
  CheckboxModule,
  DatePickerInputModule,
  DatePickerModule,
  DropdownModule,
  ListItem,
  LoadingModule,
  ProgressBarModule,
  TagModule,
} from 'carbon-components-angular';
import {AdminSettingsManagementApiService} from '../../services';
import {ReindexStatusDto, StartReindexRequestDto} from '../../models';
import {DocumentService} from '@valtimo/document';

@Component({
  standalone: true,
  selector: 'valtimo-admin-settings-opensearch',
  templateUrl: './admin-settings-opensearch.component.html',
  styleUrls: ['./admin-settings-opensearch.component.scss'],
  imports: [
    CommonModule,
    DatePipe,
    TranslateModule,
    ReactiveFormsModule,
    ButtonModule,
    CheckboxModule,
    DatePickerInputModule,
    DatePickerModule,
    DropdownModule,
    LoadingModule,
    ProgressBarModule,
    TagModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsOpensearchComponent implements OnInit, OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _refresh$ = new BehaviorSubject<void>(undefined);

  public readonly startingReindex$ = new BehaviorSubject<boolean>(false);

  public readonly formGroup: FormGroup = this._fb.group({
    pruneOrphans: [false],
    documentDefinitionName: [null],
    modifiedBefore: [null],
  });

  public documentDefinitions$: Observable<ListItem[]>;

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

  constructor(
    private readonly _apiService: AdminSettingsManagementApiService,
    private readonly _documentService: DocumentService,
    private readonly _fb: FormBuilder
  ) {}

  public ngOnInit(): void {
    this.documentDefinitions$ = this._documentService.queryDefinitionsForManagement().pipe(
      map(page =>
        page.content.map(def => ({
          content: def.id.name,
          selected: false,
        }))
      ),
      startWith([])
    );
  }

  public startReindex(): void {
    this.startingReindex$.next(true);
    const request = this._buildReindexRequest();
    this._apiService
      .startReindex(request)
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

  public onDateSelected(event: string[]): void {
    const dateValue = event?.[0] || null;
    this.formGroup.patchValue({modifiedBefore: dateValue});
  }

  private _buildReindexRequest(): StartReindexRequestDto {
    const formValue = this.formGroup.value;
    const request: StartReindexRequestDto = {};

    if (formValue.pruneOrphans) {
      request.pruneOrphans = true;
    }

    if (formValue.documentDefinitionName?.content) {
      request.documentDefinitionName = formValue.documentDefinitionName.content;
    }

    if (formValue.modifiedBefore) {
      request.modifiedBefore = this._formatDateToIso(formValue.modifiedBefore);
    }

    return request;
  }

  private _formatDateToIso(dateStr: string): string {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month}-${day}T23:59:59`;
    }
    return dateStr;
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
