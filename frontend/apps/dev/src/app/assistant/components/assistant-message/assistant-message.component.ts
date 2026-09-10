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
import {TranslateModule} from '@ngx-translate/core';
import {ASSISTANT_TEST_IDS} from '../../constants';
import {AssistantMessage} from '../../models';
import {AssistantMarkdownPipe} from '../../pipes';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-message',
  templateUrl: './assistant-message.component.html',
  styleUrls: ['./assistant-message.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AssistantMarkdownPipe, CommonModule, TranslateModule],
})
export class AssistantMessageComponent {
  @Input() public message!: AssistantMessage;

  protected readonly testIds = ASSISTANT_TEST_IDS;
}
