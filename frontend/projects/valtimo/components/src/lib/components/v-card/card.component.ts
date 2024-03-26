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

import {Component, EventEmitter, Input, Output} from '@angular/core';

/**
 * @deprecated Migrate old design to Carbon
 */
@Component({
  selector: 'v-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
})
export class VCardComponent {
  @Input() titleTranslationKey = '';
  @Input() title = '';
  @Input() descriptionTranslationKey = '';
  @Input() description = '';
  @Input() selectable = false;
  @Input() selected = false;
  @Input() fullHeight = false;
  @Input() loading = false;
  @Input() loadingTitle = false;
  @Input() loadingDescription = false;

  @Output() selectEvent: EventEmitter<any> = new EventEmitter();
  @Output() deselectEvent: EventEmitter<any> = new EventEmitter();

  click(): void {
    if (this.selectable) {
      if (this.selected) {
        this.deselectEvent.emit();
      } else {
        this.selectEvent.emit();
      }
    }
  }
}
