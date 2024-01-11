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
import {Component, EventEmitter, OnInit, Output, ViewChild} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ModalComponent} from '@valtimo/components';
import {
  DocumentDefinition,
  DocumentService,
  ProcessDocumentDefinition,
  ProcessDocumentDefinitionRequest,
} from '@valtimo/document';
import {ProcessDefinition, ProcessService} from '@valtimo/process';
import {NotificationService} from 'carbon-components-angular';
import {take} from 'rxjs';

@Component({
  selector: 'valtimo-dossier-management-connect-modal',
  templateUrl: './dossier-management-connect-modal.component.html',
  styleUrls: ['./dossier-management-connect-modal.component.scss'],
  providers: [NotificationService],
})
export class DossierManagementConnectModalComponent implements OnInit {
  @ViewChild('dossierConnectModal') private readonly _modal: ModalComponent;
  @Output() public reloadProcessDocumentDefinitions = new EventEmitter<any>();

  public documentDefinition: DocumentDefinition | null = null;
  public processDefinitions: ProcessDefinition[];
  public newDocumentProcessDefinition: ProcessDefinition | null = null;
  public newDocumentProcessDefinitionInit = true;
  public newDocumentProcessDefinitionStartableByUser = false;
  public processDocumentDefinitionExists: any = {};

  constructor(
    private readonly translateService: TranslateService,
    private readonly processService: ProcessService,
    private readonly documentService: DocumentService,
    private readonly notificationService: NotificationService
  ) {}

  public loadProcessDocumentDefinitions(): void {
    this.processDocumentDefinitionExists = {};
    this.documentService
      .findProcessDocumentDefinitions(this.documentDefinition?.id.name ?? '')
      .subscribe((processDocumentDefinitions: ProcessDocumentDefinition[]) => {
        processDocumentDefinitions.forEach(
          (processDocumentDefinition: ProcessDocumentDefinition) => {
            this.processDocumentDefinitionExists[
              processDocumentDefinition.id.processDefinitionKey
            ] = true;
          }
        );
      });
  }

  public loadProcessDefinitions(): void {
    this.processService
      .getProcessDefinitions()
      .subscribe((processDefinitions: ProcessDefinition[]) => {
        this.processDefinitions = processDefinitions;
      });
  }

  public ngOnInit(): void {
    this.loadProcessDefinitions();
  }

  public openModal(dossier: DocumentDefinition): void {
    this.documentDefinition = dossier;
    this.newDocumentProcessDefinition = null;
    this.newDocumentProcessDefinitionInit = true;
    this.newDocumentProcessDefinitionStartableByUser = false;
    this.loadProcessDocumentDefinitions();
    this._modal.show();
  }

  public submit(): void {
    const request: ProcessDocumentDefinitionRequest = {
      canInitializeDocument: this.newDocumentProcessDefinitionInit,
      startableByUser: this.newDocumentProcessDefinitionStartableByUser,
      documentDefinitionName: this.documentDefinition?.id.name ?? '',
      processDefinitionKey: this.newDocumentProcessDefinition?.key ?? '',
    };

    this.documentService
      .createProcessDocumentDefinition(request)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'dossierManagement.processLinkNotification.linkSuccess'
            ),
            duration: 5000,
          });
          this.reloadProcessDocumentDefinitions.emit();
        },
        error: () => {
          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant(
              'dossierManagement.processLinkNotification.linkFailure'
            ),
            duration: 5000,
          });
        },
      });
  }
}
