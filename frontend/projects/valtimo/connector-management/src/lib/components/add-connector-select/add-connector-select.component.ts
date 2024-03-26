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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {combineLatest, Subscription} from 'rxjs';
import {ConnectorType} from '@valtimo/config';
import {TranslateService} from '@ngx-translate/core';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-add-connector-select',
  templateUrl: './add-connector-select.component.html',
  styleUrls: ['./add-connector-select.component.scss'],
})
export class AddConnectorSelectComponent implements OnInit, OnDestroy {
  readonly selectedConnector$ = this.stateService.selectedConnector$;
  readonly disabled$ = this.stateService.inputDisabled$;
  readonly connectorTypes$ = this.stateService.connectorTypes$;

  private refreshSubscription!: Subscription;

  constructor(
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly stateService: ConnectorManagementStateService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.openRefreshSubscription();
    this.getConnectorTypes();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  selectConnector(connectorType: ConnectorType): void {
    this.stateService.setSelectedConnectorType(connectorType);
  }

  deselectConnector(): void {
    this.stateService.clearSelectedConnector();
  }

  private getConnectorTypes(): void {
    this.connectorManagementService.getConnectorTypes().subscribe(connectorTypes => {
      this.stateService.setConnectorTypes(connectorTypes);
    });
  }

  private openRefreshSubscription(): void {
    this.refreshSubscription = combineLatest([
      this.stateService.showModal$,
      this.stateService.refresh$,
    ]).subscribe(() => {
      this.deselectConnector();
    });
  }
}
