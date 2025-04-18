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
import {switchMap, take} from 'rxjs';
import {CaseDetailService} from '../../services';
import {GlobalNotificationService} from '@valtimo/layout';

@Component({
  selector: 'valtimo-case-management-connect-modal',
  templateUrl: './case-management-connect-modal.component.html',
  styleUrls: ['./case-management-connect-modal.component.scss'],
})
export class CaseManagementConnectModalComponent implements OnInit {
  @ViewChild('caseConnectModal') private readonly _modal: ModalComponent;
  @Output() public reloadProcessDocumentDefinitions = new EventEmitter<any>();

  public documentDefinition: DocumentDefinition | null = null;
  public processDefinitions: ProcessDefinition[];
  public newDocumentProcessDefinition: ProcessDefinition | null = null;
  public newDocumentProcessDefinitionInit = true;
  public newDocumentProcessDefinitionStartableByUser = false;
  public processDocumentDefinitionExists: any = {};

  constructor(
    private readonly documentService: DocumentService,
    private readonly caseDetailService: CaseDetailService,
    private readonly notificationService: GlobalNotificationService,
    private readonly processService: ProcessService,
    private readonly translateService: TranslateService
  ) {}

  public loadProcessDocumentDefinitions(): void {
    if (!this.documentDefinition) {
      return;
    }
    const {name, version} = this.documentDefinition.id;
    this.processDocumentDefinitionExists = {};
    this.documentService
      .findProcessDocumentDefinitionsByVersion(name, version)
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

  public openModal(document: DocumentDefinition): void {
    this.documentDefinition = document;
    this.newDocumentProcessDefinition = null;
    this.newDocumentProcessDefinitionInit = true;
    this.newDocumentProcessDefinitionStartableByUser = false;
    this.loadProcessDocumentDefinitions();
    this._modal.show();
  }

  public submit(): void {
    if (!this.documentDefinition || !this.newDocumentProcessDefinition) {
      return;
    }

    const request: ProcessDocumentDefinitionRequest = {
      canInitializeDocument: this.newDocumentProcessDefinitionInit,
      caseDefinitionKey: this.documentDefinition.id.name,
      caseDefinitionVersionTag: `${this.documentDefinition.id.version}`,
      processDefinitionKey: this.newDocumentProcessDefinition.key,
      startableByUser: this.newDocumentProcessDefinitionStartableByUser,
    };

    this.caseDetailService.selectedCaseDefinitionVersionTag$
      .pipe(
        switchMap((caseDefinitionVersionTag: string) =>
          this.documentService.createProcessDocumentDefinition({
            ...request,
            caseDefinitionVersionTag,
          })
        ),
        take(1)
      )
      .subscribe({
        next: () => {
          this.notificationService.showNotification({
            type: 'success',
            title: this.translateService.instant(
              'caseManagement.processLinkNotification.linkSuccess'
            ),
            duration: 5000,
          });
          this.reloadProcessDocumentDefinitions.emit();
        },
        error: () => {
          this.notificationService.showNotification({
            type: 'error',
            title: this.translateService.instant(
              'caseManagement.processLinkNotification.linkFailure'
            ),
            duration: 5000,
          });
        },
      });
  }
}
