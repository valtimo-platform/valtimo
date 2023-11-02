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
import {ComponentRef} from '@angular/core';
import {UrlTree} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ModalButtonType, ModalService} from 'carbon-components-angular';
import {Observable, Subject} from 'rxjs';

export class PendingChangesComponent {
  protected pendingChanges = false;
  private _activeModal: ComponentRef<any> | null = null;

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

    if (!!this._activeModal) {
      return false;
    }

    this._activeModal = this.modalService.show({
      title: this.translateService.instant('interface.pendingChanges.title'),
      content: this.translateService.instant('interface.pendingChanges.content'),
      showCloseButton: false,
      buttons: [
        {
          text: this.translateService.instant('interface.cancel'),
          type: ModalButtonType.secondary,
          click: () => {
            this.onCancelRedirect();
            deactivateSubject.next(false);
            this._activeModal = null;
          },
        },
        {
          text: this.translateService.instant('interface.confirm'),
          type: ModalButtonType.primary,
          click: () => {
            this.onConfirmRedirect();
            deactivateSubject.next(true);
            this._activeModal = null;
          },
        },
      ],
      close: () => false,
    });

    return deactivateSubject;
  }

  protected onCancelRedirect(): void {}

  protected onConfirmRedirect(): void {}
}
