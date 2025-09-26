/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {Component, OnInit} from '@angular/core';
import {NotificationService} from 'carbon-components-angular';
import {GlobalNotificationService} from '../services';

@Component({
  selector: 'valtimo-global-notification',
  template: ``,
  styles: `
    ::ng-deep.cds--toast-notification {
      width: 100%;
    }
  `,
  providers: [NotificationService],
  standalone: true,
  imports: [CommonModule],
})
export class GlobalNotificationComponent implements OnInit {
  constructor(
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly notificationService: NotificationService
  ) {}

  public ngOnInit(): void {
    this.globalNotificationService.setNotificationService(this.notificationService);
  }
}
