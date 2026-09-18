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
import {HttpErrorResponse} from '@angular/common/http';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {
  PersonCardWidget,
  WidgetDataGroupService,
  WidgetLayoutService,
  WidgetPersonCardComponent,
} from '@valtimo/layout';
import {BehaviorSubject, Observable, catchError, filter, of, switchMap, tap} from 'rxjs';

@Component({
  selector: 'valtimo-case-widget-person-card',
  templateUrl: './case-widget-person-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, WidgetPersonCardComponent],
})
export class CaseWidgetPersonCardComponent {
  private readonly _documentId$ = new BehaviorSubject<string>('');

  @Input({required: true}) public set documentId(value: string) {
    this._documentId$.next(value);
  }

  @Input() public set widgetConfiguration(value: PersonCardWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<PersonCardWidget | null>(null);

  public readonly widgetData$: Observable<any> = this.widgetConfiguration$.pipe(
    filter(widget => !!widget),
    switchMap(widget => this.widgetDataGroupService.dataFor(widget.key)),
    tap(() => this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid)),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
      return of(null);
    })
  );

  constructor(
    private readonly widgetLayoutService: WidgetLayoutService,
    private readonly widgetDataGroupService: WidgetDataGroupService
  ) {}
}
