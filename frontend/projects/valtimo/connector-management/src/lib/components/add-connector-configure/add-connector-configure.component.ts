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

import {Component, Input} from '@angular/core';
import {ConnectorProperties, ConnectorType} from '@valtimo/config';
import {take} from 'rxjs/operators';
import {AlertService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {ConnectorManagementService} from '../../services/connector-management/connector-management.service';
import {ConnectorManagementStateService} from '../../services/connector-management-state/connector-management-state.service';

/**
 * @deprecated Use the new plugin framework
 */
@Component({
  selector: 'valtimo-add-connector-configure',
  templateUrl: './add-connector-configure.component.html',
  styleUrls: ['./add-connector-configure.component.scss'],
})
export class AddConnectorConfigureComponent {
  @Input() showSaveButton = true;

  readonly selectedConnector$ = this.stateService.selectedConnector$;
  readonly disabled$ = this.stateService.inputDisabled$;
  readonly connectorTypes$ = this.stateService.connectorTypes$;

  constructor(
    private readonly connectorManagementService: ConnectorManagementService,
    private readonly stateService: ConnectorManagementStateService,
    private readonly alertService: AlertService,
    private readonly translateService: TranslateService
  ) {}

  selectConnector(connectorType: ConnectorType): void {
    this.stateService.setSelectedConnectorType(connectorType);
  }

  onSave(event: {properties: ConnectorProperties; name: string}): void {
    this.stateService.disableInput();

    this.selectedConnector$.pipe(take(1)).subscribe(selectedConnectorType => {
      this.connectorManagementService
        .createConnectorInstance({
          name: event.name,
          typeId: selectedConnectorType.id,
          connectorProperties: event.properties,
        })
        .subscribe(
          () => {
            this.alertService.success(
              this.translateService.instant('connectorManagement.messages.addSuccess')
            );
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
