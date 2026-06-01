/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

import {Component, EventEmitter, Input, Output, ViewChild} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {map, take} from 'rxjs/operators';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import {
  ExternalPluginGrantedEndpointEntry,
  ExternalPluginManagementEndpoint,
  ExternalPluginService,
  isExternalPluginKey,
  PluginConfigurationData,
  PluginManagementService,
} from '@valtimo/plugin';
import {PluginExternalConfigureComponent} from '../plugin-external-configure/plugin-external-configure.component';
import {NGXLogger} from 'ngx-logger';
import {CARBON_CONSTANTS} from '@valtimo/components';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-add-modal',
  templateUrl: './plugin-add-modal.component.html',
  styleUrls: ['./plugin-add-modal.component.scss'],
})
export class PluginAddModalComponent {
  @Input() public open = false;

  @Output() public closeModal = new EventEmitter<boolean>();

  public readonly inputDisabled$ = this._stateService.inputDisabled$;
  public readonly selectedPluginDefinition$ = this._stateService.selectedPluginDefinition$;
  public readonly configurationValid$ = new BehaviorSubject<boolean>(false);
  public readonly returnToFirstStepSubject$ = new Subject<boolean>();

  public readonly isExternalPlugin$: Observable<boolean> = this.selectedPluginDefinition$.pipe(
    map(def => isExternalPluginKey(def?.key))
  );

  public readonly managementEndpoints$ = new BehaviorSubject<Array<ExternalPluginManagementEndpoint>>([]);
  public readonly hasPermissionsStep$ = this.managementEndpoints$.pipe(
    map(endpoints => endpoints.length > 0)
  );
  public readonly permissionsValid$ = new BehaviorSubject<boolean>(false);

  @ViewChild(PluginExternalConfigureComponent)
  private _externalConfigureComponent: PluginExternalConfigureComponent | undefined;

  constructor(
    private readonly _stateService: PluginManagementStateService,
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _logger: NGXLogger
  ) {}

  public complete(): void {
    this._stateService.save();
  }

  public hide(): void {
    this.closeModal.emit();

    setTimeout(() => {
      this._returnToFirstStep();
      this._stateService.enableInput();
      this._stateService.clear();
      this.configurationValid$.next(false);
      this.managementEndpoints$.next([]);
      this.permissionsValid$.next(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onValid(valid: boolean): void {
    this.configurationValid$.next(valid);
  }

  public onConfiguration(configuration: PluginConfigurationData): void {
    const pluginConfiguration = {...configuration};
    delete pluginConfiguration['configurationId'];
    delete pluginConfiguration['configurationTitle'];

    this._stateService.disableInput();

    this._stateService.selectedPluginDefinition$.pipe(take(1)).subscribe(selectedDefinition => {
      this._pluginManagementService
        .savePluginConfiguration({
          id: configuration.configurationId,
          definitionKey: selectedDefinition.key,
          title: configuration.configurationTitle,
          properties: pluginConfiguration,
        })
        .subscribe({
          next: () => {
            this._stateService.refresh();
            this.hide();
          },
          error: () => {
            this._logger.error('Something went wrong with saving the plugin configuration.');
            this._stateService.enableInput();
          },
        });
    });
  }

  public onManagementEndpointsResolved(endpoints: Array<ExternalPluginManagementEndpoint>): void {
    this.managementEndpoints$.next(endpoints);
    this.permissionsValid$.next(endpoints.length === 0);
  }

  public onPermissionsValid(valid: boolean): void {
    this.permissionsValid$.next(valid);
  }

  public onGrantedEndpointsChange(endpoints: Array<ExternalPluginGrantedEndpointEntry>): void {
    this._externalConfigureComponent?.setGrantedEndpoints(endpoints);
  }

  public onExternalSave(event: {definitionId: string; title: string; properties: Record<string, unknown>; grantedEndpoints: Array<ExternalPluginGrantedEndpointEntry>}): void {
    this._stateService.disableInput();

    this._externalPluginService
      .createConfiguration({
        definitionId: event.definitionId,
        title: event.title,
        properties: event.properties,
        grantedEndpoints: event.grantedEndpoints,
      })
      .subscribe({
        next: () => {
          this._stateService.refresh();
          this.hide();
        },
        error: () => {
          this._logger.error('Something went wrong with saving the external plugin configuration.');
          this._stateService.enableInput();
        },
      });
  }

  private _returnToFirstStep(): void {
    this.returnToFirstStepSubject$.next(true);
  }
}
