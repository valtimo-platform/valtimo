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
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
  Input,
  Output,
} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ActionableContent, NotificationModule} from 'carbon-components-angular';
import {combineLatest, map, Observable} from 'rxjs';

/**
 * Covers a widget whose data could not be retrieved, so it is not shown as an empty widget.
 *
 * Sits on top of the widget instead of in its flow, so it cannot change the widget's size. It
 * reprints the widget title, which the overlay hides — `widgetType` picks the inset that puts it
 * back exactly where the widget renders it.
 */
@Component({
  selector: 'valtimo-widget-data-error',
  templateUrl: './widget-data-error.component.html',
  styleUrls: ['./widget-data-error.component.scss'],
  standalone: true,
  imports: [CommonModule, NotificationModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetDataErrorComponent {
  @Input() public widgetTitle: string;

  @Input() public widgetType: string;

  @Output() public retryEvent = new EventEmitter<void>();

  @HostBinding('attr.data-widget-type')
  public get widgetTypeAttr(): string | null {
    return this.widgetType ?? null;
  }

  public readonly notification$: Observable<ActionableContent> = combineLatest([
    this.translateService.stream('widgets.dataError.title'),
    this.translateService.stream('widgets.dataError.retry'),
  ]).pipe(
    map(([title, retry]) => ({
      type: 'error' as const,
      variant: 'inline' as const,
      title,
      showClose: false,
      lowContrast: true,
      actions: [{text: retry, click: () => this.retryEvent.emit()}],
    }))
  );

  constructor(private readonly translateService: TranslateService) {}
}
