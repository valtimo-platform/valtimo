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

@Injectable({
  providedIn: 'root',
})
export class GlobalNotificationService {
  private _notificationService: NotificationService | null = null;

  public setNotificationService(service: NotificationService): void {
    this._notificationService = service;
  }

  public getNotificationService(): NotificationService | null {
    return this._notificationService;
  }

  public showNotification(
    notificationObj: NotificationContent | ToastContent | ActionableContent,
    notificationComp: typeof Notification = Notification
  ): Notification {
    return this._notificationService?.showNotification(notificationObj, notificationComp);
  }

  public showToast(
    notificationObj: NotificationContent | ToastContent,
    notificationComp: typeof Toast = Toast
  ): Notification {
    return this._notificationService?.showToast(notificationObj, notificationComp);
  }

  public showActionable(
    notificationObj: ActionableContent,
    notificationComp: typeof ActionableNotification = ActionableNotification
  ): Notification {
    return this._notificationService?.showActionable(notificationObj, notificationComp);
  }

  public close(notificationRef: any): void {
    this._notificationService?.close(notificationRef);
  }

  public getSmartTimeout(notificationObj: any): number {
    return this._notificationService?.getSmartTimeout(notificationObj);
  }

  public getNotificationRefs(): ComponentRef<any>[] {
    return this._notificationService?.notificationRefs;
  }

  public getOnCloseEmitter(): EventEmitter<any> {
    return this._notificationService?.onClose;
  }

  public ngOnDestroy(): void {
    this._notificationService?.ngOnDestroy();
  }
}
