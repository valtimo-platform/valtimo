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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {take} from 'rxjs/operators';
import {BehaviorSubject, Observable} from 'rxjs';
import {
  PluginConfiguration,
  PluginConfigurationData,
  PluginManagementService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-edit-modal',
  templateUrl: './plugin-edit-modal.component.html',
  styleUrls: ['./plugin-edit-modal.component.scss'],
})
export class PluginEditModalComponent {
  @Input() public readonly open = false;
  @Input() public readonly saveNewConfiguration = false;

  @Output() closeModal: EventEmitter<boolean> = new EventEmitter();
  @Output() deleteEvent: EventEmitter<{configurationId: string; configurationTitle: string}> =
    new EventEmitter();

  public readonly inputDisabled$ = this.stateService.inputDisabled$;
  public readonly selectedPluginConfiguration$: Observable<PluginConfiguration> =
    this.stateService.selectedPluginConfiguration$;
  public readonly configurationValid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly stateService: PluginManagementStateService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly logger: NGXLogger
  ) {}

  public save(): void {
    this.stateService.saveEdit();
  }

  /**
   * Bubble the delete request up to the parent so the shared usage pre-check +
   * destructive-confirmation flow runs in one place (mirrors how the external edit modal works).
   * The parent closes this modal as part of that flow.
   */
  public delete(): void {
    this.stateService.selectedPluginConfiguration$
      .pipe(take(1))
      .subscribe(selectedPluginConfiguration => {
        this.deleteEvent.emit({
          configurationId: selectedPluginConfiguration.id,
          configurationTitle: selectedPluginConfiguration.title ?? '',
        });
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

    if (this.saveNewConfiguration) {
      this.saveNewPluginConfiguration(configuration);
      return;
    }

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
          .subscribe({
            next: () => {
              this.stateService.refresh();
              this.hide();
            },
            error: () => {
              this.logger.error('Something went wrong with updating the plugin configuration.');
              this.stateService.enableInput();
            },
          });
      });
  }

  private saveNewPluginConfiguration(configuration: PluginConfigurationData): void {
    this.stateService.selectedPluginConfiguration$
      .pipe(take(1))
      .subscribe(selectedPluginConfiguration => {
        const duplicatedConfiguration = {...selectedPluginConfiguration, properties: configuration};

        duplicatedConfiguration.title = duplicatedConfiguration.properties.configurationTitle;

        delete duplicatedConfiguration.properties.configurationTitle;
        delete duplicatedConfiguration.properties.configurationId;

        this.pluginManagementService.savePluginConfiguration(duplicatedConfiguration).subscribe({
          next: () => {
            this.stateService.refresh();
            this.hide();
          },
          error: () => {
            this.logger.error(
              'Something went wrong with saving the duplicated plugin configuration.'
            );
            this.stateService.enableInput();
          },
        });
      });
  }
}
