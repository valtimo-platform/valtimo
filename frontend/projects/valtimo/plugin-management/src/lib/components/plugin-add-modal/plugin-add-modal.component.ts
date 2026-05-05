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
import {ExternalPluginService, PluginManagementStateService} from '../../services';
import {map, take} from 'rxjs/operators';
import {BehaviorSubject, Observable, Subject, Subscription} from 'rxjs';
import {PluginConfigurationData, PluginManagementService} from '@valtimo/plugin';
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
  @Input() open = false;

  @Output() closeModal: EventEmitter<boolean> = new EventEmitter();

  public readonly inputDisabled$ = this.stateService.inputDisabled$;
  public readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  public readonly configurationValid$ = new BehaviorSubject<boolean>(false);
  public readonly returnToFirstStepSubject$ = new Subject<boolean>();

  public readonly isExternalPlugin$: Observable<boolean> = this.selectedPluginDefinition$.pipe(
    map(def => !!def?.key?.startsWith('external:'))
  );

  public readonly externalForm = new FormGroup({
    title: new FormControl('', Validators.required),
    properties: new FormControl('{}'),
  });

  private externalFormSubscription: Subscription | undefined;

  constructor(
    private readonly stateService: PluginManagementStateService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly externalPluginService: ExternalPluginService,
    private readonly logger: NGXLogger
  ) {}

  public ngOnInit(): void {
    this.externalFormSubscription = this.externalForm.valueChanges.subscribe(() => {
      this.validateExternalForm();
    });
  }

  public ngOnDestroy(): void {
    this.externalFormSubscription?.unsubscribe();
  }

  public complete(): void {
    this.selectedPluginDefinition$.pipe(take(1)).subscribe(def => {
      if (def?.key?.startsWith('external:')) {
        this.saveExternalConfiguration(def.key);
      } else {
        this.stateService.save();
      }
    });
  }

  public hide(): void {
    this.closeModal.emit();

    setTimeout(() => {
      this.returnToFirstStep();
      this.stateService.enableInput();
      this.stateService.clear();
      this.externalForm.reset({title: '', properties: '{}'});
      this.configurationValid$.next(false);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public onValid(valid: boolean): void {
    this.configurationValid$.next(valid);
  }

  private validateExternalForm(): void {
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

  private saveExternalConfiguration(key: string): void {
    const definitionId = key.replace('external:', '');
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

    this.stateService.disableInput();

    this.externalPluginService
      .createConfiguration({definitionId, title, properties})
      .subscribe({
        next: () => {
          this.stateService.refresh();
          this.hide();
        },
        error: () => {
          this.logger.error('Something went wrong with saving the external plugin configuration.');
          this.stateService.enableInput();
        },
      });
  }

  private returnToFirstStep(): void {
    this.returnToFirstStepSubject$.next(true);
  }
}
