/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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

import {Component, ViewChild} from '@angular/core';
import {BehaviorSubject, combineLatest, Subject} from 'rxjs';
import {ModalParams, SaveProcessLinkRequest, UpdateProcessLinkRequest} from '../../models';
import {ModalComponent, ModalService} from '@valtimo/user-interface';
import {ProcessLinkStateService} from '../../services/process-link-state.service';
import {take} from 'rxjs/operators';
import {PluginConfigurationData} from '@valtimo/plugin';
import {ProcessLinkService} from '../../services';
import {NGXLogger} from 'ngx-logger';

@Component({
  selector: 'valtimo-process-link',
  templateUrl: './process-link.component.html',
  styleUrls: ['./process-link.component.scss'],
})
export class ProcessLinkComponent {
  @ViewChild('createProcessLink') createProcessLinkModal: ModalComponent;
  @ViewChild('editProcessLink') editProcessLinkModal: ModalComponent;

  readonly pluginDefinitionKey$ = this.stateService.pluginDefinitionKey$;
  readonly functionKey$ = this.stateService.functionKey$;
  readonly returnToFirstStepSubject$ = new Subject<boolean>();
  readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  readonly selectedPluginConfiguration$ = this.stateService.selectedPluginConfiguration$;
  readonly selectedPluginFunction$ = this.stateService.selectedPluginFunction$;
  readonly inputDisabled$ = this.stateService.inputDisabled$;
  readonly isCreateModal$ = this.stateService.isCreateModal$;
  readonly isEditModal$ = this.stateService.isEditModal$;
  readonly selectedProcessLink$ = this.stateService.selectedProcessLink$;
  readonly functionConfigurationValid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly modalService: ModalService,
    private readonly stateService: ProcessLinkStateService,
    private readonly processLinkService: ProcessLinkService,
    private readonly logger: NGXLogger
  ) {}

  complete(): void {
    this.stateService.save();
  }

  completeModify(): void {
    this.stateService.saveModify();
  }

  hide(): void {
    this.modalService.closeModal(() => {
      this.returnToFirstStepSubject$.next(true);
      this.stateService.clear();
      this.stateService.enableInput();
    });
  }

  unlink(): void {
    this.stateService.disableInput();

    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      this.processLinkService.deleteProcessLink(selectedProcessLink.id).subscribe(
        response => {
          this.hide();
        },
        () => {
          this.logger.error('Something went wrong while deleting the process link.');
          this.stateService.enableInput();
        }
      );
    });
  }

  openModal(params: ModalParams): void {
    this.processLinkService
      .getProcessLink({
        processDefinitionId: params.processDefinitionId,
        activityId: params?.element?.id,
      })
      .subscribe(
        processLinks => {
          if (processLinks?.length > 0) {
            this.stateService.selectProcessLink(processLinks[0]);
            this.openEditModal(params);
          } else {
            this.openCreateModal(params);
          }
        },
        () => {
          this.openCreateModal(params);
        }
      );
  }

  onValid(valid: boolean): void {
    this.functionConfigurationValid$.next(valid);
  }

  onConfiguration(configuration: PluginConfigurationData): void {
    this.stateService.disableInput();

    combineLatest([
      this.modalService.modalData$,
      this.stateService.selectedPluginConfiguration$,
      this.stateService.selectedPluginFunction$,
    ])
      .pipe(take(1))
      .subscribe(([modalData, selectedConfiguration, selectedFunction]) => {
        let activityType = modalData?.element?.type;
        if (activityType === 'bpmn:UserTask') {
          activityType += ':create';
        } else {
          activityType += ':start';
        }
        const processLinkRequest: SaveProcessLinkRequest = {
          actionProperties: configuration,
          activityId: modalData?.element?.id,
          activityType,
          pluginConfigurationId: selectedConfiguration.id,
          processDefinitionId: modalData?.processDefinitionId,
          pluginActionDefinitionKey: selectedFunction.key,
        };

        this.processLinkService.saveProcessLink(processLinkRequest).subscribe(
          response => {
            this.hide();
          },
          () => {
            this.logger.error('Something went wrong with saving the process link.');
            this.stateService.enableInput();
          }
        );
      });
  }

  onModifyConfiguration(configuration: PluginConfigurationData): void {
    this.stateService.disableInput();

    this.stateService.selectedProcessLink$.pipe(take(1)).subscribe(selectedProcessLink => {
      const updateProcessLinkRequest: UpdateProcessLinkRequest = {
        id: selectedProcessLink.id,
        pluginConfigurationId: selectedProcessLink.pluginConfigurationId,
        pluginActionDefinitionKey: selectedProcessLink.pluginActionDefinitionKey,
        actionProperties: configuration,
      };

      this.processLinkService.updateProcessLink(updateProcessLinkRequest).subscribe(
        response => {
          this.hide();
        },
        () => {
          this.logger.error('Something went wrong with updating the process link.');
          this.stateService.enableInput();
        }
      );
    });
  }

  private openCreateModal(params: ModalParams): void {
    this.stateService.setModalType('create');
    this.modalService.openModal(this.createProcessLinkModal, params);
  }

  private openEditModal(params: ModalParams): void {
    this.stateService.setModalType('edit');
    this.modalService.openModal(this.editProcessLinkModal, params);
  }
}
