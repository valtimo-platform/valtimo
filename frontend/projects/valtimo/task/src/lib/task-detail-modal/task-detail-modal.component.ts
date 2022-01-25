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
import {Router} from '@angular/router';
import {FormioComponent, ModalComponent} from '@valtimo/components';
import {FormAssociation, FormioSubmission, FormSubmissionResult, Task} from '@valtimo/contract';
import {FormLinkService} from '@valtimo/form-link';
import {FormioForm} from 'angular-formio';
import * as momentImported from 'moment';
import {NGXLogger} from 'ngx-logger';
import {ToastrService} from 'ngx-toastr';
import {FormioOptionsImpl, ValtimoFormioOptions} from '@valtimo/contract';

const moment = momentImported;
moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-task-detail-modal',
  templateUrl: './task-detail-modal.component.html',
  styleUrls: ['./task-detail-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class TaskDetailModalComponent {
  public task: Task | null = null;
  public formDefinition: FormioForm;
  public page: any = null;
  public formioOptions: ValtimoFormioOptions;

  @ViewChild('form') form: FormioComponent;
  @ViewChild('taskDetailModal') modal: ModalComponent;
  @Output() formSubmit = new EventEmitter();
  @Output() assignmentOfTaskChanged = new EventEmitter();
  private formAssociation: FormAssociation;
  public errorMessage: String = null;

  constructor(
    private toastr: ToastrService,
    private formLinkService: FormLinkService,
    private router: Router,
    private logger: NGXLogger
  ) {
    this.formioOptions = new FormioOptionsImpl();
    this.formioOptions.disableAlerts = true;
  }

  resetFormDefinition() {
    // reset formDefinition in order to reload form-io component
    this.formDefinition = null;
  }

  openTaskDetails(task: Task) {
    this.resetFormDefinition();
    this.task = task;
    this.page = {
      title: task.name,
      subtitle: `Created ${moment(task.created).fromNow()}`,
    };
    this.formLinkService
      .getPreFilledFormDefinitionByFormLinkId(
        task.processDefinitionKey,
        task.businessKey,
        task.taskDefinitionKey,
        task.id // taskInstanceId
      )
      .subscribe(
        formDefinition => {
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
        },
        errors => {
          if (errors?.error?.detail) {
            this.errorMessage = errors.error.detail;
          }
          this.modal.show();
        }
      );
  }

  public gotoFormLinkScreen() {
    this.modal.hide();
    this.router.navigate(['form-links']);
  }

  public onSubmit(submission: FormioSubmission) {
    this.formLinkService
      .onSubmit(
        this.task.processDefinitionKey,
        this.formAssociation.formLink.id,
        submission.data,
        this.task.businessKey,
        this.task.id
      )
      .subscribe(
        (formSubmissionResult: FormSubmissionResult) => {
          this.toastr.success(this.task.name + ' has successfully been completed');
          this.modal.hide();
          this.task = null;
          this.formSubmit.emit();
        },
        errors => {
          this.form.showErrors(errors);
        }
      );
  }
}
