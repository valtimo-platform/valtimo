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

import {Component, EventEmitter, OnDestroy, OnInit, Output} from '@angular/core';
import {
  PluginStateService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {combineLatest, Subscription} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {PluginConfigurationData} from '@valtimo/plugin';
import {PluginProcessLinkCreateDto, PluginProcessLinkUpdateDto} from '../../models';

@Component({
  selector: 'valtimo-plugin-action-configuration',
  templateUrl: './plugin-action-configuration.component.html',
  styleUrls: ['./plugin-action-configuration.component.scss'],
})
export class PluginActionConfigurationComponent implements OnInit, OnDestroy {
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PluginConfigurationData> =
    new EventEmitter<PluginConfigurationData>();

  public readonly pluginDefinitionKey$ = this.pluginStateService.pluginDefinitionKey$;
  public readonly functionKey$ = this.pluginStateService.functionKey$;
  public readonly save$ = this.pluginStateService.save$;
  public readonly saving$ = this.stateService.saving$;
  public readonly prefillConfiguration$ = this.stateService.selectedProcessLink$.pipe(
    map(processLink => (processLink ? processLink?.actionProperties : undefined))
  );

  private _subscriptions = new Subscription();

  constructor(
    private readonly stateService: ProcessLinkStateService,
    private readonly pluginStateService: PluginStateService,
    private readonly buttonService: ProcessLinkButtonService,
    private readonly stepService: ProcessLinkStepService,
    private readonly processLinkService: ProcessLinkService
  ) {}

  ngOnInit(): void {
    this.openBackButtonSubscription();
    this.openSaveButtonSubscription();
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  onValid(valid: boolean): void {
    if (valid) {
      this.buttonService.enableSaveButton();
    } else {
      this.buttonService.disableSaveButton();
    }
  }

  onConfiguration(configuration: PluginConfigurationData): void {
    this.stateService.startSaving();

    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink) {
        this.updateProcessLink(configuration);
      } else {
        this.saveNewProcessLink(configuration);
      }
    });
  }

  private updateProcessLink(configuration: PluginConfigurationData): void {
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      const updateProcessLinkRequest: PluginProcessLinkUpdateDto = {
        id: selectedProcessLink.id,
        pluginConfigurationId: selectedProcessLink.pluginConfigurationId,
        pluginActionDefinitionKey: selectedProcessLink.pluginActionDefinitionKey,
        actionProperties: configuration,
      };

      this.processLinkService.updateProcessLink(updateProcessLinkRequest).subscribe(
        () => {
          this.stateService.closeModal();
        },
        () => {
          this.stateService.stopSaving();
        }
      );
    });
  }

  private saveNewProcessLink(configuration: PluginConfigurationData): void {
    combineLatest([
      this.stateService.modalParams$,
      this.pluginStateService.selectedPluginConfiguration$,
      this.pluginStateService.selectedPluginFunction$,
      this.stateService.selectedProcessLinkTypeId$,
    ])
      .pipe(take(1))
      .subscribe(
        ([modalData, selectedConfiguration, selectedFunction, selectedProcessLinkTypeId]) => {
          const processLinkRequest: PluginProcessLinkCreateDto = {
            actionProperties: configuration,
            activityId: modalData?.element?.id,
            activityType: modalData?.element?.activityListenerType,
            pluginConfigurationId: selectedConfiguration.id,
            processDefinitionId: modalData?.processDefinitionId,
            pluginActionDefinitionKey: selectedFunction.key,
            processLinkType: selectedProcessLinkTypeId,
          };

          this.processLinkService.saveProcessLink(processLinkRequest).subscribe(
            response => {
              this.stateService.closeModal();
            },
            () => {
              this.stateService.stopSaving();
            }
          );
        }
      );
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$.subscribe(() => {
        this.stepService.setChoosePluginActionSteps();
      })
    );
  }

  private openSaveButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.saveButtonClick$.subscribe(() => {
        this.pluginStateService.save();
      })
    );
  }
}
