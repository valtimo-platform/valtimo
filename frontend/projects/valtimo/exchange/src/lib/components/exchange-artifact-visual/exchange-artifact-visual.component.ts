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

import {NgClass} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
import {EXCHANGE_CATALOG_TEST_IDS} from '../../constants';
import {httpUrlOrNull, monogramColorIndex, monogramInitials} from '../../utils';

@Component({
  standalone: true,
  selector: 'valtimo-exchange-artifact-visual',
  templateUrl: './exchange-artifact-visual.component.html',
  styleUrls: ['./exchange-artifact-visual.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
})
export class ExchangeArtifactVisualComponent {
  protected readonly testIds = EXCHANGE_CATALOG_TEST_IDS;

  public readonly logo = input<string | null>(null);
  public readonly title = input<string>('');

  protected readonly $failed = signal<boolean>(false);

  protected readonly $src = computed(() => (this.$failed() ? null : httpUrlOrNull(this.logo())));
  protected readonly $initials = computed(() => monogramInitials(this.title()));
  protected readonly $colorIndex = computed(() => monogramColorIndex(this.title()));

  protected onError(): void {
    this.$failed.set(true);
  }
}
