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

import {CommonModule} from '@angular/common';
import {
  Component,
  EventEmitter,
  HostBinding,
  OnDestroy,
  OnInit,
  Output,
  ViewEncapsulation,
} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {ArrowLeft16} from '@carbon/icons';
import {FormioForm} from '@formio/angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  CarbonListModule,
  ConfirmationModalModule,
  EditorModel,
  EditorModule,
  FormIoModule,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
  RenderInPageHeaderDirectiveModule,
  ShellService,
  SpinnerModule,
  ValtimoCdsModalDirectiveModule,
  WidgetModule,
} from '@valtimo/components';
import {
  EnvironmentService,
  getCaseManagementRouteParams,
  getCaseManagementRouteParamsAndContext,
  GlobalNotificationService,
} from '@valtimo/shared';
import {
  ButtonModule,
  DialogModule,
  IconModule,
  IconService,
  InputModule,
  LoadingModule,
  ModalModule,
  ModalService,
  TabsModule,
  TagModule,
} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, map, Observable, of, Subscription} from 'rxjs';
import {distinctUntilChanged, filter, switchMap, take, tap} from 'rxjs/operators';
import {EDIT_TABS, FormDefinition, ModifyFormDefinitionRequest} from '../../models';
import {FormManagementService} from '../../services';
import {getContextObservable} from '../../utils';
import {FormManagementDuplicateComponent} from '../form-management-duplicate';
import {FormManagementUploadComponent} from '../form-management-upload';

@Component({
  selector: 'valtimo-form-management-edit',
  templateUrl: './form-management-edit.component.html',
  styleUrls: ['./form-management-edit.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    InputModule,
    ReactiveFormsModule,
    FormsModule,
    WidgetModule,
    CarbonListModule,
    ValtimoCdsModalDirectiveModule,
    TabsModule,
    EditorModule,
    FormIoModule,
    RenderInPageHeaderDirectiveModule,
    DialogModule,
    TagModule,
    ConfirmationModalModule,
    SpinnerModule,
    FormManagementUploadComponent,
    IconModule,
    SpinnerModule,
    LoadingModule,
  ],
})
export class FormManagementEditComponent
  extends PendingChangesComponent
  implements OnInit, OnDestroy
{
  @HostBinding('class') public readonly class = 'valtimo-form-management-edit';

  @Output() public readonly deleteEvent = new EventEmitter<void>();
  @Output() public readonly goBackEvent = new EventEmitter<void>();
  @Output() public readonly formModifiedEvent = new EventEmitter<void>();
  @Output() public readonly formDeletedEvent = new EventEmitter<void>();
  @Output() public readonly deleteErrorEvent = new EventEmitter<boolean>();
  @Output() public readonly deployErrorEvent = new EventEmitter<boolean>();

  public modifiedFormDefinition: FormioForm | null = null;
  public validJsonChange: boolean | null = null;

  public readonly TABS = EDIT_TABS;

  public activeTab = EDIT_TABS.BUILDER;

  public readonly editParam$: Observable<string | null> = this.route.paramMap.pipe(
    map(params => (params.has('formDefinitionId') ? params.get('formDefinitionId') : null))
  );

  public readonly context$ = getContextObservable(this.route);

  public readonly caseManagementRouteParams$ = this.context$.pipe(
    filter(context => context === 'case'),
    switchMap(() => getCaseManagementRouteParams(this.route))
  );

  private readonly _formDefinition$ = new BehaviorSubject<FormDefinition | null>(null);

  public readonly canUpdateGlobalConfiguration$ =
    this.environmentService.canUpdateGlobalConfiguration();

  private get _formDefinition(): FormDefinition {
    return this._formDefinition$.getValue();
  }

  public readonly formDefinition$ = this._formDefinition$.pipe(
    filter((definition: FormDefinition | null) => !!definition),
    distinctUntilChanged(
      (prevFormDefinition, currFormDefinition) =>
        JSON.stringify(prevFormDefinition?.formDefinition?.components) ===
        JSON.stringify(currFormDefinition?.formDefinition?.components)
    ),
    tap(() => {
      if (!this._editorInitialized) {
        this._editorInitialized = true;
        return;
      }

      this.pendingChanges = true;
    })
  );

  public readonly jsonFormDefinition$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly jsonOutput$ = new BehaviorSubject<EditorModel | null>(null);
  public readonly reloading$ = new BehaviorSubject<boolean>(false);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly showModal$ = new BehaviorSubject<boolean>(false);
  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  private _activeOuput: string;
  private _alertSub: Subscription = Subscription.EMPTY;
  private _changeActive = false;
  private _editorInitialized = false;

  constructor(
    private readonly formManagementService: FormManagementService,
    private readonly modalService: ModalService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly shellService: ShellService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly iconService: IconService,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly environmentService: EnvironmentService
  ) {
    super();
    this.iconService.registerAll([ArrowLeft16]);
  }

  public ngOnInit(): void {
    this.loadFormDefinition();
    this.checkToOpenUploadModal();
    this.pageTitleService.disableReset();
    this.initBreadcrumbs();
  }

  public ngOnDestroy(): void {
    this._alertSub.unsubscribe();
    this.pageTitleService.enableReset();
    this.pageTitleService.clearPageActionsViewContainerRef();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public formBuilderChanged(event, definition: EditorModel): void {
    if (event.type === 'updateComponent') {
      return;
    }
    this._changeActive = true;
    this.modifiedFormDefinition = event.form;
    this._formDefinition$.next({...this._formDefinition, formDefinition: event.form});
    this.jsonFormDefinition$.next({...definition, value: JSON.stringify(event.form)});
    this._changeActive = false;
  }

  public delete(): void {
    this.showDeleteModal$.next(true);
  }

  public deleteFormDefinition(definition: FormDefinition): void {
    this.pendingChanges = false;

    getCaseManagementRouteParamsAndContext(this.route)
      .pipe(
        switchMap(([context, caseManagementRouteParams]) => {
          switch (context) {
            case 'case':
              return this.formManagementService.deleteFormDefinitionCase(
                caseManagementRouteParams?.caseDefinitionKey,
                caseManagementRouteParams?.caseDefinitionVersionTag,
                definition.id
              );

            case 'independent':
            default:
              return this.formManagementService.deleteFormDefinition(definition.id);
          }
        })
      )
      .subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('formManagement.notifications.deleted'),
          });
          this.navigateBack();
        },
        error: () => {
          this.notificationService.showToast({
            type: 'error',
            title: this.translateService.instant('formManagement.notifications.deletionError'),
          });
        },
      });
  }

  public onGoBackButtonClick(): void {
    this.navigateBack();
  }

  public modifyFormDefinition(definition: FormDefinition): void {
    this.pendingChanges = true;

    const form = JSON.stringify(
      this.modifiedFormDefinition !== null ? this.modifiedFormDefinition : definition.formDefinition
    );

    const request: ModifyFormDefinitionRequest = {
      id: definition.id,
      name: definition.name,
      formDefinition: form,
    };

    getCaseManagementRouteParamsAndContext(this.route)
      .pipe(
        switchMap(([context, caseManagementRouteParams]) => {
          switch (context) {
            case 'case':
              return this.formManagementService.modifyFormDefinitionCase(
                caseManagementRouteParams.caseDefinitionKey,
                caseManagementRouteParams.caseDefinitionVersionTag,
                request
              );

            case 'independent':
            default:
              return this.formManagementService.modifyFormDefinition(request);
          }
        })
      )
      .subscribe({
        next: () => {
          this.notificationService.showToast({
            type: 'success',
            title: this.translateService.instant('formManagement.notifications.deployed'),
          });

          this.pendingChanges = false;
          this.navigateBack();
        },
        error: () => {
          this.notificationService.showToast({
            type: 'error',
            title: this.translateService.instant('formManagement.notifications.deploymentError'),
          });
        },
      });
  }

  private loadFormDefinition(): void {
    getCaseManagementRouteParamsAndContext(this.route)
      .pipe(
        switchMap(([context, params]) => combineLatest([of(context), of(params), this.editParam$])),
        switchMap(([context, caseManagementRouteParams, formDefinitionId]) => {
          if (!formDefinitionId) return of(null);

          switch (context) {
            case 'case':
              return this.formManagementService.getFormDefinitionCase(
                caseManagementRouteParams.caseDefinitionKey,
                caseManagementRouteParams.caseDefinitionVersionTag,
                formDefinitionId
              );
            case 'independent':
            default:
              return this.formManagementService.getFormDefinition(formDefinitionId);
          }
        })
      )
      .subscribe((definition: FormDefinition | null) => {
        if (!definition) return;

        this._formDefinition$.next(definition);
        this.pageTitleService.setCustomPageTitle(definition.name);
        this.jsonFormDefinition$.next({
          value: JSON.stringify(definition.formDefinition),
          language: 'json',
        });
      });
  }

  public downloadFormDefinition(definition: FormDefinition): void {
    const file = new Blob([JSON.stringify(definition.formDefinition)], {
      type: 'text/json',
    });
    const link = document.createElement('a');
    link.download = `form_${definition.name}.json`;
    link.href = window.URL.createObjectURL(file);
    link.click();
    window.URL.revokeObjectURL(link.href);
    link.remove();
  }

  public onSelectedTab(tab: EDIT_TABS): void {
    this.activeTab = tab;

    if (tab === EDIT_TABS.BUILDER) {
      return;
    }

    setTimeout(() => {
      this.shellService.onMainContentResize();
    });
  }

  public onOutputChange(event: {data: object | undefined}): void {
    this.reloading$.next(false);

    if (!event.data) {
      return;
    } else if (JSON.stringify(event.data) === this._activeOuput) {
      return;
    }

    this._activeOuput = JSON.stringify(event.data);
    this.jsonOutput$.next({value: this._activeOuput, language: 'json'});
  }

  public onValueChangeEvent(value: string, definition: FormDefinition, disabled: boolean): void {
    if (this._changeActive || this.validJsonChange === false || disabled) {
      return;
    }

    const parsedDefinition = JSON.parse(value);

    this.modifiedFormDefinition = parsedDefinition;

    this._formDefinition$.next({
      ...definition,
      formDefinition: parsedDefinition,
    });
  }

  public onValidEvent(value: boolean, disabled: boolean): void {
    if (this._changeActive || disabled) {
      return;
    }

    this.validJsonChange = value;
  }

  public showUploadModal(): void {
    this.showModal$.next(true);
  }

  public showDuplicateModal(definition: FormDefinition): void {
    getCaseManagementRouteParamsAndContext(this.route)
      .pipe(take(1))
      .subscribe(([context, params]) => {
        this.modalService.create({
          component: FormManagementDuplicateComponent,
          inputs: {
            formToDuplicate: definition,
            disabledPendingChangesCallback: this.disablePendingChanges,
            context,
            params,
          },
        });
      });
  }

  public setFormDefinition(formDefinition: any): void {
    this.reloading$.next(true);

    const definition = JSON.parse(formDefinition);
    if (!definition?.components) {
      this.reloading$.next(false);
      return;
    }

    const components = definition.components;
    const currentDefinition = this.modifiedFormDefinition || definition.formDefinition;
    const newDefinition = {...currentDefinition, ...(components && {components})};

    this.modifiedFormDefinition = newDefinition;
    definition.formDefinition = newDefinition;
    this._formDefinition$.next(definition);

    this.jsonFormDefinition$.next({
      value: JSON.stringify(newDefinition),
      language: 'json',
    });

    // We need to force a short delay so the formio builder is re-initialized with the new definition
    setTimeout(() => {
      this.reloading$.next(false);
    }, 100);
  }

  protected onConfirmRedirect(): void {
    const cancelButton: HTMLElement | null = document.querySelector('button[ref="cancelButton"]');
    if (!cancelButton) {
      return;
    }

    cancelButton.click();
  }

  private checkToOpenUploadModal(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      if (params?.upload === 'true') {
        this.showUploadModal();
      }
    });
  }

  private navigateBack(): void {
    this.router.navigate(['../'], {relativeTo: this.route});
  }

  private disablePendingChanges = () => {
    this.pendingChanges = false;
  };

  private initBreadcrumbs(): void {
    getCaseManagementRouteParamsAndContext(this.route)
      .pipe(take(1))
      .subscribe(([context, params]) => {
        if (context === 'independent') return;

        const route = `/case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}`;

        this.breadcrumbService.setThirdBreadcrumb({
          route: [route],
          content: `${params.caseDefinitionKey} (${params.caseDefinitionVersionTag})`,
          href: route,
        });

        const routeWithForms = `${route}/forms`;

        this.breadcrumbService.setFourthBreadcrumb({
          route: [routeWithForms],
          content: this.translateService.instant('caseManagement.tabs.forms'),
          href: routeWithForms,
        });
      });
  }
}
