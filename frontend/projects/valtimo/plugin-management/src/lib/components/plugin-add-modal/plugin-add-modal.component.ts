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

import {Component, OnInit, ViewChild} from '@angular/core';
import {PluginManagementStateService} from '../../services';
import {take} from 'rxjs/operators';
import {VModalComponent, ModalService} from '@valtimo/components';
import {BehaviorSubject, Subject, Subscription} from 'rxjs';
import {PluginConfigurationData, PluginManagementService} from '@valtimo/plugin';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-plugin-add-modal',
  templateUrl: './plugin-add-modal.component.html',
  styleUrls: ['./plugin-add-modal.component.scss'],
})
export class PluginAddModalComponent implements OnInit {
  @ViewChild('pluginAddModal') pluginAddModal: VModalComponent;

  readonly inputDisabled$ = this.stateService.inputDisabled$;
  readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  readonly configurationValid$ = new BehaviorSubject<boolean>(false);
  readonly returnToFirstStepSubject$ = new Subject<boolean>();

  private showSubscription!: Subscription;
  private hideSubscription!: Subscription;

  constructor(
    private readonly stateService: PluginManagementStateService,
    private readonly modalService: ModalService,
    private readonly pluginManagementService: PluginManagementService,
    private readonly logger: NGXLogger
  ) {}

  ngOnInit(): void {
    this.openShowSubscription();
    this.openHideSubscription();
  }

  complete(): void {
    this.stateService.save();
  }

  delete(): void {
    this.stateService.delete();
  }

  hide(): void {
    this.stateService.disableInput();
    this.modalService.closeModal(() => {
      this.returnToFirstStep();
      this.stateService.enableInput();
      this.stateService.clear();
    });
  }

  onValid(valid: boolean): void {
    this.configurationValid$.next(valid);
  }

  onConfiguration(configuration: PluginConfigurationData): void {
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
          },
        });
    });
  }

  private openShowSubscription(): void {
    this.showSubscription = this.stateService.showModal$.subscribe(modalType => {
      if (modalType === 'add') {
        this.show();
      }
    });
  }

  private openHideSubscription(): void {
    this.hideSubscription = this.stateService.hideModal$.subscribe(() => {
      this.hide();
    });
  }

  private returnToFirstStep(): void {
    this.returnToFirstStepSubject$.next(true);
  }

  private show(): void {
    this.modalService.openModal(this.pluginAddModal);
  }
}
