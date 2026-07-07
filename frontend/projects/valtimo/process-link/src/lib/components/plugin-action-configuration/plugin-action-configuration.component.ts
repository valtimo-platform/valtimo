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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {
  PluginStateService,
  ProcessLinkButtonService,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '../../services';
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {filter, map, take, withLatestFrom} from 'rxjs/operators';
import {PluginConfiguration, PluginConfigurationData} from '@valtimo/plugin';
import {
  PluginConfigurationReferenceType,
  PluginProcessLinkCreateDto,
  PluginProcessLinkUpdateDto,
  ProcessLink,
} from '../../models';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-action-configuration',
  templateUrl: './plugin-action-configuration.component.html',
  styleUrls: ['./plugin-action-configuration.component.scss'],
})
export class PluginActionConfigurationComponent implements OnInit, OnDestroy {
  @Input() selectedPluginConfiguration$: Observable<PluginConfiguration>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PluginConfigurationData> =
    new EventEmitter<PluginConfigurationData>();

  public readonly pluginDefinitionKey$ = this.pluginStateService.pluginDefinitionKey$;
  public readonly functionKey$ = this.pluginStateService.functionKey$;
  public readonly save$ = this.pluginStateService.save$;
  public readonly saving$ = this.stateService.saving$;

  private readonly _prefillConfigurationSubject$ = new BehaviorSubject<
    ProcessLink['actionProperties'] | null
  >(null);
  // Only prefill if the action key hasn't changed from what's saved in the process link
  private readonly _prefillConfiguration$ = combineLatest([
    this.stateService.selectedProcessLink$,
    this.pluginStateService.selectedPluginFunction$,
  ]).pipe(
    map(([processLink, selectedFunction]) => {
      if (!processLink) return undefined;
      // Only prefill if the action hasn't been changed
      const savedActionKey = processLink.pluginActionDefinitionKey;
      const currentActionKey = selectedFunction?.key;
      if (currentActionKey && savedActionKey !== currentActionKey) {
        return undefined; // Action changed, don't prefill old configuration
      }
      return processLink.actionProperties;
    })
  );
  public readonly prefillConfiguration$ = combineLatest([
    this._prefillConfigurationSubject$,
    this._prefillConfiguration$,
  ]).pipe(
    map(
      ([prefillConfigurationSubjectValue, prefillConfiguration]) =>
        prefillConfigurationSubjectValue || prefillConfiguration
    )
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
    if (valid) this.buttonService.enableSaveButton();
    else this.buttonService.disableSaveButton();
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

  public onImportConfiguration(configuration: ProcessLink['actionProperties']): void {
    this._prefillConfigurationSubject$.next(configuration);
  }

  private updateProcessLink(configuration: PluginConfigurationData): void {
    combineLatest([
      this.stateService.selectedProcessLink$,
      this.pluginStateService.selectedPluginFunction$,
    ])
      .pipe(take(1))
      .subscribe(([selectedProcessLink, selectedFunction]) => {
        const inferredReferenceType: PluginConfigurationReferenceType =
          (selectedProcessLink.referenceType as PluginConfigurationReferenceType) ||
          (selectedProcessLink.pluginDefinitionKey ? 'BUILDING_BLOCK' : 'FIXED');
        const pluginConfigurationId =
          inferredReferenceType === 'FIXED'
            ? (selectedProcessLink.pluginConfigurationId ?? '')
            : undefined;
        // Use the currently selected function key (user may have changed it)
        const actionKey =
          selectedFunction?.key ?? selectedProcessLink.pluginActionDefinitionKey ?? '';
        const updateProcessLinkRequest: PluginProcessLinkUpdateDto = {
          id: selectedProcessLink.id,
          pluginConfigurationId,
          pluginActionDefinitionKey: actionKey,
          actionProperties: configuration,
          activityId: selectedProcessLink.activityId,
          referenceType: inferredReferenceType,
          pluginDefinitionKey: selectedProcessLink.pluginDefinitionKey,
        };

        this.stateService.sendProcessLinkUpdateEvent(updateProcessLinkRequest);
      });
  }

  private saveNewProcessLink(configuration: PluginConfigurationData): void {
    combineLatest([
      this.stateService.modalParams$,
      this.pluginStateService.selectedPluginConfiguration$,
      this.pluginStateService.selectedPluginFunction$,
      this.stateService.selectedProcessLinkTypeId$,
      this.pluginStateService.selectedPluginDefinition$,
    ])
      .pipe(take(1))
      .subscribe(
        ([
          modalData,
          selectedConfiguration,
          selectedFunction,
          selectedProcessLinkTypeId,
          selectedDefinition,
        ]) => {
          const isBuildingBlock = this.stateService.isBuildingBlockContext();
          const pluginDefinitionKey =
            selectedConfiguration?.pluginDefinition?.key || selectedDefinition?.key;

          if (!selectedFunction || (isBuildingBlock && !pluginDefinitionKey)) {
            this.stateService.stopSaving();
            return;
          }

          if (!isBuildingBlock && !selectedConfiguration) {
            this.stateService.stopSaving();
            return;
          }

          const referenceType: PluginConfigurationReferenceType = isBuildingBlock
            ? 'BUILDING_BLOCK'
            : 'FIXED';

          const processLinkRequest: PluginProcessLinkCreateDto = {
            actionProperties: configuration,
            activityId: modalData?.element?.id,
            activityType: modalData?.element?.activityListenerType ?? '',
            pluginConfigurationId: isBuildingBlock ? undefined : selectedConfiguration?.id,
            processDefinitionId: modalData?.processDefinitionId,
            pluginActionDefinitionKey: selectedFunction.key,
            processLinkType: selectedProcessLinkTypeId,
            referenceType,
            pluginDefinitionKey,
          };

          this.stateService.sendProcessLinkCreateEvent(processLinkRequest);
        }
      );
  }

  private openBackButtonSubscription(): void {
    this._subscriptions.add(
      this.buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this.stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => {
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
