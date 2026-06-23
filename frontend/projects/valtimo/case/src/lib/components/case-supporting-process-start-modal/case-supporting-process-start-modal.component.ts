/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
  OnDestroy,
  Optional,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import {Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {FormioBeforeSubmit, FormioForm} from '@formio/angular';
import {
  CarbonModalSize,
  FormioComponent,
  FormioOptionsImpl,
  FormioSubmission,
  ValtimoFormioOptions,
} from '@valtimo/components';
import {StartableItem} from '@valtimo/document';
import {ProcessService, StartProcessLinkType} from '@valtimo/process';
import {
  FORM_CUSTOM_COMPONENT_TOKEN,
  FormCustomComponent,
  FormCustomComponentConfig,
  FormDisplayType,
  FormSize,
  formSizeToCarbonModalSizeMap,
  ProcessLinkService,
} from '@valtimo/process-link';
import {BehaviorSubject, combineLatest, Observable, Subscription, switchMap} from 'rxjs';
import {map, take} from 'rxjs/operators';
import {FORM_VIEW_MODEL_TOKEN, FormViewModel} from '@valtimo/shared';
import {CaseDetailLayoutService} from '../../services';

const DEFAULT_START_MODAL_SIZE: CarbonModalSize = 'sm';

@Component({
  standalone: false,
  selector: 'valtimo-case-supporting-process-start-modal',
  templateUrl: './case-supporting-process-start-modal.component.html',
  styleUrls: ['./case-supporting-process-start-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
})
export class CaseSupportingProcessStartModalComponent implements OnDestroy {
  @ViewChild('form', {static: false}) form: FormioComponent;
  @ViewChild('formViewModelComponent', {static: true, read: ViewContainerRef})
  public formViewModelDynamicContainer: ViewContainerRef;
  @ViewChild('formCustomComponent', {static: false, read: ViewContainerRef})
  public formCustomComponentDynamicContainer: ViewContainerRef;
  @ViewChild('startForm', {static: false}) public startFormTemplate: TemplateRef<any>;

  @Input() isAdmin: boolean;
  @Output() formSubmit = new EventEmitter();

  public readonly startProcessLinkType$ = new BehaviorSubject<StartProcessLinkType | null>(null);
  public readonly processDefinitionKey$ = new BehaviorSubject<string>('');
  public readonly caseDefinitionKey$ = new BehaviorSubject<string>('');
  public readonly processName$ = new BehaviorSubject<string>('');
  public readonly formDefinition$ = new BehaviorSubject<FormioForm>(undefined);
  public readonly formioSubmission$ = new BehaviorSubject<FormioSubmission>(undefined);
  public readonly processLinkId$ = new BehaviorSubject<string>('');
  public readonly options$ = new BehaviorSubject<ValtimoFormioOptions>(undefined);
  public readonly submission$ = new BehaviorSubject<object>(undefined);
  public readonly processDefinitionId$ = new BehaviorSubject<string>(undefined);
  public readonly formFlowInstanceId$ = new BehaviorSubject<string>(undefined);
  public readonly documentId$ = new BehaviorSubject<string>(undefined);
  public readonly modalOpen$ = new BehaviorSubject<boolean>(false);
  public readonly modalSize$ = new BehaviorSubject<CarbonModalSize>(DEFAULT_START_MODAL_SIZE);
  public readonly isLoading$ = new BehaviorSubject<boolean>(true);
  public readonly formErrors$ = new BehaviorSubject<string[]>([]);
  private readonly _formCustomComponentConfig$ = new BehaviorSubject<
    FormCustomComponentConfig | {}
  >({});
  private _caseDefinitionVersionTag: string;
  private _buildingBlockDefinitionKey: string | null = null;
  private _buildingBlockDefinitionVersionTag: string | null = null;

  public readonly closeModalEvent = new EventEmitter();
  public readonly showDraftConfirmation$ = new BehaviorSubject<boolean>(false);

  private _pendingStartableItem: {
    item: StartableItem;
    documentId: string;
    caseDefinitionKey: string;
    caseDefinitionVersionTag: string;
  } | null = null;

  public readonly modalTitle$ = combineLatest([
    this.processDefinitionKey$,
    this.processName$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([processDefinitionKey, processName]) => {
      const translated = this.translateService.instant(processDefinitionKey);
      return translated !== processDefinitionKey ? translated : processName;
    })
  );

  // Whether the active tab exposes a panel and the start form may render in it.
  private _panelAvailable = false;
  // Whether the current start form is being rendered in the panel instead of the modal.
  private _displayInPanel = false;

  private _formViewModelSubscription!: Subscription;

  constructor(
    private readonly router: Router,
    private readonly processService: ProcessService,
    private readonly processLinkService: ProcessLinkService,
    private readonly translateService: TranslateService,
    private readonly caseDetailLayoutService: CaseDetailLayoutService,
    @Optional() @Inject(FORM_VIEW_MODEL_TOKEN) private readonly formViewModel: FormViewModel,
    @Optional()
    @Inject(FORM_CUSTOM_COMPONENT_TOKEN)
    private readonly formCustomComponentConfig: FormCustomComponentConfig
  ) {
    this._formCustomComponentConfig$.next(formCustomComponentConfig);
  }

  public ngOnDestroy(): void {
    this._formViewModelSubscription?.unsubscribe();
  }

  private loadProcessLink(): void {
    this.startProcessLinkType$.next(null);
    this.modalSize$.next(DEFAULT_START_MODAL_SIZE);
    this.formViewModelDynamicContainer?.clear();
    this.formCustomComponentDynamicContainer?.clear();

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
        this.isLoading$.next(false);

        if (!startProcessResult) {
          // No process link configured: show the modal with the "no form" guidance.
          this.openCdsModal();
          return;
        }

        this.startProcessLinkType$.next(startProcessResult.type);

        const displayType: FormDisplayType | undefined =
          startProcessResult.properties?.formDisplayType;
        const formSize: FormSize = startProcessResult.properties?.formSize ?? 'medium';

        switch (startProcessResult.type) {
          case 'form':
            this.formDefinition$.next(startProcessResult.properties.prefilledForm);
            this.processLinkId$.next(startProcessResult.processLinkId);
            this.openStartForm(displayType, formSize);
            break;
          case 'form-flow':
            this.formFlowInstanceId$.next(startProcessResult.properties.formFlowInstanceId);
            this.openStartForm(displayType, formSize);
            break;
          case 'form-view-model':
            // Dynamically rendered forms rely on view-container refs that only exist inside the
            // modal, so they always open in the modal regardless of the configured display type.
            this.formDefinition$.next(startProcessResult.properties.formDefinition);
            this.setFormViewModelComponent(startProcessResult.properties.formName);
            this.openCdsModal();
            break;
          case 'ui-component':
            this.setFormCustomComponent(startProcessResult.properties.componentKey);
            this.openCdsModal();
            break;
        }
      });
  }

  private openStartForm(displayType: FormDisplayType | undefined, formSize: FormSize): void {
    if (this._panelAvailable && displayType === 'panel') {
      this._displayInPanel = true;
      combineLatest([this.processDefinitionKey$, this.processName$])
        .pipe(take(1))
        .subscribe(([processDefinitionKey, processName]) => {
          const translated = this.translateService.instant(processDefinitionKey);
          const title = translated !== processDefinitionKey ? translated : processName;
          this.caseDetailLayoutService.openStartFormPanel(
            {template: this.startFormTemplate, title},
            formSize
          );
        });
    } else {
      this._displayInPanel = false;
      this.setModalSize(formSize);
      this.openCdsModal();
    }
  }

  private setModalSize(formSize?: FormSize): void {
    this.modalSize$.next(
      formSize ? formSizeToCarbonModalSizeMap[formSize] : DEFAULT_START_MODAL_SIZE
    );
  }

  public openModalForStartableItem(
    item: StartableItem,
    documentId: string,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string
  ): void {
    if (item.draft) {
      this._pendingStartableItem = {item, documentId, caseDefinitionKey, caseDefinitionVersionTag};
      this.showDraftConfirmation$.next(true);
      return;
    }

    this.proceedWithStartableItem(item, documentId, caseDefinitionKey, caseDefinitionVersionTag);
  }

  public onDraftConfirmationConfirm(): void {
    this.showDraftConfirmation$.next(false);
    if (this._pendingStartableItem) {
      const {item, documentId, caseDefinitionKey, caseDefinitionVersionTag} =
        this._pendingStartableItem;
      this._pendingStartableItem = null;
      this.proceedWithStartableItem(item, documentId, caseDefinitionKey, caseDefinitionVersionTag);
    }
  }

  public onDraftConfirmationCancel(): void {
    this.showDraftConfirmation$.next(false);
    this._pendingStartableItem = null;
  }

  private proceedWithStartableItem(
    item: StartableItem,
    documentId: string,
    caseDefinitionKey: string,
    caseDefinitionVersionTag: string,
    panelAvailable = false
  ): void {
    // Reset any panel left open by a previous start so its content does not linger.
    this.closeStartForm();
    this._panelAvailable = panelAvailable;
    this.isLoading$.next(true);
    this.documentId$.next(documentId);
    this.caseDefinitionKey$.next(caseDefinitionKey);
    this._caseDefinitionVersionTag = caseDefinitionVersionTag;
    this.processDefinitionId$.next(item.processDefinitionId);
    this.processName$.next(item.name || item.key);

    if (item.type === 'BUILDING_BLOCK') {
      this._buildingBlockDefinitionKey = item.key;
      this._buildingBlockDefinitionVersionTag = item.versionTag;
    } else {
      this._buildingBlockDefinitionKey = null;
      this._buildingBlockDefinitionVersionTag = null;
      this.processDefinitionKey$.next(item.key);
    }

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
    this.formErrors$.next([]);

    if (this.processLinkId$.getValue()) {
      combineLatest([this.processLinkId$, this.documentId$])
        .pipe(
          take(1),
          switchMap(([processLinkId, documentId]) =>
            this.processLinkService.submitForm(processLinkId, submission.data, documentId)
          )
        )
        .subscribe({
          next: () => {
            this.formSubmitted();
          },
          error: errors => {
            // Push server-side errors via input binding so they render in both the modal and the
            // panel (in panel mode the formio ViewChild lives in the host component's view).
            this.formErrors$.next(errors);
          },
        });
    }
  }

  public formSubmitted(): void {
    this.closeStartForm();
    this.formSubmit.emit();
    this.isLoading$.next(true);
    this.formDefinition$.next(null);
  }

  public closePanel(): void {
    this.closeStartForm();
  }

  private closeStartForm(): void {
    if (this._displayInPanel) {
      this._displayInPanel = false;
      this.caseDetailLayoutService.closeStartFormPanel();
    } else {
      this.closeCdsModal();
    }
  }

  public gotoFormLinkScreen(): void {
    this.closeStartForm();

    if (this._buildingBlockDefinitionKey && this._buildingBlockDefinitionVersionTag) {
      this.router.navigate([
        `/building-block-management/building-block/${this._buildingBlockDefinitionKey}/version/${this._buildingBlockDefinitionVersionTag}/process-definition/${this.processDefinitionId$.getValue()}`,
      ]);
    } else {
      this.router.navigate([
        `/case-management/case/${this.caseDefinitionKey$.getValue()}/version/${this._caseDefinitionVersionTag}/processes/${this.processDefinitionKey$.getValue()}`,
      ]);
    }
  }

  public onCloseSelect(): void {
    this.closeCdsModal();
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
      this.caseDefinitionKey$,
      this.options$,
      this.documentId$,
    ])
      .pipe(take(1))
      .subscribe(([form, processDefinitionKey, caseDefinitionKey, options, documentId]) => {
        formViewModelComponent.instance.formName = formName;
        formViewModelComponent.instance.form = form;
        formViewModelComponent.instance.processDefinitionKey = processDefinitionKey;
        formViewModelComponent.instance.documentDefinitionName = caseDefinitionKey;
        formViewModelComponent.instance.options = options;
        formViewModelComponent.instance.isStartForm = true;
        formViewModelComponent.instance.documentId = documentId;
      });

    formViewModelComponent.instance.formSubmit.pipe(take(1)).subscribe(() => {
      this.formSubmitted();
    });

    this._formViewModelSubscription?.unsubscribe();
    this._formViewModelSubscription = this.closeModalEvent.subscribe(() => {
      formViewModelComponent.destroy();
    });

    this.isLoading$.next(false);
  }

  private setFormCustomComponent(formCustomComponentKey: string): void {
    this.formCustomComponentDynamicContainer.clear();
    if (!this.formCustomComponentConfig) return;
    this._formCustomComponentConfig$.pipe(take(1)).subscribe(formCustomComponentConfig => {
      const customComponent = formCustomComponentConfig[formCustomComponentKey];
      const renderedComponent = this.formCustomComponentDynamicContainer.createComponent(
        customComponent
      ) as ComponentRef<FormCustomComponent>;

      combineLatest([this.processDefinitionKey$, this.caseDefinitionKey$, this.documentId$])
        .pipe(take(1))
        .subscribe(([processDefinitionKey, caseDefinitionKey, documentId]) => {
          renderedComponent.instance.processDefinitionKey = processDefinitionKey;
          renderedComponent.instance.documentDefinitionName = caseDefinitionKey;
          renderedComponent.instance.documentId = documentId;
        });

      renderedComponent.instance.submittedEvent.subscribe(() => {
        this.formSubmitted();
      });
    });
  }

  private closeCdsModal(): void {
    this.modalOpen$.next(false);
  }

  private openCdsModal(): void {
    this.modalOpen$.next(true);
  }
}
