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
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Component} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {BehaviorSubject} from 'rxjs';
import {finalize} from 'rxjs/operators';
import {NotificationTestService} from './notification-test.service';
import {GlobalNotificationService} from '@valtimo/shared';

@Component({
  selector: 'app-notification-test',
  templateUrl: './notification-test.component.html',
  styleUrls: ['./notification-test.component.scss'],
  standalone: false,
})
export class NotificationTestComponent {
  private readonly successTemplate = `{
  "kanaal": "objecten",
  "hoofdObject": "https://zaken-api.vng.cloud/api/v1/zaken/ddc6d192",
  "resource": "status",
  "resourceUrl": "https://zaken-api.vng.cloud/api/v1/statussen/44fdcebf",
  "actie": "create",
  "aanmaakdatum": "2019-03-27T10:59:13Z",
  "kenmerken": {
    "bronorganisatie": "224557609",
    "zaaktype": "https://catalogi-api.vng.cloud/api/v1/zaaktypen/53c5c164",
    "vertrouwelijkheidaanduiding": "openbaar",
    "test-success": "true"
  }
}`;
  private readonly failureTemplate = `{
  "kanaal": "objecten",
  "hoofdObject": "https://zaken-api.vng.cloud/api/v1/zaken/ddc6d192",
  "resource": "status",
  "resourceUrl": "https://zaken-api.vng.cloud/api/v1/statussen/44fdcebf",
  "actie": "create",
  "aanmaakdatum": "2019-03-27T10:59:13Z",
  "kenmerken": {
    "bronorganisatie": "224557609",
    "zaaktype": "https://catalogi-api.vng.cloud/api/v1/zaaktypen/53c5c164",
    "vertrouwelijkheidaanduiding": "openbaar",
    "test-success": "false"
  }
}`;

  readonly form = this.formBuilder.group({
    message: ['', [Validators.required]],
  });

  readonly sending$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly notificationTestService: NotificationTestService,
    private readonly globalNotificationService: GlobalNotificationService
  ) {}

  applySuccessTemplate(): void {
    this.form.patchValue({message: this.successTemplate});
  }

  applyFailureTemplate(): void {
    this.form.patchValue({message: this.failureTemplate});
  }

  onSubmit(): void {
    if (this.form.invalid || this.sending$.value) {
      this.form.markAllAsTouched();
      return;
    }

    const message = this.form.value.message;
    this.sending$.next(true);

    this.notificationTestService
      .sendNotification(message)
      .pipe(finalize(() => this.sending$.next(false)))
      .subscribe({
        next: () => {
          this.globalNotificationService.showToast({
            title: 'Notification was sent.',
            type: 'success',
          });
        },
        error: () => {
          this.globalNotificationService.showToast({
            title: 'Unable to send notification.',
            type: 'error',
          });
        },
      });
  }
}
