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
import {
  CAN_VIEW_TASK_PERMISSION,
  TASK_DETAIL_PERMISSION_RESOURCE,
  TaskDetailModalComponent,
  TaskService,
} from '@valtimo/task';
import {FormService} from '@valtimo/form';
import {FormioOptionsImpl, ValtimoFormioOptions} from '@valtimo/components';
import moment from 'moment';
import {FormioForm} from '@formio/angular';
import {UserProviderService} from '@valtimo/security';
import {BehaviorSubject, combineLatest, of, Subscription, switchMap} from 'rxjs';
import {PermissionService} from '@valtimo/access-control';

moment.locale(localStorage.getItem('langKey') || '');
moment.defaultFormat = 'DD MMM YYYY HH:mm';

@Component({
  selector: 'valtimo-dossier-detail-tab-summary',
  templateUrl: './summary.component.html',
  styleUrls: ['./summary.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierDetailTabSummaryComponent implements OnInit, OnDestroy {
  @ViewChild('taskDetail') taskDetail: TaskDetailModalComponent;
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
  public readonly loadingTasks$ = new BehaviorSubject<boolean>(true);
  private _subscriptions = new Subscription();

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
    private readonly permissionService: PermissionService
  ) {
    this.snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this.snapshot.get('documentDefinitionName') || '';
    this.documentId = this.snapshot.get('documentId') || '';
    this.options = new FormioOptionsImpl();
    this.options.disableAlerts = true;
  }

  public ngOnInit(): void {
    this.moment = moment;
    this.init();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }
  public init(): void {
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

  public loadProcessDocumentInstances(documentId: string): void {
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

  public rowTaskClick(task: any): void {
    this.taskDetail.openTaskDetails(task);
  }

  private loadProcessInstanceTasks(processInstanceId: string): void {
    this._subscriptions.add(
      this.processService
        .getProcessInstanceTasks(processInstanceId)
        .pipe(
          switchMap(tasks =>
            combineLatest([
              of(tasks),
              ...(tasks || []).map(task =>
                this.permissionService.requestPermission(CAN_VIEW_TASK_PERMISSION, {
                  resource: TASK_DETAIL_PERMISSION_RESOURCE.task,
                  identifier: task.id,
                })
              ),
            ])
          )
        )
        .subscribe(res => {
          const tasks = res?.[0];
          const permissions = res?.filter((_, index) => index !== 0);

          if (!!tasks) {
            tasks.forEach((task, taskIndex) => {
              task.createdUnix = this.moment(task.created).unix();
              task.created = this.moment(task.created).format('DD MMM YYYY HH:mm');
              task.isLocked = !permissions[taskIndex];
            });
            this.tasks = this.tasks.concat(tasks);
            this.tasks.sort((t1, t2) => t2.createdUnix - t1.createdUnix);
          }

          this.loadingTasks$.next(false);
        })
    );
  }
}
