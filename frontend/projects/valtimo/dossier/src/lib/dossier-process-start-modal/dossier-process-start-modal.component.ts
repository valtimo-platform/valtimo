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

import {Component, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {DocumentService} from '@valtimo/document';
import {
  FormAssociation,
  FormioOptionsImpl,
  FormioSubmission,
  FormSubmissionResult,
  ProcessDocumentDefinition,
  ValtimoFormioOptions
} from '@valtimo/contract';
import {ActivatedRoute, Router} from '@angular/router';
import {ProcessService} from '@valtimo/process';
import {FormioComponent, ModalComponent} from '@valtimo/components';
import {FormioBeforeSubmit} from 'angular-formio/formio.common';
import {FormioForm} from 'angular-formio';
import {FormLinkService} from '@valtimo/form-link';
import {NGXLogger} from 'ngx-logger';
import {UserProviderService} from '@valtimo/security';

@Component({
  selector: 'valtimo-dossier-process-start-modal',
  templateUrl: './dossier-process-start-modal.component.html',
  styleUrls: ['./dossier-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class DossierProcessStartModalComponent implements OnInit {
  public processDefinitionKey: string;
  public documentDefinitionName: string;
  public processName: string;
  public formDefinition: FormioForm;
  public formioSubmission: FormioSubmission;
  private formAssociation: FormAssociation;
  public options: ValtimoFormioOptions;
  public isAdmin: boolean;
  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('processStartModal', {static: false}) modal: ModalComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private processService: ProcessService,
    private documentService: DocumentService,
    private formLinkService: FormLinkService,
    private userProviderService: UserProviderService,
    private logger: NGXLogger
  ) {

  }

  ngOnInit() {
    this.isUserAdmin();
  }

  private loadFormDefinition() {
    this.formDefinition = null;
    this.formLinkService.getStartEventFormDefinitionByProcessDefinitionKey(this.processDefinitionKey)
      .subscribe(formDefinition => {
        this.formAssociation = formDefinition.formAssociation;
        const className = this.formAssociation.formLink.className.split('.');
        const linkType = className[className.length - 1];
        switch (linkType) {
          case 'BpmnElementFormIdLink':
            this.formDefinition = formDefinition;
            this.modal.show();
            break;
          case 'BpmnElementUrlLink':
            const url = this.router.serializeUrl(
              this.router.createUrlTree([formDefinition.formAssociation.formLink.url])
            );
            window.open(url, '_blank');
            break;
          case 'BpmnElementAngularStateUrlLink':
            this.router.navigate([formDefinition.formAssociation.formLink.url]);
            break;
          default:
            this.logger.fatal('Unsupported class name');
        }
      }, errors => {
        this.modal.show();
      });
  }

  public gotoFormLinkScreen() {
    this.modal.hide();
    this.router.navigate(['form-links'], {queryParams: {process: this.processDefinitionKey}});
  }

  public get modalTitle() {
    return `Start - ${this.processName}`;
  }

  openModal(processDocumentDefinition: ProcessDocumentDefinition) {
    this.processDefinitionKey = processDocumentDefinition.id.processDefinitionKey;
    this.documentDefinitionName = processDocumentDefinition.id.documentDefinitionId.name;
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
    this.formLinkService.onSubmit(
      this.processDefinitionKey,
      this.formAssociation.formLink.id,
      submission.data
    ).subscribe((formSubmissionResult: FormSubmissionResult) => {
      this.modal.hide();
      this.router.navigate(['dossiers', this.documentDefinitionName, 'document', formSubmissionResult.documentId, 'summary']);
    }, errors => {
      this.form.showErrors(errors);
    });
  }

  public isUserAdmin() {
    this.userProviderService.getUserSubject().subscribe(
      (userIdentity) => {
        this.isAdmin = userIdentity.roles.includes('ROLE_ADMIN');
      },
      error => {
        this.logger.error('Failed to retrieve user identity', error);
        this.isAdmin = false;
      });
  }
}
