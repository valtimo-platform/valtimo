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
import {Component, EventEmitter, Inject, Input, Optional, Output, ViewChild, ViewContainerRef, ViewEncapsulation} from '@angular/core';
import {Router} from '@angular/router';
import {FormioBeforeSubmit, FormioForm} from '@formio/angular';
import {FormioComponent, FormioOptionsImpl, FormioSubmission, ModalComponent, ValtimoFormioOptions,} from '@valtimo/components';
import {ProcessDocumentDefinition} from '@valtimo/document';
import {ProcessService} from '@valtimo/process';
import {FormSubmissionResult, ProcessLinkService} from '@valtimo/process-link';
import {BehaviorSubject, combineLatest, switchMap} from 'rxjs';
import {take} from 'rxjs/operators';
import {FORM_VIEW_MODEL_TOKEN, FormViewModel} from '@valtimo/config';

@Component({
  selector: 'valtimo-dossier-supporting-process-start-modal',
  templateUrl: './dossier-supporting-process-start-modal.component.html',
  styleUrls: ['./dossier-supporting-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierSupportingProcessStartModalComponent {
  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('supportingProcessStartModal', {static: false}) modal: ModalComponent;
  @ViewChild('formViewModelComponent', {static: true, read: ViewContainerRef}) public formViewModelDynamicContainer: ViewContainerRef;

  @Input() isAdmin: boolean;
  @Output() formSubmit = new EventEmitter();

  protected isFormViewModel = false;

  public readonly processDefinitionKey$ = new BehaviorSubject<string>('');
  public readonly documentDefinitionName$ = new BehaviorSubject<string>('');
  public readonly processName$ = new BehaviorSubject<string>('');
  public readonly formDefinition$ = new BehaviorSubject<FormioForm>(undefined);
  public readonly formioSubmission$ = new BehaviorSubject<FormioSubmission>(undefined);
  public readonly processLinkId$ = new BehaviorSubject<string>('');
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions>(undefined);
  public readonly submission$ = new BehaviorSubject<object>(undefined);
  public readonly processDefinitionId$ = new BehaviorSubject<string>(undefined);
  public readonly formFlowInstanceId$ = new BehaviorSubject<string>(undefined);
  public readonly documentId$ = new BehaviorSubject<string>(undefined);

  constructor(
    private readonly router: Router,
    private readonly processService: ProcessService,
    private readonly processLinkService: ProcessLinkService,
    @Optional() @Inject(FORM_VIEW_MODEL_TOKEN) private readonly formViewModel: FormViewModel
  ) {}

  private loadProcessLink(): void {
    combineLatest([this.processDefinitionId$, this.documentId$])
      .pipe(
        take(1),
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
            case 'form-view-model':
              this.formDefinition$.next(startProcessResult.properties.formDefinition);
              this.setFormViewModelComponent(startProcessResult.properties.formName);
              this.modal.show();
              break;
          }
          this.modal.show();
        }
      });
  }

  public openModal(processDocumentDefinition: ProcessDocumentDefinition, documentId: string): void {
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

  public onSubmit(submission: FormioSubmission): void {
    this.formioSubmission$.next(submission);

    if (this.processLinkId$.getValue()) {
      combineLatest([this.processLinkId$, this.documentId$])
        .pipe(
          take(1),
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
    }
  }

  public formSubmitted(): void {
    this.modal.hide();
    this.formSubmit.emit();
  }

  public gotoFormLinkScreen(): void {
    this.modal.hide();
    this.router.navigate(['process-links'], {
      queryParams: {process: this.processDefinitionKey$.getValue()},
    });
  }

  private setFormViewModelComponent(formName: string): void {
    if (!this.formViewModel.component) return;
    this.formViewModelDynamicContainer.clear();
    const formViewModelComponent = this.formViewModelDynamicContainer.createComponent(
      this.formViewModel.component
    );

    combineLatest([
      this.formDefinition$,
      this.processDefinitionKey$,
      this.documentDefinitionName$,
      this.options$
    ]).pipe(take(1)).subscribe(([form, processDefinitionKey, documentDefinitionName, options]) => {
      formViewModelComponent.instance.formName = formName;
      formViewModelComponent.instance.form = form;
      formViewModelComponent.instance.processDefinitionKey = processDefinitionKey;
      formViewModelComponent.instance.documentDefinitionName = documentDefinitionName;
      formViewModelComponent.instance.options = options;
      formViewModelComponent.instance.isStartForm = true;
    });

    formViewModelComponent.instance.formSubmit.pipe(take(1)).subscribe(() => {
      this.formSubmitted();
    });

    this.isFormViewModel = true;
  }
}
