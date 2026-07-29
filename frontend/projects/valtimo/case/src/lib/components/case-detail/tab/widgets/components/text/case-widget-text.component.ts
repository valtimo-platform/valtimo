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
import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {TextWidget, WidgetLayoutService, WidgetTextComponent} from '@valtimo/layout';
import {BehaviorSubject} from 'rxjs';

@Component({
  selector: 'valtimo-case-widget-text',
  templateUrl: './case-widget-text.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TranslateModule, WidgetTextComponent],
})
export class CaseWidgetTextComponent implements OnInit {
  @Input({required: true}) public documentId: string;

  @Input() public set widgetConfiguration(value: TextWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  @Input() public readonly widgetUuid: string;

  public readonly widgetConfiguration$ = new BehaviorSubject<TextWidget | null>(null);

  constructor(private readonly widgetLayoutService: WidgetLayoutService) {}

  /**
   * The content of a text widget is part of its configuration, so there is no data to fetch.
   * The layout still has to be told the widget is ready, because it only considers itself loaded
   * once at least one widget has reported in — a tab containing only text widgets would otherwise
   * keep showing its loading state.
   */
  public ngOnInit(): void {
    this.widgetLayoutService.setWidgetDataLoaded(this.widgetUuid);
  }
}
