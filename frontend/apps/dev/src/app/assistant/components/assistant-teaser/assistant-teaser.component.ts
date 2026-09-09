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
import {Close16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {IconModule, IconService} from 'carbon-components-angular';
import {ASSISTANT_TEST_IDS} from '../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-assistant-teaser',
  templateUrl: './assistant-teaser.component.html',
  styleUrls: ['./assistant-teaser.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, IconModule],
})
export class AssistantTeaserComponent {
  @Input() public messageKey!: string;

  @Output() public closeEvent = new EventEmitter<void>();
  @Output() public openEvent = new EventEmitter<void>();

  protected readonly testIds = ASSISTANT_TEST_IDS;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Close16]);
  }
}
