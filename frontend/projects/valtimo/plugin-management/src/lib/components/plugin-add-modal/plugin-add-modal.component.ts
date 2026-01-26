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
import {BehaviorSubject, Subject} from 'rxjs';
import {PluginConfigurationData, PluginManagementService} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {CARBON_CONSTANTS} from '@valtimo/components';
import { TEST_IDS } from '@valtimo/shared';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-add-modal',
  templateUrl: './plugin-add-modal.component.html',
  styleUrls: ['./plugin-add-modal.component.scss'],
})
export class PluginAddModalComponent {
  readonly TEST_IDS = TEST_IDS;

  @Input() open = false;

  @Output() closeModal: EventEmitter<boolean> = new EventEmitter();

  public readonly inputDisabled$ = this.stateService.inputDisabled$;
  public readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  public readonly configurationValid$ = new BehaviorSubject<boolean>(false);
  public readonly returnToFirstStepSubject$ = new Subject<boolean>();

  constructor(
    private readonly stateService: PluginManagementStateService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly logger: NGXLogger
  ) {}

  public complete(): void {
    this.stateService.save();
  }

  public hide(): void {
    this.closeModal.emit();

    setTimeout(() => {
      this.returnToFirstStep();
      this.stateService.enableInput();
      this.stateService.clear();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onValid(valid: boolean): void {
    this.configurationValid$.next(valid);
  }

  public onConfiguration(configuration: PluginConfigurationData): void {
    const pluginConfiguration = {...configuration};
    delete pluginConfiguration['configurationId'];
    delete pluginConfiguration['configurationTitle'];

    this.stateService.disableInput();

    this.stateService.selectedPluginDefinition$.pipe(take(1)).subscribe(selectedDefinition => {
      this.pluginManagementService
        .savePluginConfiguration({
          id: configuration.configurationId,
          definitionKey: selectedDefinition.key,
          title: configuration.configurationTitle,
          properties: pluginConfiguration,
        })
        .subscribe({
          next: () => {
            this.stateService.refresh();
            this.hide();
          },
          error: () => {
            this.logger.error('Something went wrong with saving the plugin configuration.');
            this.stateService.enableInput();
          },
        });
    });
  }

  private returnToFirstStep(): void {
    this.returnToFirstStepSubject$.next(true);
  }
}
