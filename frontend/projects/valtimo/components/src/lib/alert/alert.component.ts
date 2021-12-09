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

import {AfterContentInit, Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {Alert, AlertType} from '@valtimo/contract';
import {AlertService} from './alert.service';

declare var $;

@Component({
    selector: 'valtimo-alert',
    templateUrl: './alert.component.html',
    styleUrls: ['./alert.component.css']
})
export class AlertComponent implements OnInit, AfterContentInit, OnDestroy {
    alerts: Alert[] = [];
    subscription: Subscription;
    autoCloseInMS: number;

    constructor(
        private alertService: AlertService
    ) {
        this.autoCloseInMS = 5000;
    }

    ngOnInit() {
    }

    ngAfterContentInit() {
        this.subscription = this.alertService.onAlert()
            .subscribe(alert => {

                if (!alert.message) {
                    // clear alerts when an empty alert is received
                    this.alerts = [];
                    return;
                }

                // set empty array when an empty alert confirmations is received
                if (!alert.confirmations) {
                    alert.confirmations = [];
                }

                // add alert to array if not exist
                const alertExist = this.alerts.filter(x => x.message === alert.message);
                if (alertExist.length === 0) {
                    this.alerts.push(alert);
                }

                if (this.inModal(alert)) {
                    setTimeout(() => {
                        this.openModal();
                    }, 300);
                }

                // auto close except alert confirmations not empty
                if (this.autoCloseInMS > 0 && alert.confirmations.length === 0) {
                    setTimeout(() => {
                        this.removeAlert(alert);
                    }, this.autoCloseInMS);
                }
            });
    }

    closeModal() {
        $('#modalNotification').modal('hide');
    }

    openModal() {
        $('#modalNotification').modal('show');
    }

    alertConfirm(alert: Alert, confirm: any) {
        alert.confirm = confirm;
        this.alertService.emitAlertConfirmEvent(alert);
        this.removeAlert(alert);
    }

    ngOnDestroy() {
        // unsubscribe to avoid memory leaks
        this.subscription.unsubscribe();
    }

    removeAlert(alert: Alert) {
        if (this.inModal(alert)) {
            this.closeModal();
        }
        // remove specified alert from array
        this.alerts = this.alerts.filter(x => x.message !== alert.message);
    }

    inModal(alert: Alert) {
        if (!alert) {
            return;
        }

        // return true based on AlertType.ModalNotification
        switch (alert.type) {
            case AlertType.ModalNotification:
                return true;
            default:
                return false;
        }
    }

    cssClass(alert: Alert) {
        if (!alert) {
            return;
        }

        // return css class based on alert type
        switch (alert.type) {
            case AlertType.Success:
                return 'alert alert-success';
            case AlertType.Error:
                return 'alert alert-danger';
            case AlertType.Info:
                return 'alert alert-info';
            case AlertType.Warning:
                return 'alert alert-warning';
            case AlertType.Notification:
                return 'alert alert-light';
            case AlertType.ModalNotification:
                return 'alert alert-light';
        }
    }

    cssIconClass(alert: Alert) {
        if (!alert) {
            return;
        }

        // return css class based on alert type
        switch (alert.type) {
            case AlertType.Success:
                return 'mdi mdi-check';
            case AlertType.Error:
                return 'mdi mdi-close-circle-o';
            case AlertType.Info:
                return 'mdi mdi-info-outline';
            case AlertType.Warning:
                return 'mdi mdi-alert-triangle';
            case AlertType.Notification:
                return 'mdi mdi-notifications';
            case AlertType.ModalNotification:
                return 'mdi mdi-notifications';
        }
    }

}
