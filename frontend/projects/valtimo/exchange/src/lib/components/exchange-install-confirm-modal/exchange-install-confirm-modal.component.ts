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
  computed,
  EventEmitter,
  input,
  Output,
} from '@angular/core';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ValtimoCdsModalDirective} from '@valtimo/components';
import {
  ButtonModule,
  ModalModule,
  NotificationContent,
  NotificationModule,
  TagModule,
} from 'carbon-components-angular';
import {EXCHANGE_INSTALL_CONFIRM_MODAL_TEST_IDS} from '../../constants';
import {ExchangeArtifact, ExchangeDependencyStatus} from '../../models';

@Component({
  standalone: true,
  selector: 'valtimo-exchange-install-confirm-modal',
  templateUrl: './exchange-install-confirm-modal.component.html',
  styleUrls: ['./exchange-install-confirm-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    NotificationModule,
    TagModule,
    ValtimoCdsModalDirective,
  ],
})
export class ExchangeInstallConfirmModalComponent {
  protected readonly testIds = EXCHANGE_INSTALL_CONFIRM_MODAL_TEST_IDS;

  public readonly open = input<boolean>(false);
  public readonly artifact = input<ExchangeArtifact | null>(null);
  public readonly dependencies = input<Array<ExchangeDependencyStatus>>([]);

  @Output() public confirmEvent = new EventEmitter<void>();
  @Output() public cancelEvent = new EventEmitter<void>();

  public readonly $hasMissingBuildingBlocks = computed(() =>
    this.dependencies().some(
      status => status.dependency.type === 'BUILDING_BLOCK' && status.installed === false
    )
  );

  public readonly $compatibilityNotification = computed<NotificationContent | null>(() => {
    const artifact = this.artifact();
    if (artifact?.compatibility !== 'NEWER') return null;

    return this.warning(
      this.translateService.instant('exchange.confirm.compatibilityWarning', {
        valtimoVersion: artifact.valtimoVersion,
        runningValtimoVersion: artifact.runningValtimoVersion,
      })
    );
  });

  public readonly $missingNotification = computed<NotificationContent | null>(() =>
    this.$hasMissingBuildingBlocks()
      ? this.warning(this.translateService.instant('exchange.confirm.missingBuildingBlocksWarning'))
      : null
  );

  constructor(private readonly translateService: TranslateService) {}

  private warning(message: string): NotificationContent {
    return {
      type: 'warning',
      title: this.translateService.instant('interface.warning'),
      message,
      showClose: false,
      lowContrast: true,
    };
  }
}
