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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {take} from 'rxjs/operators';
import {BehaviorSubject, Observable} from 'rxjs';
import {
  PluginConfigurationData,
  PluginConfiguration,
  PluginManagementService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-plugin-edit-modal',
  templateUrl: './plugin-edit-modal.component.html',
  styleUrls: ['./plugin-edit-modal.component.scss'],
})
export class PluginEditModalComponent {
  @Input() open = false;

  @Output() closeModal: EventEmitter<boolean> = new EventEmitter();

  readonly inputDisabled$ = this.stateService.inputDisabled$;
  readonly selectedPluginConfiguration$: Observable<PluginConfiguration> =
    this.stateService.selectedPluginConfiguration$;
  readonly configurationValid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly stateService: PluginManagementStateService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly logger: NGXLogger
  ) {}

  save(): void {
    this.stateService.saveEdit();
  }

  delete(): void {
    this.stateService.delete();
    this.stateService.disableInput();

    this.stateService.selectedPluginConfiguration$
      .pipe(take(1))
      .subscribe(selectedPluginConfiguration => {
        this.pluginManagementService
          .deletePluginConfiguration(selectedPluginConfiguration.id)
          .subscribe(
            () => {
              this.stateService.refresh();
              this.hide();
            },
            () => {
              this.logger.error('Something went wrong with deleting the plugin configuration.');
              this.stateService.enableInput();
            }
          );
      });
  }

  public hide(): void {
    this.closeModal.emit();
    this.stateService.enableInput();
  }

  public onPluginValid(valid: boolean): void {
    this.configurationValid$.next(valid);
  }

  public onPluginConfiguration(configuration: PluginConfigurationData): void {
    this.stateService.disableInput();

    this.stateService.selectedPluginConfiguration$
      .pipe(take(1))
      .subscribe(selectedPluginConfiguration => {
        const configurationId = configuration.configurationId;
        const configurationTitle = configuration.configurationTitle;
        const configurationData = {...configuration};
        delete configurationData['configurationTitle'];

        this.pluginManagementService
          .updatePluginConfiguration(
            selectedPluginConfiguration.id,
            configurationId,
            configurationTitle,
            configurationData
          )
          .subscribe(
            () => {
              this.stateService.refresh();
              this.hide();
            },
            () => {
              this.logger.error('Something went wrong with updating the plugin configuration.');
              this.stateService.enableInput();
            }
          );
      });
  }
}
