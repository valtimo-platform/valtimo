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

import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ParagraphModule} from '@valtimo/components';
import {PluginTranslatePipeModule} from '../../../../pipes';
import {NotificatiesApiManualAbonnement} from '../../models';
import {NOTIFICATIES_API_MANUAL_ABONNEMENT_TEST_IDS} from '../../../../constants';

@Component({
  standalone: true,
  selector: 'valtimo-notificaties-api-manual-abonnement',
  templateUrl: './notificaties-api-manual-abonnement.component.html',
  styleUrls: ['./notificaties-api-manual-abonnement.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ParagraphModule, PluginTranslatePipeModule],
})
export class NotificatiesApiManualAbonnementComponent {
  @Input() public manualAbonnement: NotificatiesApiManualAbonnement | null = null;
  @Input() public pluginId: string;
  protected readonly testIds = NOTIFICATIES_API_MANUAL_ABONNEMENT_TEST_IDS;
}
