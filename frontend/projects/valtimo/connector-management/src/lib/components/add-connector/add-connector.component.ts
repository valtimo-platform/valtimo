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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {ConnectorProperties, ConnectorType} from '@valtimo/contract';
import {take} from 'rxjs/operators';
import {AlertService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

@Component({
  selector: 'valtimo-add-connector',
  templateUrl: './add-connector.component.html',
  styleUrls: ['./add-connector.component.scss']
})
export class AddConnectorComponent implements OnInit, OnDestroy {

  readonly connectorTypes$: Observable<Array<ConnectorType>> = this.connectorManagementService.getConnectorTypes();

  readonly selectedConnector$ = new BehaviorSubject<ConnectorType>(undefined);

  readonly disabled$!: Observable<boolean>;

  private refreshSubscription!: Subscription;

  constructor(
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly stateService: ConnectorManagementStateService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
  ) {
    this.disabled$ = this.stateService.inputDisabled$;
  }

  ngOnInit(): void {
    this.refreshSubscription = combineLatest([this.stateService.showModal$, this.stateService.refresh$])
      .subscribe(() => {
        this.goBack();
      });
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  selectConnector(connectorType: ConnectorType): void {
    this.selectedConnector$.next(connectorType);
  }

  goBack(): void {
    this.selectedConnector$.next(undefined);
  }

  onSave(event: {properties: ConnectorProperties, name: string}): void {
    this.selectedConnector$.pipe(take(1)).subscribe((selectedConnectorType) => {
      this.connectorManagementService.createConnectorInstance({
        name: event.name,
        typeId: selectedConnectorType.id,
        connectorProperties: event.properties
      }).subscribe(
        () => {
          this.alertService.success(this.translateService.instant('connectorManagement.messages.addSuccess'));
          this.stateService.hideModal();
          this.stateService.enableInput();
          this.stateService.refresh();
        },
        () => {
          this.stateService.enableInput();
        }
      );
    });
  }
}
