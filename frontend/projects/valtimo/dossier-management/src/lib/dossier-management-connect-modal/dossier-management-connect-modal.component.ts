/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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
import {DocumentService} from '@valtimo/document';
import {
  ProcessDocumentDefinitionRequest,
  ProcessDocumentDefinition,
  DocumentDefinition,
  ProcessDefinition,
} from '@valtimo/contract';
import {ProcessService} from '@valtimo/process';
import {ToastrService} from 'ngx-toastr';
import {ModalComponent} from '@valtimo/components';

@Component({
  selector: 'valtimo-dossier-management-connect-modal',
  templateUrl: './dossier-management-connect-modal.component.html',
  styleUrls: ['./dossier-management-connect-modal.component.scss'],
})
export class DossierManagementConnectModalComponent implements OnInit {
  public documentDefinition: DocumentDefinition | null = null;
  public processDefinitions: ProcessDefinition[];
  public newDocumentProcessDefinition: ProcessDefinition | null = null;
  public newDocumentProcessDefinitionInit = true;
  public newDocumentProcessDefinitionStartableByUser = false;
  public processDocumentDefinitionExists: any = {};
  @Output() public reloadProcessDocumentDefinitions = new EventEmitter<any>();
  @ViewChild('dossierConnectModal') modal: ModalComponent;

  constructor(
    private processService: ProcessService,
    private documentService: DocumentService,
    private toasterService: ToastrService
  ) {}

  loadProcessDocumentDefinitions() {
    this.processDocumentDefinitionExists = {};
    this.documentService
      .findProcessDocumentDefinitions(this.documentDefinition.id.name)
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

  loadProcessDefinitions() {
    this.processService
      .getProcessDefinitions()
      .subscribe((processDefinitions: ProcessDefinition[]) => {
        this.processDefinitions = processDefinitions;
      });
  }

  ngOnInit() {
    this.loadProcessDefinitions();
  }

  openModal(dossier: DocumentDefinition) {
    this.documentDefinition = dossier;
    this.newDocumentProcessDefinition = null;
    this.newDocumentProcessDefinitionInit = true;
    this.newDocumentProcessDefinitionStartableByUser = false;
    this.loadProcessDocumentDefinitions();
    this.modal.show();
  }

  submit() {
    const request: ProcessDocumentDefinitionRequest = {
      canInitializeDocument: this.newDocumentProcessDefinitionInit,
      startableByUser: this.newDocumentProcessDefinitionStartableByUser,
      documentDefinitionName: this.documentDefinition.id.name,
      processDefinitionKey: this.newDocumentProcessDefinition.key,
    };
    this.documentService.createProcessDocumentDefinition(request).subscribe(
      () => {
        this.toasterService.success('Successfully added new process document definition');
        this.reloadProcessDocumentDefinitions.emit();
      },
      err => {
        this.toasterService.error('Failed to add new process document definition');
      }
    );
  }
}
