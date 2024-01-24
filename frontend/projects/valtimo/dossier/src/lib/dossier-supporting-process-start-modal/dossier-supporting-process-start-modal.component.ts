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
import {BehaviorSubject, combineLatest, Observable, of, switchMap, tap} from 'rxjs';
import {catchError, map, take} from 'rxjs/operators';
import {UserProviderService} from '@valtimo/security';

@Component({
  selector: 'valtimo-dossier-supporting-process-start-modal',
  templateUrl: './dossier-supporting-process-start-modal.component.html',
  styleUrls: ['./dossier-supporting-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierSupportingProcessStartModalComponent {
  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('supportingProcessStartModal', {static: false}) modal: ModalComponent;
  @Output() formSubmit = new EventEmitter();

  public readonly processDefinitionKey$ = new BehaviorSubject<string>('');
  public readonly documentDefinitionName$ = new BehaviorSubject<string>('');
  public readonly processName$ = new BehaviorSubject<string>('');
  public readonly formDefinition$ = new BehaviorSubject<FormioForm>(undefined);
  public readonly formioSubmission$ = new BehaviorSubject<FormioSubmission>(undefined);
  public readonly formAssociation$ = new BehaviorSubject<FormAssociation>(undefined);
  public readonly processLinkId$ = new BehaviorSubject<string>('');
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions>(undefined);
  public readonly submission$ = new BehaviorSubject<object>(undefined);
  public readonly processDefinitionId$ = new BehaviorSubject<string>(undefined);
  public readonly formFlowInstanceId$ = new BehaviorSubject<string>(undefined);
  public readonly documentId$ = new BehaviorSubject<string>(undefined);

  public readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly processService: ProcessService,
    private readonly processLinkService: ProcessLinkService,
    private readonly documentService: DocumentService,
    private readonly formLinkService: FormLinkService,
    private readonly formFlowService: FormFlowService,
    private readonly logger: NGXLogger,
    private readonly userProviderService: UserProviderService
  ) {}

  private loadProcessLink() {
    combineLatest([this.processDefinitionId$, this.documentId$])
      .pipe(
        switchMap(([processDefinitionId, documentId]) =>
          this.processService.getProcessDefinitionStartProcessLink(
            processDefinitionId,
            documentId,
            null
          )
        )
      )
      .subscribe(startProcessResult => {
        if (startProcessResult) {
          switch (startProcessResult.type) {
            case 'form':
              this.formDefinition$.next(startProcessResult.properties.prefilledForm);
              this.processLinkId$.next(startProcessResult.processLinkId);
              break;
            case 'form-flow':
              this.formFlowInstanceId$.next(startProcessResult.properties.formFlowInstanceId);
              break;
          }
          this.modal.show();
        } else {
          // backwards compatibility for form associations
          combineLatest([this.processDefinitionKey$, this.documentId$])
            .pipe(
              switchMap(([processDefinitionKey, documentId]) =>
                this.formLinkService.getStartEventFormDefinitionByProcessDefinitionKey(
                  processDefinitionKey,
                  documentId
                )
              ),
              tap(formDefinitionWithFormAssociation => {
                this.openFormAssociation(formDefinitionWithFormAssociation);
              }),
              catchError(() => {
                this.modal.show();
                return of(null);
              })
            )
            .subscribe();
        }
      });
  }

  private openFormAssociation(formDefinitionWithFormAssociation: any) {
    const formAssociation = formDefinitionWithFormAssociation.formAssociation;
    const className = formAssociation.formLink.className.split('.');

    this.formAssociation$.next(formAssociation);

    const linkType = className[className.length - 1];
    switch (linkType) {
      case 'BpmnElementFormIdLink':
        this.setFormDefinition(formDefinitionWithFormAssociation);
        break;
      case 'BpmnElementFormFlowIdLink':
        this.setFormFlow();
        break;
      case 'BpmnElementUrlLink':
        const url = this.router.serializeUrl(
          this.router.createUrlTree([this.formAssociation$.getValue().formLink.url])
        );
        window.open(url, '_blank');
        break;
      case 'BpmnElementAngularStateUrlLink':
        this.route.params.pipe(take(1)).subscribe(params => {
          const documentId = params?.documentId;

          this.router.navigate([this.formAssociation$.getValue().formLink.url], {
            state: {...(documentId && {documentId})},
          });
        });
        break;
      default:
        this.logger.fatal('Unsupported class name');
    }
  }

  openModal(processDocumentDefinition: ProcessDocumentDefinition, documentId: string) {
    this.documentId$.next(documentId);
    this.documentDefinitionName$.next(processDocumentDefinition.id.documentDefinitionId.name);
    this.processDefinitionKey$.next(processDocumentDefinition.id.processDefinitionKey);
    this.processDefinitionId$.next(processDocumentDefinition.latestVersionId);
    this.processName$.next(processDocumentDefinition.processName);

    const formioBeforeSubmit: FormioBeforeSubmit = function (submission, callback) {
      callback(null, submission);
    };
    const options = new FormioOptionsImpl();
    options.disableAlerts = true;

    options.setHooks(formioBeforeSubmit);

    this.options$.next(options);

    this.loadProcessLink();
  }

  public onSubmit(submission: FormioSubmission) {
    this.formioSubmission$.next(submission);

    if (this.processLinkId$.getValue()) {
      combineLatest([this.processLinkId$, this.documentId$])
        .pipe(
          switchMap(([processLinkId, documentId]) =>
            this.processLinkService.submitForm(processLinkId, submission.data, documentId)
          )
        )
        .subscribe({
          next: (formSubmissionResult: FormSubmissionResult) => {
            this.formSubmitted();
          },
          error: errors => {
            this.form.showErrors(errors);
          },
        });
    } else {
      combineLatest([this.processDefinitionKey$, this.formAssociation$, this.documentId$])
        .pipe(
          switchMap(([processDefinitionKey, formAssociation, documentId]) =>
            this.formLinkService.onSubmit(
              processDefinitionKey,
              formAssociation.formLink.id,
              submission.data,
              documentId
            )
          )
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
    this.router.navigate(['form-links'], {
      queryParams: {process: this.processDefinitionKey$.getValue()},
    });
  }

  private setFormDefinition(formDefinitionWithFormAssociation: any): void {
    this.formDefinition$.next(formDefinitionWithFormAssociation);
    this.documentId$
      .pipe(
        switchMap(documentId => this.documentService.getDocument(documentId)),
        tap(document => {
          this.submission$.next({
            data: document.content,
          });
        }),
        tap(() => {
          this.modal.show();
        })
      )
      .subscribe();
  }

  private setFormFlow(): void {
    combineLatest([this.processDefinitionKey$, this.documentId$])
      .pipe(
        switchMap(([processDefinitionKey, documentId]) =>
          this.formFlowService.createInstanceForNewProcess(processDefinitionKey, {
            documentId,
            documentDefinitionName: null,
          })
        ),
        tap(result => {
          this.formFlowInstanceId$.next(result.formFlowInstanceId);
        }),
        tap(() => {
          this.modal.show();
        })
      )
      .subscribe();
  }
}
