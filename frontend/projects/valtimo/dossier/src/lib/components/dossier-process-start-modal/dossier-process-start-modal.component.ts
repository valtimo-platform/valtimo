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

import {Component, EventEmitter, OnInit, Output, ViewChild, ViewEncapsulation} from '@angular/core';
import {PermissionService} from '@valtimo/access-control';
import {DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {FormFlowService, FormSubmissionResult, ProcessLinkService} from '@valtimo/process-link';
import {ActivatedRoute, Router} from '@angular/router';
import {ProcessService} from '@valtimo/process';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ModalComponent,
  ValtimoFormioOptions,
} from '@valtimo/components';
import {FormioBeforeSubmit} from '@formio/angular/formio.common';
import {FormioForm} from '@formio/angular';
import {UserProviderService} from '@valtimo/security';
import {take} from 'rxjs/operators';
import {CAN_VIEW_CASE_PERMISSION, DOSSIER_DETAIL_PERMISSION_RESOURCE} from '../../permissions';
import {DossierListService, StartModalService} from '../../services';
import {ConfigService} from '@valtimo/config';

@Component({
  selector: 'valtimo-dossier-process-start-modal',
  templateUrl: './dossier-process-start-modal.component.html',
  styleUrls: ['./dossier-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierProcessStartModalComponent implements OnInit {
  public processDefinitionKey: string;
  public processDefinitionId: string;
  public documentDefinitionName: string;
  public processName: string;
  private _startEventName: string;
  private readonly _useStartEventNameAsStartFormTitle!: boolean;
  public formDefinition: FormioForm;
  public formFlowInstanceId: string;
  public formioSubmission: FormioSubmission;
  private processLinkId: string;
  public options: ValtimoFormioOptions;
  public isAdmin: boolean;
  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('processStartModal', {static: false}) modal: ModalComponent;
  @Output() formFlowComplete = new EventEmitter();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private documentService: DocumentService,
    private processLinkService: ProcessLinkService,
    private formFlowService: FormFlowService,
    private userProviderService: UserProviderService,
    private permissionService: PermissionService,
    private listService: DossierListService,
    private startModalService: StartModalService,
    private configService: ConfigService
  ) {
    this._useStartEventNameAsStartFormTitle =
      this.configService.config.featureToggles?.useStartEventNameAsStartFormTitle;
  }

  ngOnInit() {
    this.isUserAdmin();
  }

  private loadProcessLink() {
    this.processLinkId = null;
    this.formDefinition = null;
    this.formFlowInstanceId = null;
    if (this._useStartEventNameAsStartFormTitle) {
      this.processService.getProcessDefinitionXml(this.processDefinitionId).subscribe(result => {
        this._startEventName = this.startModalService.getStandardStartEventTitle(result.bpmn20Xml);
      });
    }
    this.processService
      .getProcessDefinitionStartProcessLink(
        this.processDefinitionId,
        null,
        this.documentDefinitionName
      )
      .pipe(take(1))
      .subscribe(startProcessResult => {
        if (startProcessResult) {
          switch (startProcessResult.type) {
            case 'form':
              this.formDefinition = startProcessResult.properties.prefilledForm;
              this.processLinkId = startProcessResult.processLinkId;
              break;
            case 'form-flow':
              this.formFlowInstanceId = startProcessResult.properties.formFlowInstanceId;
              break;
          }
        }
        this.modal.show();
      });
  }

  public gotoProcessLinkScreen(): void {
    this.modal.hide();
    this.router.navigate(['process-links'], {queryParams: {process: this.processDefinitionKey}});
  }

  public get modalTitle() {
    const fallbackTitle = `Start - ${this.processName}`;
    return this._useStartEventNameAsStartFormTitle
      ? this._startEventName || fallbackTitle
      : fallbackTitle;
  }

  openModal(processDocumentDefinition: ProcessDocumentDefinition) {
    this.processDefinitionKey = processDocumentDefinition.id.processDefinitionKey;
    this.processDefinitionId = processDocumentDefinition.latestVersionId;
    this.documentDefinitionName = processDocumentDefinition.id.documentDefinitionId.name;
    this.processName = processDocumentDefinition.processName;
    this.options = new FormioOptionsImpl();
    this.options.disableAlerts = true;
    const formioBeforeSubmit: FormioBeforeSubmit = function (submission, callback) {
      callback(null, submission);
    };
    this.options.setHooks(formioBeforeSubmit);
    this.loadProcessLink();
  }

  public onSubmit(submission: FormioSubmission) {
    this.formioSubmission = submission;

    this.processLinkService.submitForm(this.processLinkId, submission.data).subscribe({
      next: (formSubmissionResult: FormSubmissionResult) => {
        this.submitCompleted(formSubmissionResult);
      },
      error: errors => {
        this.form.showErrors(errors);
      },
    });
  }

  public formFlowSubmitted(): void {
    this.formFlowComplete.emit(null);
    this.modal.hide();
  }

  public isUserAdmin(): void {
    this.userProviderService.getUserSubject().subscribe(
      userIdentity => {
        this.isAdmin = userIdentity.roles.includes('ROLE_ADMIN');
      },
      error => {
        this.isAdmin = false;
      }
    );
  }

  private submitCompleted(formSubmissionResult: FormSubmissionResult): void {
    this.modal.hide();
    this.permissionService
      .requestPermission(CAN_VIEW_CASE_PERMISSION, {
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: formSubmissionResult.documentId,
      })
      .subscribe(canViewCase => {
        if (canViewCase) {
          this.router.navigate([
            'dossiers',
            this.documentDefinitionName,
            'document',
            formSubmissionResult.documentId,
          ]);
        } else {
          this.listService.forceRefresh();
        }
      });
  }
}
