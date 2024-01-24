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
import {
  FormAssociation,
  FormFlowService,
  FormLinkService,
  FormSubmissionResult,
  ProcessLinkService,
} from '@valtimo/form-link';
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
  private formAssociation: FormAssociation;
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
    private formLinkService: FormLinkService,
    private formFlowService: FormFlowService,
    private logger: NGXLogger,
    private readonly userProviderService: UserProviderService
  ) {}

  private loadProcessLink() {
    this.formAssociation = null;
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
          this.modal.show();
        } else {
          // backwards compatibility for form associations
          this.formLinkService
            .getStartEventFormDefinitionByProcessDefinitionKey(
              this.processDefinitionKey,
              this.documentId
            )
            .pipe(take(1))
            .subscribe({
              next: formDefinitionWithFormAssociation =>
                this.openFormAssociation(formDefinitionWithFormAssociation),
              error: error => {
                this.modal.show();
              },
            });
        }
      });
  }

  private openFormAssociation(formDefinitionWithFormAssociation: any) {
    this.formAssociation = formDefinitionWithFormAssociation.formAssociation;
    const className = this.formAssociation.formLink.className.split('.');
    const linkType = className[className.length - 1];
    switch (linkType) {
      case 'BpmnElementFormIdLink':
        this.formDefinition = formDefinitionWithFormAssociation;
        this.documentService.getDocument(this.documentId).subscribe(
          document => {
            this.submission = {
              data: document.content,
            };
          },
          () => noop()
        );
        this.modal.show();
        break;
      case 'BpmnElementFormFlowIdLink':
        this.formFlowService
          .createInstanceForNewProcess(this.processDefinitionKey, {
            documentId: this.documentId,
            documentDefinitionName: null,
          })
          .subscribe(result => (this.formFlowInstanceId = result.formFlowInstanceId));
        this.modal.show();
        break;
      case 'BpmnElementUrlLink':
        const url = this.router.serializeUrl(
          this.router.createUrlTree([this.formAssociation.formLink.url])
        );
        window.open(url, '_blank');
        break;
      case 'BpmnElementAngularStateUrlLink':
        this.route.params.pipe(take(1)).subscribe(params => {
          const documentId = params?.documentId;

          this.router.navigate([this.formAssociation.formLink.url], {
            state: {...(documentId && {documentId})},
          });
        });
        break;
      default:
        this.logger.fatal('Unsupported class name');
    }
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
    if (this.processLinkId) {
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
    } else {
      this.formLinkService
        .onSubmit(
          this.processDefinitionKey,
          this.formAssociation.formLink.id,
          submission.data,
          this.documentId
        )
        .subscribe(
          (formSubmissionResult: FormSubmissionResult) => {
            this.formSubmitted();
          },
          errors => {
            this.form.showErrors(errors);
          }
        );
    }
  }

  public formSubmitted() {
    this.modal.hide();
    this.formSubmit.emit();
  }

  public gotoFormLinkScreen() {
    this.modal.hide();
    this.router.navigate(['form-links'], {queryParams: {process: this.processDefinitionKey}});
  }
}
