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
  HostBinding,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {MdiIconViewerComponent} from '@valtimo/components';
import {BehaviorSubject, map, Observable} from 'rxjs';
import {TextWidget} from '../../models';
import {WidgetActionButtonComponent} from '../widget-action-button/widget-action-button.component';
import {renderWidgetMarkdown} from './widget-text-markdown';

@Component({
  selector: 'valtimo-widget-text',
  templateUrl: './widget-text.component.html',
  styleUrls: ['./widget-text.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [CommonModule, TranslateModule, MdiIconViewerComponent, WidgetActionButtonComponent],
})
export class WidgetTextComponent {
  @HostBinding('class') public readonly hostClasses = 'valtimo-widget-text';

  @Input() public set widgetConfiguration(value: TextWidget) {
    if (!value) return;
    this.widgetConfiguration$.next(value);
  }

  public readonly widgetConfiguration$ = new BehaviorSubject<TextWidget | null>(null);

  /**
   * The rendered markdown is bound with a plain `[innerHTML]` binding on purpose: Angular's
   * DomSanitizer then strips scripts, event handlers and `javascript:` URLs. Never wrap this in
   * `bypassSecurityTrustHtml` — the content is authored by an administrator, but that is not the
   * same as trusted.
   */
  public readonly html$: Observable<string> = this.widgetConfiguration$.pipe(
    map(widgetConfiguration => renderWidgetMarkdown(widgetConfiguration?.properties?.content ?? ''))
  );
}
