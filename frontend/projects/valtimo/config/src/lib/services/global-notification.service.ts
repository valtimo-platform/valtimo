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
import {ComponentRef, EventEmitter, Injectable} from '@angular/core';
import {
  ActionableContent,
  ActionableNotification,
  Notification,
  NotificationContent,
  NotificationService,
  Toast,
  ToastContent,
} from 'carbon-components-angular';
import {take} from 'rxjs';
import {getNotificationObject} from '../utils';

@Injectable({
  providedIn: 'root',
})
export class GlobalNotificationService {
  private _notificationService: NotificationService | null = null;
  private readonly _notificationQueue: (Notification & {id: string})[] = [];

  public setNotificationService(service: NotificationService): void {
    this._notificationService = service;
  }

  public getNotificationService(): NotificationService | null {
    return this._notificationService;
  }

  public showNotification(
    notificationObj: NotificationContent | ToastContent | ActionableContent,
    notificationComp: typeof Notification = Notification
  ): Notification | null {
    if (!this._notificationService) return null;

    return this.handleNotificationRef(
      this._notificationService?.showNotification(
        getNotificationObject(notificationObj),
        notificationComp
      )
    );
  }

  public showToast(
    notificationObj: NotificationContent | ToastContent,
    notificationComp: typeof Toast = Toast
  ): Notification | null {
    if (!this._notificationService) return null;

    return this.handleNotificationRef(
      this._notificationService?.showToast(getNotificationObject(notificationObj), notificationComp)
    );
  }

  public showActionable(
    notificationObj: ActionableContent,
    notificationComp: typeof ActionableNotification = ActionableNotification
  ): Notification | null {
    if (!this._notificationService) return null;

    return this.handleNotificationRef(
      this._notificationService?.showActionable(
        getNotificationObject(notificationObj),
        notificationComp
      )
    );
  }

  public close(notificationRef: any): void {
    notificationRef.close.emit();
  }

  public getSmartTimeout(notificationObj: any): number | null {
    if (!this._notificationService) return null;
    return this._notificationService?.getSmartTimeout(notificationObj);
  }

  public getNotificationRefs(): ComponentRef<any>[] | null {
    if (!this._notificationService) return null;
    return this._notificationService?.notificationRefs;
  }

  public getOnCloseEmitter(): EventEmitter<any> | null {
    if (!this._notificationService) return null;
    return this._notificationService?.onClose;
  }

  public ngOnDestroy(): void {
    this._notificationService?.ngOnDestroy();
    this._notificationQueue.splice(0, this._notificationQueue.length);
  }

  private handleNotificationRef(notificationRef: any): Notification | null {
    const notification = {
      ...notificationRef,
      id:
        notificationRef.toastID ??
        notificationRef.notificationID ??
        notificationRef.actionableNotificationID,
    };

    if (this._notificationQueue.length > 3) {
      this._notificationQueue.splice(0, 1);
      this.close(notificationRef);
    }

    this._notificationQueue.push(notification);
    setTimeout(() => this.removeNotificationInQueue(notification.id), 4000);

    notificationRef.close
      .pipe(take(1))
      .subscribe(() => this.removeNotificationInQueue(notification.id));

    return notificationRef;
  }

  private removeNotificationInQueue(id: string): void {
    const index = this._notificationQueue.findIndex(
      (notification: Notification & {id: string}) => notification.id === id
    );
    if (index === -1) return;

    this._notificationQueue.splice(index, 1);
  }
}
