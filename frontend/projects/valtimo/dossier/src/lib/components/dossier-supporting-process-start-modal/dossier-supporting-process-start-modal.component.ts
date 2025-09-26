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
  ComponentRef,
  EventEmitter,
  Inject,
  Input,
  Optional,
  Output,
  signal,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {Router} from '@angular/router';
import {FormioBeforeSubmit, FormioForm} from '@formio/angular';
import {
  CARBON_CONSTANTS,
  FormioComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ValtimoFormioOptions,
} from '@valtimo/components';
import {FORM_VIEW_MODEL_TOKEN, FormViewModel} from '@valtimo/config';
import {ProcessDocumentDefinition} from '@valtimo/document';
import {ProcessService} from '@valtimo/process';
import {
  FORM_CUSTOM_COMPONENT_TOKEN,
  FormCustomComponent,
  FormCustomComponentConfig,
  FormSubmissionResult,
  ProcessLinkService,
} from '@valtimo/process-link';
import {BehaviorSubject, combineLatest, Subscription, switchMap} from 'rxjs';
import {take} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-supporting-process-start-modal',
  templateUrl: './dossier-supporting-process-start-modal.component.html',
  styleUrls: ['./dossier-supporting-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class DossierSupportingProcessStartModalComponent {
  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('formViewModelComponent', {static: true, read: ViewContainerRef})
  public formViewModelDynamicContainer: ViewContainerRef;
  @ViewChild('formCustomComponent', {static: false, read: ViewContainerRef})
  public formCustomComponentDynamicContainer: ViewContainerRef;

  @Input() isAdmin: boolean;
  @Output() formSubmit = new EventEmitter();

  protected isFormViewModel = false;
  public isUIComponent = false;

  public readonly processDefinitionKey$ = new BehaviorSubject<string>('');
  public readonly documentDefinitionName$ = new BehaviorSubject<string>('');
  public readonly processName$ = new BehaviorSubject<string>('');
  public readonly formDefinition$ = new BehaviorSubject<FormioForm | null>(null);
  public readonly formioSubmission$ = new BehaviorSubject<FormioSubmission | null>(null);
  public readonly processLinkId$ = new BehaviorSubject<string>('');
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions | null>(null);
  public readonly submission$ = new BehaviorSubject<object | null>(null);
  public readonly processDefinitionId$ = new BehaviorSubject<string | null>(null);
  public readonly formFlowInstanceId$ = new BehaviorSubject<string | null>(null);
  public readonly documentId$ = new BehaviorSubject<string | null>(null);
  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);
  private readonly _formCustomComponentConfig$ = new BehaviorSubject<
    FormCustomComponentConfig | {}
  >({});
  public readonly closeModalEvent = new EventEmitter();
  public readonly $loading = signal<boolean>(true);

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly router: Router,
    private readonly processService: ProcessService,
    private readonly processLinkService: ProcessLinkService,
    @Optional() @Inject(FORM_VIEW_MODEL_TOKEN) private readonly formViewModel: FormViewModel,
    @Optional()
    @Inject(FORM_CUSTOM_COMPONENT_TOKEN)
    private readonly formCustomComponentConfig: FormCustomComponentConfig
  ) {
    this._formCustomComponentConfig$.next(formCustomComponentConfig);
  }

  private loadProcessLink(): void {
    this.$loading.set(true);
    combineLatest([this.processDefinitionId$, this.documentId$])
      .pipe(
        take(1),
        switchMap(([processDefinitionId, documentId]) =>
          this.processService.getProcessDefinitionStartProcessLink(
            processDefinitionId ?? '',
            documentId ?? '',
            ''
          )
        )
      )
      .subscribe(startProcessResult => {
        if (startProcessResult) {
          this.isUIComponent = false;
          this.isFormViewModel = false;
          switch (startProcessResult.type) {
            case 'form':
              this.formDefinition$.next(startProcessResult.properties.prefilledForm);
              this.processLinkId$.next(startProcessResult.processLinkId);
              break;
            case 'form-flow':
              this.formFlowInstanceId$.next(
                startProcessResult.properties.formFlowInstanceId ?? null
              );
              break;
            case 'form-view-model':
              this.formDefinition$.next(startProcessResult.properties.formDefinition ?? null);
              this.setFormViewModelComponent(startProcessResult.properties.formName);
              break;
            case 'ui-component':
              this.setFormCustomComponent(startProcessResult.properties.componentKey);
              this.isUIComponent = true;
              break;
          }
        }
        this.$loading.set(false);
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
    this.openCdsModal();
  }

  public onSubmit(submission: FormioSubmission): void {
    this.formioSubmission$.next(submission);

    if (this.processLinkId$.getValue()) {
      combineLatest([this.processLinkId$, this.documentId$])
        .pipe(
          take(1),
          switchMap(([processLinkId, documentId]) =>
            this.processLinkService.submitForm(processLinkId, submission.data, documentId ?? '')
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
    this.closeCdsModal();
    this.formSubmit.emit();
  }

  public gotoFormLinkScreen(): void {
    this.closeCdsModal();
    this.router.navigate(['process-links'], {
      queryParams: {process: this.processDefinitionKey$.getValue()},
    });
  }

  public onCloseSelect(): void {
    this.closeCdsModal();
  }

  private setFormViewModelComponent(formName: string | undefined): void {
    if (!this.formViewModel.component || !formName) return;
    this.formViewModelDynamicContainer.clear();
    const formViewModelComponent = this.formViewModelDynamicContainer.createComponent(
      this.formViewModel.component
    );

    combineLatest([
      this.formDefinition$,
      this.processDefinitionKey$,
      this.documentDefinitionName$,
      this.options$,
      this.documentId$,
    ])
      .pipe(take(1))
      .subscribe(([form, processDefinitionKey, documentDefinitionName, options, documentId]) => {
        formViewModelComponent.instance.formName = formName;
        formViewModelComponent.instance.form = form;
        formViewModelComponent.instance.processDefinitionKey = processDefinitionKey;
        formViewModelComponent.instance.documentDefinitionName = documentDefinitionName;
        formViewModelComponent.instance.options = options;
        formViewModelComponent.instance.isStartForm = true;
        formViewModelComponent.instance.documentId = documentId;
      });

    formViewModelComponent.instance.formSubmit.pipe(take(1)).subscribe(() => {
      this.formSubmitted();
    });

    this._subscriptions.add(
      this.closeModalEvent.subscribe(() => {
        formViewModelComponent.destroy();
      })
    );

    this.isFormViewModel = true;
  }

  private setFormCustomComponent(formCustomComponentKey: string | undefined): void {
    this.formCustomComponentDynamicContainer.clear();
    if (!this.formCustomComponentConfig || !formCustomComponentKey) return;
    this._formCustomComponentConfig$.pipe(take(1)).subscribe(formCustomComponentConfig => {
      const customComponent = formCustomComponentConfig[formCustomComponentKey];
      const renderedComponent = this.formCustomComponentDynamicContainer.createComponent(
        customComponent
      ) as ComponentRef<FormCustomComponent>;

      combineLatest([this.processDefinitionKey$, this.documentDefinitionName$])
        .pipe(take(1))
        .subscribe(([processDefinitionKey, documentDefinitionName]) => {
          renderedComponent.instance.processDefinitionKey = processDefinitionKey;
          renderedComponent.instance.documentDefinitionName = documentDefinitionName;
        });

      renderedComponent.instance.submittedEvent.subscribe(() => {
        this.formSubmitted();
      });

      this._subscriptions.add(
        this.closeModalEvent.subscribe(() => {
          renderedComponent.destroy();
        })
      );
    });
  }

  private closeCdsModal(): void {
    this.modalOpen$.next(false);
    this.closeModalEvent.emit();
    this.reset();
  }

  private openCdsModal(): void {
    this.modalOpen$.next(true);
  }

  private reset(): void {
    setTimeout(() => {
      this.formDefinition$.next(null);
      this.formFlowInstanceId$.next(null);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
