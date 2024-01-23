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

import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {ProcessInstanceTask, ProcessService} from '@valtimo/process';
import {ActivatedRoute, ParamMap, Router} from '@angular/router';
import {Document, DocumentService, ProcessDocumentInstance} from '@valtimo/document';
import {SummaryFormService, TaskDetailModalComponent, TaskService} from '@valtimo/task';
import {FormService} from '@valtimo/form';
import {FormioOptionsImpl, ValtimoFormioOptions} from '@valtimo/components';
import moment from 'moment';
import {FormioForm} from '@formio/angular';
import {UserProviderService} from '@valtimo/security';
import {Subscription} from 'rxjs';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  selector: 'valtimo-dossier-detail-tab-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierDetailTabSummaryComponent implements OnInit, OnDestroy {
  public readonly documentDefinitionName: string;
  public document: Document;
  public documentId: string;
  public processDocumentInstances: ProcessDocumentInstance[] = [];
  private snapshot: ParamMap;
  public tasks: ProcessInstanceTask[] = [];
  public moment;
  public formDefinition: FormioForm = null;
  public options: ValtimoFormioOptions;
  public roles: string[] = [];

  public readonly renderSummaryForm$ = this.summaryFormService.renderSummaryForm$;

  private _subscriptions = new Subscription();
  @ViewChild('taskDetail') taskDetail: TaskDetailModalComponent;

  constructor(
    private readonly router: Router,
    private readonly documentService: DocumentService,
    private readonly taskService: TaskService,
    private readonly processService: ProcessService,
    private readonly el: ElementRef,
    private readonly renderer: Renderer2,
    private readonly route: ActivatedRoute,
    private readonly formService: FormService,
    private readonly userProviderService: UserProviderService,
    private readonly summaryFormService: SummaryFormService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
    this.documentId = this.snapshot.get('documentId') || '';
    this.options = new FormioOptionsImpl();
    this.options.disableAlerts = true;
  }

  ngOnInit() {
    this.moment = moment;
    this.init();
  }

  ngOnDestroy() {
    this._subscriptions.unsubscribe();
  }

  init() {
    this._subscriptions.add(
      this.documentService.getDocument(this.documentId).subscribe(document => {
        this.document = document;
      })
    );

    this._subscriptions.add(
      this.formService
        .getFormDefinitionByNamePreFilled(`${this.documentDefinitionName}.summary`, this.documentId)
        .subscribe(formDefinition => {
          this.formDefinition = formDefinition;
        })
    );

    this._subscriptions.add(
      this.userProviderService.getUserSubject().subscribe(user => {
        this.roles = user.roles;
        this.tasks = [];
        this.loadProcessDocumentInstances(this.documentId);
      })
    );
  }

  public loadProcessDocumentInstances(documentId: string) {
    this._subscriptions.add(
      this.documentService
        .findProcessDocumentInstances(documentId)
        .subscribe(processDocumentInstances => {
          this.processDocumentInstances = processDocumentInstances;
          this.processDocumentInstances.forEach(instance => {
            this.loadProcessInstanceTasks(instance.id.processInstanceId);
          });
        })
    );
  }

  private loadProcessInstanceTasks(processInstanceId: string) {
    this._subscriptions.add(
      this.processService.getProcessInstanceTasks(processInstanceId).subscribe(tasks => {
        if (tasks != null) {
          tasks.forEach(task => {
            task.createdUnix = this.moment(task.created).unix();
            task.created = this.moment(task.created).format('DD MMM YYYY HH:mm');
            task.isLocked = () => {
              let locked = true;
              for (const link of task.identityLinks) {
                if (link.type === 'candidate' && link.groupId) {
                  if (this.roles.includes(link.groupId)) {
                    locked = false;
                    break;
                  }
                }
              }
              return locked;
            };
          });
          this.tasks = this.tasks.concat(tasks);
          this.tasks.sort((t1, t2) => t2.createdUnix - t1.createdUnix);
        }
      })
    );
  }

  public rowTaskClick(task: any) {
    this.taskDetail.openTaskDetails(task);
  }
}
