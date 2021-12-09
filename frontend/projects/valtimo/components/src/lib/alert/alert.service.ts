/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {EventEmitter, Injectable} from '@angular/core';
import {NavigationStart, Router} from '@angular/router';
import {Observable, Subject} from 'rxjs';
import {Alert, AlertType} from '@valtimo/contract';

@Injectable({providedIn: 'root'})
export class AlertService {
  public confirmed: EventEmitter<any> = new EventEmitter();
  private subject = new Subject<Alert>();

  constructor(private router: Router) {
    // clear alert messages on route change unless 'keepAfterRouteChange' flag is true
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        // clear alert messages
        this.clear();
      }
    });
  }

  // enable subscribing to alerts observable
  onAlert(): Observable<Alert> {
    return this.subject.asObservable();
  }

  // convenience methods
  success(message: string, confirmations?: any, iconClass?: string) {
    this.alert(new Alert({message, type: AlertType.Success, confirmations, iconClass}));
  }

  error(message: string, confirmations?: any, iconClass?: string) {
    this.alert(new Alert({message, type: AlertType.Error, confirmations, iconClass}));
  }

  info(message: string, confirmations?: any, iconClass?: string) {
    this.alert(new Alert({message, type: AlertType.Info, confirmations, iconClass}));
  }

  warning(message: string, confirmations?: any, iconClass?: string) {
    this.alert(new Alert({message, type: AlertType.Warning, confirmations, iconClass}));
  }

  notification(message: string, confirmations?: any, iconClass?: string) {
    this.alert(new Alert({message, type: AlertType.Notification, confirmations, iconClass}));
  }

  modalNotification(message: string, confirmations?: any, iconClass?: string) {
    this.alert(new Alert({message, type: AlertType.ModalNotification, confirmations, iconClass}));
  }

  // main alert method
  alert(alert: Alert) {
    this.subject.next(alert);
  }

  // clear alerts
  clear() {
    this.subject.next(new Alert({}));
  }

  // emit confirm
  emitAlertConfirmEvent(alert: Alert) {
    this.confirmed.emit(alert);
  }

  getAlertConfirmChangeEmitter() {
    return this.confirmed;
  }
}
