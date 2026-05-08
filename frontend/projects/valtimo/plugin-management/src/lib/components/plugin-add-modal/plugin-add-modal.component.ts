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

import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {map, take} from 'rxjs/operators';
import {BehaviorSubject, Observable, Subject, Subscription} from 'rxjs';
import {
  ExternalPluginService,
  extractExternalDefinitionId,
  isExternalPluginKey,
  PluginConfigurationData,
  PluginManagementService,
} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';
import {CARBON_CONSTANTS} from '@valtimo/components';
import {FormControl, FormGroup, Validators} from '@angular/forms';

@Component({
  standalone: false,
  selector: 'valtimo-plugin-add-modal',
  templateUrl: './plugin-add-modal.component.html',
  styleUrls: ['./plugin-add-modal.component.scss'],
})
export class PluginAddModalComponent implements OnInit, OnDestroy {
  @Input() public open = false;

  @Output() public closeModal = new EventEmitter<boolean>();

  public readonly inputDisabled$ = this._stateService.inputDisabled$;
  public readonly selectedPluginDefinition$ = this._stateService.selectedPluginDefinition$;
  public readonly configurationValid$ = new BehaviorSubject<boolean>(false);
  public readonly returnToFirstStepSubject$ = new Subject<boolean>();

  public readonly isExternalPlugin$: Observable<boolean> = this.selectedPluginDefinition$.pipe(
    map(def => isExternalPluginKey(def?.key))
  );

  public readonly externalForm = new FormGroup({
    title: new FormControl('', Validators.required),
    properties: new FormControl('{}'),
  });

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly _stateService: PluginManagementStateService,
    private readonly _pluginManagementService: PluginManagementService,
    private readonly _externalPluginService: ExternalPluginService,
    private readonly _logger: NGXLogger
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.externalForm.valueChanges.subscribe(() => {
        this._validateExternalForm();
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public complete(): void {
    this.selectedPluginDefinition$.pipe(take(1)).subscribe(def => {
      if (isExternalPluginKey(def?.key)) {
        this._saveExternalConfiguration(def.key);
      } else {
        this._stateService.save();
      }
    });
  }

  public hide(): void {
    this.closeModal.emit();

    setTimeout(() => {
      this._returnToFirstStep();
      this._stateService.enableInput();
      this._stateService.clear();
      this.externalForm.reset({title: '', properties: '{}'});
      this.configurationValid$.next(false);
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

  private _validateExternalForm(): void {
    const titleValid = !!this.externalForm.value.title?.trim();
    let jsonValid = true;
    const props = this.externalForm.value.properties?.trim();
    if (props) {
      try {
        JSON.parse(props);
      } catch {
        jsonValid = false;
      }
    }
    this.configurationValid$.next(titleValid && jsonValid);
  }

  private _saveExternalConfiguration(key: string): void {
    const definitionId = extractExternalDefinitionId(key);
    const title = this.externalForm.value.title?.trim() ?? '';
    let properties: Record<string, unknown> = {};
    const propsStr = this.externalForm.value.properties?.trim();
    if (propsStr) {
      try {
        properties = JSON.parse(propsStr);
      } catch {
        return;
      }
    }

    this._stateService.disableInput();

    this._externalPluginService
      .createConfiguration({definitionId, title, properties})
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
