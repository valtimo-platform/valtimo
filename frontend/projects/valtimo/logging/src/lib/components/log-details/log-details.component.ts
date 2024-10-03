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
import {EditorModel, EditorModule} from '@valtimo/components';
import {ModalModule} from 'carbon-components-angular';
import {LoggingEvent} from '../../models';

@Component({
  selector: 'valtimo-log-details',
  templateUrl: './log-details.component.html',
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalModule, EditorModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LogDetailsComponent {
  private _logEventModel: EditorModel | null = null;
  @Input() public set logEvent(value: LoggingEvent | null) {
    if (!value) {
      this._logEventModel = null;
      return;
    }

    this._logEventModel = {
      value: JSON.stringify(value),
      language: 'json',
    };
  }
  public get logEventModel(): EditorModel | null {
    return this._logEventModel;
  }

  @Output() closeModalEvent = new EventEmitter();

  public onCloseSelect(): void {
    this.closeModalEvent.emit();
  }
}
