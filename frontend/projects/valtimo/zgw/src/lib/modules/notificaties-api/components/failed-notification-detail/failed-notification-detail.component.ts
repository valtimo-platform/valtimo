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
import {ButtonModule, ModalModule} from 'carbon-components-angular';
import {FailedNotification} from '../../models';
import moment from 'moment';

@Component({
  selector: 'valtimo-notificaties-api-failed-notification-detail',
  templateUrl: './failed-notification-detail.component.html',
  styleUrls: ['./failed-notification-detail.component.scss'],
  standalone: true,
  imports: [CommonModule, TranslateModule, ModalModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FailedNotificationDetailComponent {
  @Input() public open = false;
  @Input() public notification: FailedNotification | null = null;
  @Input() public retryInProgress = false;

  @Output() public readonly closeModalEvent = new EventEmitter<void>();
  @Output() public readonly retryEvent = new EventEmitter<void>();

  public onClose(): void {
    this.closeModalEvent.emit();
  }

  public onRetry(): void {
    if (!this.retryInProgress) this.retryEvent.emit();
  }

  public get formattedPayload(): string {
    if (!this.notification?.payload) return '';

    try {
      return JSON.stringify(JSON.parse(this.notification.payload), null, 2);
    } catch (error) {
      return this.notification.payload;
    }
  }

  public formatDateValue(value?: string | null): string {
    if (!value) return '-';

    try {
      return moment(value)
        .locale(localStorage.getItem('langKey') ?? 'nl')
        .format('DD-MM-YYYY, HH:mm:ss');
    } catch (error) {
      return value;
    }
  }
}
