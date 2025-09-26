/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule} from '@ngx-translate/core';
import {ModalModule} from 'carbon-components-angular';
import {LoggingEvent} from '../../models';
import {ValtimoCdsModalDirectiveModule} from '@valtimo/components';

@Component({
  selector: 'valtimo-log-details',
  templateUrl: './log-details.component.html',
  styleUrl: './log-details.component.scss',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalModule, ValtimoCdsModalDirectiveModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogDetailsComponent {
  @Input() public open = false;

  @Input() public set logEvent(logEvent: LoggingEvent) {
    this.logEventFormatted = {
      ...logEvent,
      stacktrace: this.formatStacktrace(logEvent?.stacktrace),
    };
  }

  @Output() public readonly closeModalEvent = new EventEmitter();

  public logEventFormatted: LoggingEvent;

  public readonly classesToIgnore: string[] = [
    'LoggingContextKt',
    'LoggableResourceAspect',
    'RunWithoutAuthorizationAspect',
    'UserLoggingFilter',
  ];

  public onCloseSelect(): void {
    this.closeModalEvent.emit();
  }

  private formatStacktrace(s?: string): string {
    if (!s) {
      return s;
    }

    s = s.replace(/^[^\t].+(Exception|Error): .+/gm, '<span class="highlight1">$&</span>');
    s = s.replace(/^Caused by: .+/gm, '<span class="highlight1">$&</span>');
    this.classesToIgnore.forEach(
      c =>
        (s = s.replace(
          new RegExp(`^\tat .+\.${c}\..+`, 'gm'),
          '<span class="highlight3">$&</span>'
        ))
    );
    s = s.replace(/^\tat com.(ritense|valtimo).+/gm, '<span class="highlight2">$&</span>');
    s = s.replace(/^\t.+common frames omitted$/gm, '<span class="highlight3">$&</span>');
    s = s.replace(/^\tat .+/gm, '<span class="highlight3">$&</span>');
    return s;
  }
}
