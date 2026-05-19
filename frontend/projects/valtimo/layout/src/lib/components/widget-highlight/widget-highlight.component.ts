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
import {ChangeDetectionStrategy, Component, HostBinding, Input, ViewEncapsulation} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {MdiIconViewerComponent} from '@valtimo/components';
import {SkeletonModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {HighlightWidget} from '../../models';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';

@Component({
  selector: 'valtimo-widget-highlight',
  templateUrl: './widget-highlight.component.html',
  styleUrls: ['./widget-highlight.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    MdiIconViewerComponent,
    WidgetActionButtonComponent,
    SkeletonModule,
  ],
})
export class WidgetHighlightComponent {
  @HostBinding('class') public readonly hostClasses = 'valtimo-widget-highlight';

  @Input() public set widgetConfiguration(value: HighlightWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public set widgetData(value: object | null) {
    this.widgetData$.next(value ?? null);
  }

  public readonly widgetConfiguration$ = new BehaviorSubject<HighlightWidget | null>(null);
  public readonly widgetData$ = new BehaviorSubject<object | null>(null);

  public readonly displayValue$: Observable<string | number | null> = combineLatest([
    this.widgetConfiguration$,
    this.widgetData$,
  ]).pipe(map(([, widgetData]) => this.toDisplayValue((widgetData as Record<string, unknown>)?.value)));

  public readonly hasValue$: Observable<boolean> = this.displayValue$.pipe(
    map(displayValue => displayValue !== null)
  );

  private toDisplayValue(rawValue: unknown): string | number | null {
    if (Array.isArray(rawValue)) {
      return rawValue.length;
    }

    if (rawValue === null || rawValue === undefined) {
      return null;
    }

    const valueType = typeof rawValue;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
      return String(rawValue);
    }

    return null;
  }
}
