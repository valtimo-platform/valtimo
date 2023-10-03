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

import {Component, EventEmitter, Output, ViewChild, ViewEncapsulation} from '@angular/core';
import {FormioBeforeSubmit, FormioForm} from '@formio/angular';
import {
  FormioComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ModalComponent,
  ValtimoFormioOptions,
} from '@valtimo/components';
import {ActivatedRoute, Router} from '@angular/router';
import {ProcessService} from '@valtimo/process';
import {DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {FormFlowService, FormSubmissionResult, ProcessLinkService} from '@valtimo/form-link';
import {NGXLogger} from 'ngx-logger';
import {noop, Observable} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {UserProviderService} from '@valtimo/security';

@Component({
  selector: 'valtimo-dossier-supporting-process-start-modal',
  templateUrl: './dossier-supporting-process-start-modal.component.html',
  styleUrls: ['./dossier-supporting-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierSupportingProcessStartModalComponent {
  public processDefinitionKey: string;
  public documentDefinitionName: string;
  public processName: string;
  public formDefinition: FormioForm;
  public formioSubmission: FormioSubmission;
  private processLinkId: string;
  public options: ValtimoFormioOptions;
  public submission: object;
  public processDefinitionId: string;
  public formFlowInstanceId: string;

  readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));

  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('supportingProcessStartModal', {static: false}) modal: ModalComponent;
  @Output() formSubmit = new EventEmitter();

  private documentId: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private processLinkService: ProcessLinkService,
    private documentService: DocumentService,
    private formFlowService: FormFlowService,
    private logger: NGXLogger,
    private readonly userProviderService: UserProviderService
  ) {}

  private loadProcessLink() {
    this.processLinkId = null;
    this.formDefinition = null;
    this.formFlowInstanceId = null;
    this.processService
      .getProcessDefinitionStartProcessLink(this.processDefinitionId, this.documentId, null)
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

  openModal(processDocumentDefinition: ProcessDocumentDefinition, documentId: string) {
    this.documentId = documentId;
    this.documentDefinitionName = processDocumentDefinition.id.documentDefinitionId.name;
    this.processDefinitionKey = processDocumentDefinition.id.processDefinitionKey;
    this.processDefinitionId = processDocumentDefinition.latestVersionId;
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
    this.processLinkService
      .submitForm(this.processLinkId, submission.data, this.documentId)
      .subscribe({
        next: (formSubmissionResult: FormSubmissionResult) => {
          this.formSubmitted();
        },
        error: errors => {
          this.form.showErrors(errors);
        },
      });
  }

  public formSubmitted() {
    this.modal.hide();
    this.formSubmit.emit();
  }

  public gotoProcessLinkScreen(): void {
    this.modal.hide();
    this.router.navigate(['process-links'], {queryParams: {process: this.processDefinitionKey}});
  }
}
