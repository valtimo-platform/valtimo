/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {UrlTree} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ModalButtonType, ModalService} from 'carbon-components-angular';
import {Observable, Subject} from 'rxjs';

export class PendingChangesComponent {
  public pendingChanges = false;

  constructor(
    protected readonly modalService: ModalService,
    protected readonly translateService: TranslateService
  ) {}

  public canDeactivate():
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    if (!this.pendingChanges) {
      return true;
    }

    const deactivateSubject = new Subject<boolean>();

    this.modalService.show({
      title: this.translateService.instant('interface.pendingChanges.title'),
      content: this.translateService.instant('interface.pendingChanges.content'),
      buttons: [
        {
          text: this.translateService.instant('interface.cancel'),
          type: ModalButtonType.secondary,
          click: () => {
            deactivateSubject.next(false);
          },
        },
        {
          text: this.translateService.instant('interface.confirm'),
          type: ModalButtonType.primary,
          click: () => {
            deactivateSubject.next(true);
          },
        },
      ],
    });

    return deactivateSubject;
  }
}
