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
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ASSISTANT_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-suggestions',
  templateUrl: './assistant-suggestions.component.html',
  styleUrls: ['./assistant-suggestions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule],
})
export class AssistantSuggestionsComponent {
  @Input() public suggestionKeys: ReadonlyArray<string> = [];

  @Output() public suggestionSelectEvent = new EventEmitter<string>();

  protected readonly testIds = ASSISTANT_TEST_IDS;

  constructor(private readonly translateService: TranslateService) {}

  // Emits the label, not the key — it goes straight into the chat as the user's message.
  public onSuggestionClick(suggestionKey: string): void {
    this.suggestionSelectEvent.emit(this.translateService.instant(suggestionKey));
  }
}
