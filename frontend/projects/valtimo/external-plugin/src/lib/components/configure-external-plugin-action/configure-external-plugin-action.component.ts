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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {ProcessLinkButtonService, ProcessLinkStateService} from '@valtimo/process-link';
import {ButtonModule, InputModule} from 'carbon-components-angular';
import {combineLatest, filter, Subscription, switchMap, take, withLatestFrom} from 'rxjs';
import {EXTERNAL_PLUGIN_PROCESS_LINK_TEST_IDS} from '../../constants';
import {ExternalPluginConfiguration} from '../../models';
import {ExternalPluginService} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-configure-external-plugin-action',
  templateUrl: './configure-external-plugin-action.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TranslateModule, ReactiveFormsModule, InputModule, ButtonModule],
})
export class ConfigureExternalPluginActionComponent implements OnInit, OnDestroy {
  public configurations: Array<ExternalPluginConfiguration> = [];

  public readonly form: FormGroup = this.fb.group({
    externalPluginConfigurationId: this.fb.control<string | null>(null, Validators.required),
    actionKey: this.fb.control('', Validators.required),
    actionPropertiesJson: this.fb.control('{}', Validators.required),
  });

  public propertiesError: string | null = null;

  protected readonly testIds = EXTERNAL_PLUGIN_PROCESS_LINK_TEST_IDS;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly fb: FormBuilder,
    private readonly externalPluginService: ExternalPluginService,
    private readonly stateService: ProcessLinkStateService,
    private readonly buttonService: ProcessLinkButtonService
  ) {}

  public ngOnInit(): void {
    this.externalPluginService.getConfigurations().subscribe(configurations => {
      this.configurations = configurations;
      this.refreshSaveButtonState();
    });

    this.prefillFromSelectedProcessLink();

    this.form.statusChanges.subscribe(() => this.refreshSaveButtonState());

    this._subscriptions.add(
      this.buttonService.backButtonClick$
        .pipe(
          withLatestFrom(this.stateService.isEditing$),
          filter(([, isEditing]) => !isEditing)
        )
        .subscribe(() => this.stateService.setInitial())
    );

    this._subscriptions.add(this.buttonService.saveButtonClick$.subscribe(() => this.save()));
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  private prefillFromSelectedProcessLink(): void {
    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(link => {
      if (!link) return;
      const anyLink = link as unknown as {
        externalPluginConfigurationId?: string;
        actionKey?: string;
        actionProperties?: Record<string, unknown>;
      };
      this.form.patchValue({
        externalPluginConfigurationId: anyLink.externalPluginConfigurationId ?? null,
        actionKey: anyLink.actionKey ?? '',
        actionPropertiesJson: JSON.stringify(anyLink.actionProperties ?? {}, null, 2),
      });
    });
  }

  private refreshSaveButtonState(): void {
    if (this.form.valid) {
      this.buttonService.enableSaveButton();
    } else {
      this.buttonService.disableSaveButton();
    }
  }

  private save(): void {
    if (this.form.invalid) return;
    let actionProperties: Record<string, unknown>;
    try {
      actionProperties = JSON.parse(this.form.value.actionPropertiesJson ?? '{}');
    } catch {
      this.propertiesError = 'externalPlugin.processLink.actionPropertiesInvalidJson';
      return;
    }
    this.propertiesError = null;
    this.stateService.startSaving();

    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      if (selectedProcessLink) {
        this.stateService.sendProcessLinkUpdateEvent({
          id: selectedProcessLink.id,
          processLinkType: 'external_plugin',
          externalPluginConfigurationId: this.form.value.externalPluginConfigurationId,
          actionKey: this.form.value.actionKey,
          actionProperties,
        } as never);
      } else {
        combineLatest([
          this.stateService.modalParams$,
          this.stateService.selectedProcessLinkTypeId$,
        ])
          .pipe(
            take(1),
            switchMap(([modalParams, processLinkTypeId]) => {
              this.stateService.sendProcessLinkCreateEvent({
                processDefinitionId: modalParams.processDefinitionId,
                activityId: modalParams.element.id,
                activityType: modalParams.element.activityListenerType || '',
                processLinkType: processLinkTypeId || 'external_plugin',
                externalPluginConfigurationId: this.form.value.externalPluginConfigurationId,
                actionKey: this.form.value.actionKey,
                actionProperties,
              } as never);
              return [];
            })
          )
          .subscribe({
            next: () => this.stateService.closeModal(),
            error: () => this.stateService.stopSaving(),
          });
      }
    });
  }
}
