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

import {Component, EventEmitter, Output, ViewChild, ViewEncapsulation} from '@angular/core';
import {FormioBeforeSubmit, FormioForm} from '@formio/angular';
import {
  FormioComponent,
  ModalComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ValtimoFormioOptions,
} from '@valtimo/components';
import {ActivatedRoute, Router} from '@angular/router';
import {ProcessService} from '@valtimo/process';
import {DocumentService, ProcessDocumentDefinition} from '@valtimo/document';
import {FormLinkService} from '@valtimo/form-link';
import {NGXLogger} from 'ngx-logger';
import {FormAssociation, FormSubmissionResult} from '@valtimo/form-link';
import {noop} from 'rxjs';
import {take} from 'rxjs/operators';

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
  public options: ValtimoFormioOptions;
  public submission: object;

  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('supportingProcessStartModal', {static: false}) modal: ModalComponent;
  private documentId: string;
  @Output() formSubmit = new EventEmitter();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private documentService: DocumentService,
    private formLinkService: FormLinkService,
    private logger: NGXLogger
  ) {}

  private loadFormDefinition() {
    this.formDefinition = null;
    this.formLinkService
      .getStartEventFormDefinitionByProcessDefinitionKey(this.processDefinitionKey)
      .subscribe(
        formDefinition => {
          this.formAssociation = formDefinition.formAssociation;
          const className = this.formAssociation.formLink.className.split('.');
          const linkType = className[className.length - 1];
          switch (linkType) {
            case 'BpmnElementFormIdLink':
              this.formDefinition = formDefinition;
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
            case 'BpmnElementUrlLink':
              const url = this.router.serializeUrl(
                this.router.createUrlTree([formDefinition.formAssociation.formLink.url])
              );
              window.open(url, '_blank');
              break;
            case 'BpmnElementAngularStateUrlLink':
              this.route.params.pipe(take(1)).subscribe(params => {
                const documentId = params?.documentId;

                this.router.navigate([formDefinition.formAssociation.formLink.url], {
                  state: {...(documentId && {documentId})},
                });
              });
              break;
            default:
              this.logger.fatal('Unsupported class name');
          }
        },
        errors => {
          this.modal.show();
        }
      );
  }

  public get modalTitle() {
    return `Start - ${this.processName}`;
  }

  openModal(processDocumentDefinition: ProcessDocumentDefinition, documentId: string) {
    this.documentId = documentId;
    this.documentDefinitionName = processDocumentDefinition.id.documentDefinitionId.name;
    this.processDefinitionKey = processDocumentDefinition.id.processDefinitionKey;
    this.processName = processDocumentDefinition.processName;
    this.options = new FormioOptionsImpl();
    this.options.disableAlerts = true;
    const formioBeforeSubmit: FormioBeforeSubmit = function (submission, callback) {
      callback(null, submission);
    };
    this.options.setHooks(formioBeforeSubmit);
    this.loadFormDefinition();
  }

  public onSubmit(submission: FormioSubmission) {
    this.formioSubmission = submission;
    this.formLinkService
      .onSubmit(
        this.processDefinitionKey,
        this.formAssociation.formLink.id,
        submission.data,
        this.documentId
      )
      .subscribe(
        (formSubmissionResult: FormSubmissionResult) => {
          this.modal.hide();
          this.formSubmit.emit();
        },
        errors => {
          this.form.showErrors(errors);
        }
      );
  }

  public gotoFormLinkScreen() {
    this.modal.hide();
    this.router.navigate(['form-links'], {queryParams: {process: this.processDefinitionKey}});
  }
}
