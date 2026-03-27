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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CaseStatusService, DocumentService, InternalCaseStatus} from '@valtimo/document';
import {ProgressWidget, WidgetLayoutService, WidgetProgressComponent} from '@valtimo/layout';
import {Step} from 'carbon-components-angular';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {WidgetsService} from '../../widgets.service';

@Component({
  selector: 'valtimo-case-widget-progress',
  templateUrl: './case-widget-progress.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, WidgetProgressComponent],
})
export class CaseWidgetProgressComponent {
  private readonly _documentId$ = new BehaviorSubject<string>('');
  private readonly _widgetConfiguration$ = new BehaviorSubject<ProgressWidget | null>(null);
  private readonly _refresh$ = this.widgetsService.refreshWidgets$.pipe(startWith(null));

  @Input({required: true}) public set documentId(value: string) {
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: ProgressWidget) {
    if (!value) return;
    this._widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly vm$: Observable<{steps: Step[]; current: number; widget: ProgressWidget | null}> =
    combineLatest([this._documentId$, this._widgetConfiguration$, this._refresh$]).pipe(
      switchMap(([documentId, widget]) => {
        if (!documentId || !widget) return of(null);

        return this.documentService.getDocument(documentId).pipe(
          switchMap(document =>
            this.caseStatusService
              .getInternalCaseStatuses(document.definitionId?.name ?? document.definitionName)
              .pipe(
                map(statuses => {
                  const sorted = [...statuses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                  const currentStatusKey = document.internalStatus ?? null;
                  const currentIndex = currentStatusKey
                    ? sorted.findIndex(s => s.key === currentStatusKey)
                    : 0;
                  const effectiveCurrent = currentIndex >= 0 ? currentIndex : 0;

                  const steps: Step[] = sorted.map(
                    (status: InternalCaseStatus, i: number): Step => ({
                      label: status.title,
                      complete: i < effectiveCurrent,
                    })
                  );

                  return {steps, current: effectiveCurrent, widget};
                })
              )
          ),
          catchError(() => of({steps: [], current: 0, widget}))
        );
      }),
      tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid)),
      startWith(null)
    );

  constructor(
    private readonly documentService: DocumentService,
    private readonly caseStatusService: CaseStatusService,
    private readonly widgetsService: WidgetsService,
    private readonly widgetLayoutService: WidgetLayoutService
  ) {}
}
