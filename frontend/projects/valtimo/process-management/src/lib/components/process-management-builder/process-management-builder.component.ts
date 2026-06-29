/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
import {HttpErrorResponse} from '@angular/common/http';
import {AfterViewInit, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {Deploy16, ListChecked16, Return16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  ConfirmationModalModule,
  FitPageDirective,
  ModalService,
  OverflowMenuComponent,
  OverflowMenuOptionComponent,
  OverflowMenuTriggerComponent,
  PageHeaderService,
  PageTitleService,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {
  BuildingBlockManagementParams,
  BuildingBlockProcessDefinitionWithLinksDto,
  CaseManagementParams,
  EditPermissionsService,
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  GlobalNotificationService,
  ManagementContext,
  ProcessDefinitionWithPropertiesDto,
} from '@valtimo/shared';
import {ProcessService} from '@valtimo/process';
import {
  BuildingBlockProcessDefinitionConflictResponse,
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
  ProcessDefinitionConflictResponse,
  ProcessLinkBuildingBlockApiService,
  ProcessLinkButtonService,
  ProcessLinkCreateEvent,
  ProcessLinkModule,
  ProcessLinkService,
  ProcessLinkStateService,
  ProcessLinkStepService,
} from '@valtimo/process-link';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
  CamundaPlatformPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import Modeler from 'bpmn-js/lib/Modeler';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import camundaPlatformBehaviors from 'camunda-bpmn-js-behaviors/lib/camunda-platform';
import CamundaBpmnModdle from 'camunda-bpmn-moddle/resources/camunda.json';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  ListItem,
  LoadingModule,
  SelectModule,
  TagModule,
  ToggleModule,
  TooltipModule,
} from 'carbon-components-angular';
import {isEqual} from 'lodash';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  startWith,
  Subject,
  Subscription,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {distinctUntilChanged} from 'rxjs/operators';
import {EMPTY_BPMN, PROCESS_MANAGEMENT_BUILDER_TEST_IDS} from '../../constants';
import {
  OpenProcessLinkModalEvent,
  ProcessDefinitionResult,
  ProcessDefinitionValidationError,
  ProcessManagementWindow,
  UpdateProcessDefinitionCaseDefinitionRequest,
} from '../../models';
import {ProcessManagementEditorService, ProcessManagementService} from '../../services';
import {
  applyBuildingBlockCalledElement,
  clearBuildingBlockCalledElement,
  DisableBpmnWriteModule,
  disableCommands,
  getContextObservable,
  getLatestProcessDefinition,
  initBreadcrumbsForContext,
} from '../../utils';
import {ValtimoPropertiesProviderModule} from './panel';
import {PluginTranslationService} from '@valtimo/plugin';

@Component({
  selector: 'valtimo-process-management-builder',
  templateUrl: './process-management-builder.component.html',
  styleUrls: ['./process-management-builder.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FitPageDirective,
    LoadingModule,
    RenderInPageHeaderDirective,
    DropdownModule,
    ReactiveFormsModule,
    SelectModule,
    ButtonModule,
    IconModule,
    TranslateModule,
    TagModule,
    ProcessLinkModule,
    ProcessLinkModule,
    OverflowMenuComponent,
    OverflowMenuOptionComponent,
    OverflowMenuTriggerComponent,
    ToggleModule,
    TooltipModule,
    ConfirmationModalModule,
  ],
  providers: [
    ProcessManagementEditorService,
    ProcessLinkStateService,
    ProcessLinkStepService,
    ProcessLinkButtonService,
  ],
})
export class ProcessManagementBuilderComponent implements AfterViewInit, OnDestroy {
  @ViewChild('modeler', {static: false}) modelerElementRef!: ElementRef;
  @ViewChild('modelerPanel', {static: false}) modelerPanelElementRef!: ElementRef;
  @ViewChild('viewer', {static: false}) viewerElementRef!: ElementRef;
  @ViewChild('viewerPanel', {static: false}) viewerPanelElementRef!: ElementRef;

  private readonly _selectedProcess$ = new BehaviorSubject<
    ProcessDefinitionResult | BuildingBlockProcessDefinitionWithLinksDto | 'create' | null
  >(null);

  public readonly loading$ = new BehaviorSubject<boolean>(true);

  private _bpmnModeler!: Modeler;
  private _bpmnViewer!: NavigatedViewer;
  private _validationErrorElementIds: string[] = [];
  private _validationHoverHandler: ((event: any) => void) | null = null;
  private _validationOutHandler: ((event: any) => void) | null = null;

  public readonly isReadOnlyProcess$ = new BehaviorSubject<boolean>(false);
  public readonly isSystemProcess$ = new BehaviorSubject<boolean>(false);

  public readonly draft$ = new BehaviorSubject<boolean>(false);
  public readonly canInitializeDocument$ = new BehaviorSubject<boolean>(false);
  public readonly startableByUser$ = new BehaviorSubject<boolean>(false);
  public readonly validationErrors$ = this.processManagementEditorService.validationErrors$;

  protected readonly testIds = PROCESS_MANAGEMENT_BUILDER_TEST_IDS;

  public readonly selectedProcessDefinitionXml$ =
    this.processManagementEditorService.selectionProcessDefinition$.pipe(
      filter(selectedProcessDefinition => !!selectedProcessDefinition?.id),
      distinctUntilChanged((previous, current) => isEqual(previous, current)),
      tap(selectedProcessDefinition => {
        this.loading$.next(true);
        this.pageTitleService.setCustomPageTitle(selectedProcessDefinition?.name || '-');
      }),
      switchMap(selectedProcessDefinition =>
        this.processService.getProcessDefinitionXml(selectedProcessDefinition.id)
      ),
      tap(result => {
        this.cleanUpListenersOnModeler();
        this._bpmnModeler?.importXML(result.bpmn20Xml);
        this._bpmnViewer?.importXML(result.bpmn20Xml);
        this.draft$.next(this.parseDraftFromXml(result.bpmn20Xml));
        this.isReadOnlyProcess$.next(result.readOnly);
        this.isSystemProcess$.next(result.systemProcess);
        this.loading$.next(false);
      })
    );

  public readonly changesPending$ = new BehaviorSubject<boolean>(false);

  public readonly editParam$: Observable<string | 'create' | null> = this.route.url.pipe(
    map(segments => {
      const lastSegment = segments[segments.length - 1]?.path;
      if (lastSegment === 'create') {
        return 'create';
      }
      const param = this.route.snapshot.paramMap.get('processDefinitionKey');
      const idParam = this.route.snapshot.paramMap.get('processDefinitionId');
      return param || idParam || null;
    }),
    filter(editParam => !!editParam)
  );

  public readonly context$ = getContextObservable(this.route);

  public readonly managementParams$ = this.context$.pipe(
    filter(context => context === 'case' || context === 'buildingBlock'),
    switchMap(context =>
      context === 'case'
        ? getCaseManagementRouteParams(this.route)
        : getBuildingBlockManagementRouteParams(this.route)
    )
  );

  public readonly hasEditPermissions$: Observable<boolean> = this.context$.pipe(
    switchMap(context => {
      if (context === 'independent') {
        return of(true);
      }

      return this.managementParams$.pipe(
        switchMap(params =>
          this.editPermissionsService.hasPermissionsToEditBasedOnContext(params, context)
        )
      );
    })
  );

  private readonly _reload$ = new Subject<null>();

  public readonly processDefinitionVersions$: Observable<ProcessDefinitionWithPropertiesDto[]> =
    combineLatest([this.editParam$, this.context$, this._reload$.pipe(startWith(null))]).pipe(
      switchMap(([editParam, context]) =>
        context === 'independent'
          ? this.processManagementService.getUnlinkedProcessDefinitionsByKey(editParam)
          : of([] as ProcessDefinitionResult[])
      ),
      map(result => result.map(resultItem => resultItem.processDefinition)),
      tap(processDefinitions => {
        this.changesPending$.next(false);
        this.setSelectedProcessDefinitionToLatest(processDefinitions);
      })
    );

  public readonly processDefinitionVersionsListItems$: Observable<ListItem[]> = combineLatest([
    this.processDefinitionVersions$,
    this.processManagementEditorService.selectionProcessDefinition$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([processDefinitionVersions, selectionProcessDefinition]) =>
      processDefinitionVersions
        .map(processDefinitionVersion => ({
          id: processDefinitionVersion.version,
          content: `${this.translateService.instant('processManagement.version')}${processDefinitionVersion.version}`,
          selected: selectionProcessDefinition.version === processDefinitionVersion.version,
          processDefinitionVersion,
        }))
        .sort((a, b) => b.id - a.id)
    )
  );

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly creatingNewProcess$ = new BehaviorSubject<boolean>(false);

  public readonly updatingProcessDefinitionCaseDefinition$ = new BehaviorSubject<boolean>(false);

  public readonly showWarningConfirmationModal$ = new BehaviorSubject<boolean>(false);
  private _pendingDeployAction: (() => void) | null = null;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly iconService: IconService,
    private readonly logger: NGXLogger,
    private readonly modalService: ModalService,
    private readonly notificationService: GlobalNotificationService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageTitleService: PageTitleService,
    private readonly processLinkService: ProcessLinkService,
    private readonly processLinkStateService: ProcessLinkStateService,
    private readonly processManagementEditorService: ProcessManagementEditorService,
    private readonly processManagementService: ProcessManagementService,
    private readonly processService: ProcessService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly pluginTranslationService: PluginTranslationService,
    private readonly editPermissionsService: EditPermissionsService,
    private readonly processLinkBuildingBlockApiService: ProcessLinkBuildingBlockApiService
  ) {
    this.iconService.registerAll([Deploy16, ListChecked16, Return16]);
    this.setProcessManagementWindow();
  }

  public ngAfterViewInit(): void {
    this.pageTitleService.disableReset();
    this.pageHeaderService.enableTitleAsBreadcrumb();
    this.openParamsAndContextSubscription();
    this.initModeler();
    this.initViewer();
    this.subscribeToOpenProcessLinkModalEvents();
    this.subscribeToProcessLinkUpdateEvents();
    this.subscribeToProcessLinkCreateEvents();
    this.subscribeToProcessLinkDeleteEvents();
    this.initEditing();
  }

  public ngOnDestroy(): void {
    this.clearValidationErrors();
    this._bpmnModeler?.destroy();
    this._bpmnViewer?.destroy();
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
    this.pageHeaderService.disableTitleAsBreadcrumb();
    this.pageTitleService.clearPageActionsViewContainerRef();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public export(isReadOnlyProcess: boolean): void {
    (isReadOnlyProcess ? from(this._bpmnViewer.saveXML()) : from(this._bpmnModeler.saveXML()))
      .pipe(take(1))
      .subscribe(result => {
        const file = new Blob([result.xml ?? ''], {type: 'text/xml'});
        const link = document.createElement('a');
        link.download = 'diagram.bpmn';
        link.href = window.URL.createObjectURL(file);
        link.click();
        window.URL.revokeObjectURL(link.href);
        link.remove();
      });
  }

  public validateProcessDefinition(isReadOnlyProcess: boolean): void {
    combineLatest([
      from(isReadOnlyProcess ? this._bpmnViewer.saveXML() : this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks]) => {
          const xml = this.applyDraftState(result?.xml ?? '') ?? '';
          return this.processManagementService.validateProcessDefinition({
            bpmnXml: xml,
            processLinks: processLinks.map(link => ({
              ...link,
              processDefinitionId: '-',
            })),
          });
        })
      )
      .subscribe({
        next: validationResult => {
          this.highlightValidationErrors(validationResult.errors);
          if (validationResult.isValid && !validationResult.hasWarnings) {
            this.showNotification('validationSuccess');
          }
        },
        error: () => {
          this.showNotification('error');
        },
      });
  }

  public deployChanges(isReadOnlyProcess: boolean): void {
    this.validateAndDeploy(isReadOnlyProcess, () => this.executeDeployChanges(isReadOnlyProcess));
  }

  private executeDeployChanges(isReadOnlyProcess: boolean): void {
    combineLatest([
      from(isReadOnlyProcess ? this._bpmnViewer.saveXML() : this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
      this.processManagementEditorService.selectionProcessDefinition$,
      this.context$,
      this.managementParams$.pipe(startWith(null)),
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks, selectedProcessDefinition, context, params]) => {
          const xml = !isReadOnlyProcess ? this.applyDraftState(result?.xml ?? '') : null;

          if (context === 'case') {
            const caseManagementParams = params as CaseManagementParams;

            return this.processLinkService.updateProcessDefinitionForCase(
              processLinks as ProcessLinkCreateEvent[],
              selectedProcessDefinition.id,
              xml,
              caseManagementParams?.caseDefinitionKey ?? '',
              caseManagementParams?.caseDefinitionVersionTag ?? '',
              this.canInitializeDocument$.getValue(),
              this.startableByUser$.getValue()
            );
          }

          if (context === 'buildingBlock') {
            const buildingBlockManagementParams = params as BuildingBlockManagementParams;

            return this.processLinkService.updateProcessDefinitionForBuildingBlock(
              processLinks as ProcessLinkCreateEvent[],
              selectedProcessDefinition.id,
              this.applyDraftState(result?.xml),
              buildingBlockManagementParams.buildingBlockDefinitionKey,
              buildingBlockManagementParams.buildingBlockDefinitionVersionTag
            );
          }

          return this.processLinkService.updateProcessDefinition(
            processLinks as ProcessLinkCreateEvent[],
            selectedProcessDefinition.id,
            xml
          );
        }),
        switchMap(() => this.context$)
      )
      .subscribe({
        next: context => {
          this.clearValidationErrors();
          if (context === 'independent') {
            this.reload();
            this.showNotification('success');
          } else {
            this.navigateBack('success');
          }
        },
        error: (error: unknown) => {
          if (this.isValidationError(error)) {
            this.highlightValidationErrors((error as HttpErrorResponse).error.errors);
          } else {
            this.showNotification('error');
          }
        },
      });
  }

  public deployNewProcessDefinition(): void {
    this.validateAndDeploy(false, () => this.executeDeployNewProcessDefinition());
  }

  private executeDeployNewProcessDefinition(): void {
    combineLatest([
      from(this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
      this.context$,
      this.managementParams$.pipe(startWith(null)),
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks, context, params]) => {
          const xml = this.applyDraftState(result.xml ?? '');
          const mappedProcessLinks = processLinks.map(link => ({
            ...link,
            processDefinitionId: '-',
          })) as ProcessLinkCreateEvent[];

          switch (context) {
            case 'independent':
              return this.processLinkService.createProcessDefinition(mappedProcessLinks, xml);
            case 'buildingBlock':
              const buildingBlockParams = params as BuildingBlockManagementParams;
              return this.processLinkService.createProcessDefinitionForBuildingBlock(
                mappedProcessLinks,
                xml,
                buildingBlockParams.buildingBlockDefinitionKey,
                buildingBlockParams.buildingBlockDefinitionVersionTag
              );
            case 'case':
              const caseManagementParams = params as CaseManagementParams;
              return this.processLinkService.createProcessDefinitionForCase(
                mappedProcessLinks,
                xml,
                caseManagementParams.caseDefinitionKey,
                caseManagementParams.caseDefinitionVersionTag,
                this.canInitializeDocument$.getValue(),
                this.startableByUser$.getValue()
              );
          }
        })
      )
      .subscribe({
        next: () => {
          this.clearValidationErrors();
          this.navigateBack('success');
        },
        error: (error: unknown) => {
          if (this.isProcessDefinitionAlreadyExistsError(error)) {
            this.showNotification('alreadyExists');
          } else if (this.isValidationError(error)) {
            this.highlightValidationErrors((error as HttpErrorResponse).error.errors);
          } else {
            this.showNotification('error');
          }
        },
      });
  }

  public selectedVersionChange(event: {
    item: {processDefinitionVersion: ProcessDefinitionWithPropertiesDto};
  }): void {
    this.processManagementEditorService.selectionProcessDefinition$
      .pipe(take(1))
      .subscribe(selectedVersion => {
        if (selectedVersion.id !== event.item.processDefinitionVersion.id) {
          this.processManagementEditorService.setSelectedProcessDefinition(
            event?.item?.processDefinitionVersion
          );
          this.changesPending$.next(false);
        }
      });
  }

  public navigateBack(notification: null | 'success' | 'error'): void {
    this.router.navigate(['../'], {relativeTo: this.route});

    if (!notification) return;

    this.showNotification(notification);
  }

  public onValidationErrorClick(elementId: string): void {
    const modeler = this.isReadOnlyProcess$.getValue() ? this._bpmnViewer : this._bpmnModeler;
    const elementRegistry = modeler.get('elementRegistry') as any;
    const canvas = modeler.get('canvas') as any;

    const element = elementRegistry.get(elementId);
    if (!element) return;

    try {
      const selection = modeler.get('selection') as any;
      selection?.select?.(element);
    } catch {
      // Viewer may not expose the selection service.
    }

    try {
      canvas.scrollToElement(element);
    } catch {
      // ignore
    }
  }

  public onProcessToggleChange(
    field: keyof UpdateProcessDefinitionCaseDefinitionRequest | 'draft',
    value: boolean
  ): void {
    if (field === 'draft') this.draft$.next(value);
    if (field === 'canInitializeDocument') this.canInitializeDocument$.next(value);
    if (field === 'startableByUser') this.startableByUser$.next(value);
    this.changesPending$.next(true);
  }

  public onWarningConfirmationConfirm(): void {
    if (this._pendingDeployAction) {
      this._pendingDeployAction();
      this._pendingDeployAction = null;
    }
  }

  public onWarningConfirmationCancel(): void {
    this._pendingDeployAction = null;
  }

  private validateAndDeploy(isReadOnlyProcess: boolean, deployAction: () => void): void {
    // Skip validation for draft processes
    if (this.draft$.getValue()) {
      deployAction();
      return;
    }

    combineLatest([
      from(isReadOnlyProcess ? this._bpmnViewer.saveXML() : this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks]) => {
          const xml = this.applyDraftState(result?.xml ?? '') ?? '';
          return this.processManagementService.validateProcessDefinition({
            bpmnXml: xml,
            processLinks: processLinks.map(link => ({
              ...link,
              processDefinitionId: '-',
            })),
          });
        })
      )
      .subscribe({
        next: validationResult => {
          if (!validationResult.isValid) {
            // Has errors - show them and block deployment
            this.highlightValidationErrors(validationResult.errors);
          } else if (validationResult.hasWarnings) {
            // Only warnings - show confirmation dialog
            this.highlightValidationErrors(validationResult.errors);
            this._pendingDeployAction = deployAction;
            this.showWarningConfirmationModal$.next(true);
          } else {
            // No issues - proceed with deployment
            deployAction();
          }
        },
        error: () => {
          // Validation endpoint failed - proceed with deployment anyway (server will validate again)
          deployAction();
        },
      });
  }

  private setProcessManagementWindow(): void {
    const processManagementWindow = window as any as ProcessManagementWindow;

    if (!processManagementWindow) return;

    processManagementWindow.processManagementEditorService = this.processManagementEditorService;
    processManagementWindow.translateService = this.translateService;
    processManagementWindow.pluginTranslationService = this.pluginTranslationService;
  }

  private showNotification(
    notification:
      | null
      | 'success'
      | 'error'
      | 'alreadyExists'
      | 'validationError'
      | 'validationWarning'
      | 'validationSuccess'
  ): void {
    if (!notification) return;

    let type: 'success' | 'error' | 'warning';
    if (
      notification === 'alreadyExists' ||
      notification === 'validationError' ||
      notification === 'error'
    ) {
      type = 'error';
    } else if (notification === 'validationWarning') {
      type = 'warning';
    } else {
      type = 'success';
    }
    this.notificationService.showToast({
      caption: this.translateService.instant(`processManagement.${notification}Notification`),
      type,
      title: this.translateService.instant(`interface.${type}`),
    });
  }

  private isProcessDefinitionAlreadyExistsError(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse) || error.status !== 409) return false;
    const body = error.error;
    if ((body as ProcessDefinitionConflictResponse)?.processDefinitionId) return true;
    const bbBody = body as BuildingBlockProcessDefinitionConflictResponse;
    return (
      Array.isArray(bbBody?.duplicateProcessDefinitions) &&
      bbBody.duplicateProcessDefinitions.length > 0
    );
  }

  private applyDraftState(xml: string | null | undefined): string | null {
    if (!xml) return null;

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return xml;

    const executableValue = this.draft$.getValue() ? 'false' : 'true';
    const processes = doc.getElementsByTagNameNS('*', 'process');
    for (let i = 0; i < processes.length; i++) {
      processes[i].setAttribute('isExecutable', executableValue);
    }
    return new XMLSerializer().serializeToString(doc);
  }

  private parseDraftFromXml(xml: string | null | undefined): boolean {
    if (!xml) return false;

    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) return false;

    const processes = doc.getElementsByTagNameNS('*', 'process');
    if (processes.length === 0) return false;

    for (let i = 0; i < processes.length; i++) {
      if (processes[i].getAttribute('isExecutable') === 'true') return false;
    }
    return true;
  }

  private isValidationError(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse &&
      error.status === 422 &&
      Array.isArray(error.error?.errors)
    );
  }

  private highlightValidationErrors(errors: ProcessDefinitionValidationError[]): void {
    this.clearValidationErrors();
    this.processManagementEditorService.setValidationErrors(errors);

    const modeler = this.isReadOnlyProcess$.getValue() ? this._bpmnViewer : this._bpmnModeler;
    const canvas = modeler.get('canvas') as any;
    const overlays = modeler.get('overlays') as any;

    const errorElementIds = new Set<string>();

    const elementHasError = new Map<string, boolean>();
    const elementFirstIssue = new Map<string, ProcessDefinitionValidationError>();

    for (const error of errors) {
      if (error.elementType === 'Process') continue;

      const hasErrorAlready = elementHasError.get(error.elementId) ?? false;
      const isError = error.severity !== 'WARNING';

      if (!elementFirstIssue.has(error.elementId)) {
        elementFirstIssue.set(error.elementId, error);
      } else if (isError && !hasErrorAlready) {
        elementFirstIssue.set(error.elementId, error);
      }

      if (isError) {
        elementHasError.set(error.elementId, true);
      } else if (!hasErrorAlready) {
        elementHasError.set(error.elementId, false);
      }
    }

    for (const [elementId, issue] of elementFirstIssue) {
      try {
        const hasError = elementHasError.get(elementId) ?? false;
        const markerClass = hasError ? 'highlight-overlay-error' : 'highlight-overlay-warning';
        const overlayClass = hasError ? 'validation-error-overlay' : 'validation-warning-overlay';

        this._validationErrorElementIds.push(elementId);
        errorElementIds.add(elementId);
        canvas.addMarker(elementId, markerClass);

        const position =
          issue.elementType === 'Participant' ? {top: 5, left: 5} : {top: -12, left: -12};

        overlays.add(elementId, 'validation-error', {
          position,
          html: this.buildOverlayElement(
            overlayClass,
            elementId,
            this.getValidationErrorMessage(issue)
          ),
        });
      } catch (e) {
        // Element may not exist on the canvas
      }
    }

    const eventBus = modeler.get('eventBus') as any;
    this._validationHoverHandler = (event: any) => {
      const id = event.element?.id;
      if (id && errorElementIds.has(id)) {
        const errorOverlay = document.querySelector(
          `.validation-error-overlay[data-element-id="${id}"]`
        );
        const warningOverlay = document.querySelector(
          `.validation-warning-overlay[data-element-id="${id}"]`
        );
        errorOverlay?.classList.add('validation-error-overlay--active');
        warningOverlay?.classList.add('validation-warning-overlay--active');
      }
    };
    this._validationOutHandler = (event: any) => {
      const id = event.element?.id;
      if (id && errorElementIds.has(id)) {
        const errorOverlay = document.querySelector(
          `.validation-error-overlay[data-element-id="${id}"]`
        );
        const warningOverlay = document.querySelector(
          `.validation-warning-overlay[data-element-id="${id}"]`
        );
        errorOverlay?.classList.remove('validation-error-overlay--active');
        warningOverlay?.classList.remove('validation-warning-overlay--active');
      }
    };
    eventBus.on('element.hover', this._validationHoverHandler);
    eventBus.on('element.out', this._validationOutHandler);

    const selection = modeler.get('selection') as any;
    const selected = selection.get();
    if (selected?.length > 0) {
      const current = selected[0];
      selection.deselect(current);
      selection.select(current);
    }
  }

  private clearValidationErrors(): void {
    const modeler = this.isReadOnlyProcess$.getValue() ? this._bpmnViewer : this._bpmnModeler;

    if (!modeler) return;

    this.processManagementEditorService.setValidationErrors([]);

    const canvas = modeler.get('canvas') as any;
    const overlays = modeler.get('overlays') as any;

    const eventBus = modeler.get('eventBus') as any;
    if (this._validationHoverHandler) {
      eventBus.off('element.hover', this._validationHoverHandler);
      this._validationHoverHandler = null;
    }
    if (this._validationOutHandler) {
      eventBus.off('element.out', this._validationOutHandler);
      this._validationOutHandler = null;
    }

    for (const elementId of this._validationErrorElementIds) {
      try {
        canvas.removeMarker(elementId, 'highlight-overlay-error');
        canvas.removeMarker(elementId, 'highlight-overlay-warning');
      } catch (e) {
        // ignore
      }
    }
    this._validationErrorElementIds = [];

    try {
      overlays.remove({type: 'validation-error'});
    } catch (e) {
      // ignore
    }
  }

  private setSelectedProcessDefinitionToLatest(
    processDefinitions: ProcessDefinitionWithPropertiesDto[]
  ): void {
    const latest = getLatestProcessDefinition(processDefinitions);

    if (!latest) return;

    this.processManagementEditorService.setSelectedProcessDefinition(latest);
  }

  private initModeler(): void {
    this._bpmnModeler = new Modeler({
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        CamundaPlatformPropertiesProviderModule,
        camundaPlatformBehaviors,
        ValtimoPropertiesProviderModule,
      ],
      moddleExtensions: {camunda: CamundaBpmnModdle},
      propertiesPanel: {parent: this.modelerPanelElementRef.nativeElement},
    });

    this._bpmnModeler?.attachTo(this.modelerElementRef.nativeElement);

    this._bpmnModeler.on('commandStack.changed', () => {
      this.changesPending$.next(true);
    });

    this._bpmnModeler.on('import.done', () => {
      const idMap: Record<string, string> = {};
      const elementRegistry = this._bpmnModeler.get('elementRegistry') as any;

      elementRegistry.forEach((element: any) => {
        const activityId = element?.di?.id;
        const businessId = element?.id;

        if (!activityId || !businessId) return;

        idMap[activityId] = businessId;
      });

      this.processManagementEditorService.setActivityIdBusinessIdMap(idMap);
      this.listenToActivityChangesOnModeler();
    });
  }

  private initViewer(): void {
    this._bpmnViewer = new Modeler({
      additionalModules: [
        DisableBpmnWriteModule,
        BpmnPropertiesPanelModule,
        ValtimoPropertiesProviderModule,
      ],
      moddleExtensions: {camunda: CamundaBpmnModdle},
      propertiesPanel: {parent: this.viewerPanelElementRef.nativeElement},
    });

    this._bpmnViewer?.attachTo(this.viewerElementRef.nativeElement);

    this._bpmnViewer.on('commandStack.changed', () => {
      this.changesPending$.next(true);
    });

    this._bpmnViewer.on('import.done', () => {
      disableCommands(this._bpmnViewer);
    });
  }

  private reload(): void {
    this._reload$.next(null);
  }

  private handleUpdateEvent(event: OpenProcessLinkModalEvent): void {
    this.modalService.setModalData(event?.modalParams);
    this.processLinkStateService.setModalParams(event?.modalParams);
    this.processLinkStateService.setElementName(event?.modalParams?.element?.name ?? '');
    this.processLinkStateService.selectProcessLink(event.processLink);
    this.processLinkStateService.showModal();
  }

  private handleCreateEvent(event: OpenProcessLinkModalEvent): void {
    this.processLinkService
      .getProcessLinkCandidates(event.modalParams.element.activityListenerType ?? '')
      .subscribe(candidates => {
        this.modalService.setModalData(event?.modalParams);
        this.processLinkStateService.setModalParams(event?.modalParams);
        this.processLinkStateService.setElementName(event?.modalParams?.element?.name ?? '');
        this.processLinkStateService.setAvailableProcessLinkTypes(candidates);
        this.processLinkStateService.showModal();
      });
  }

  private subscribeToOpenProcessLinkModalEvents(): void {
    this._subscriptions.add(
      this.processManagementEditorService.openProcessLinkModalEvents$.subscribe(event => {
        if (event.processLink) {
          this.handleUpdateEvent(event);
        } else {
          this.handleCreateEvent(event);
        }
      })
    );
  }

  private subscribeToProcessLinkUpdateEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkUpdateEvents$.subscribe(event => {
        this.processManagementEditorService.updateProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();

        const buildingBlockProcessLinkUpdateDto = event as BuildingBlockProcessLinkUpdateDto;

        if (
          buildingBlockProcessLinkUpdateDto.buildingBlockDefinitionKey &&
          buildingBlockProcessLinkUpdateDto.buildingBlockDefinitionVersionTag
        ) {
          this.setCalledElementForBuildingBlockProcessLink(
            buildingBlockProcessLinkUpdateDto.activityId,
            buildingBlockProcessLinkUpdateDto.buildingBlockDefinitionKey,
            buildingBlockProcessLinkUpdateDto.buildingBlockDefinitionVersionTag
          );
        }
      })
    );
  }

  private subscribeToProcessLinkCreateEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkCreateEvents$.subscribe(event => {
        this.processManagementEditorService.createProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();

        const buildingBlockProcessLinkCreateDto = event as BuildingBlockProcessLinkCreateDto;

        if (
          buildingBlockProcessLinkCreateDto.buildingBlockDefinitionKey &&
          buildingBlockProcessLinkCreateDto.buildingBlockDefinitionVersionTag
        ) {
          this.setCalledElementForBuildingBlockProcessLink(
            buildingBlockProcessLinkCreateDto.activityId,
            buildingBlockProcessLinkCreateDto.buildingBlockDefinitionKey,
            buildingBlockProcessLinkCreateDto.buildingBlockDefinitionVersionTag
          );
        }
      })
    );
  }

  private subscribeToProcessLinkDeleteEvents(): void {
    this._subscriptions.add(
      merge(
        this.processManagementEditorService.deleteProcessLinkEvents$,
        this.processLinkStateService.processLinkDeleteEvents$
      ).subscribe(event => {
        this.processManagementEditorService.deleteProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();

        this.unsetCalledElementForBuildingBlockProcessLink(event.activityId);
      })
    );
  }

  private initIfCreate(): void {
    if (this._selectedProcess$.getValue() !== 'create') return;

    this.creatingNewProcess$.next(true);
    this._bpmnModeler?.importXML(EMPTY_BPMN);
    this.isReadOnlyProcess$.next(false);
    this.isSystemProcess$.next(false);
    this.loading$.next(false);
  }

  private shapeAddedHandler = (event: any): void => {
    this.logger.debug('Shape added:', event);
  };

  private shapeRemovedHandler = (event: any): void => {
    this.logger.debug('Shape removed:', event);

    const activityId = event?.element?.id;

    if (!activityId) return;

    this.processManagementEditorService.deleteProcessLink({activityId});
  };

  private elementChangedHandler = (event: any): void => {
    this.logger.debug('Element changed:', event);

    const activityId = event?.element?.di?.id;
    const businessId = event?.element?.id;

    if (!activityId || !businessId) return;

    this.processManagementEditorService.updateProcessLinksOnIdChange(activityId, businessId);
  };

  private listenToActivityChangesOnModeler(): void {
    const eventBus = this._bpmnModeler.get('eventBus') as any;

    if (!eventBus) return;

    eventBus.on('shape.added', this.shapeAddedHandler);
    eventBus.on('shape.removed', this.shapeRemovedHandler);
    eventBus.on('element.changed', this.elementChangedHandler);
  }

  private cleanUpListenersOnModeler(): void {
    const eventBus = this._bpmnModeler.get('eventBus') as any;

    if (!eventBus) return;

    eventBus.off('shape.added', this.shapeAddedHandler);
    eventBus.off('shape.removed', this.shapeRemovedHandler);
    eventBus.off('element.changed', this.elementChangedHandler);
  }

  private initProcessDefinition(): void {
    this._subscriptions.add(
      this._selectedProcess$
        .pipe(
          filter(selectedProcess => selectedProcess !== null && selectedProcess !== 'create'),
          distinctUntilChanged((previous, current) => isEqual(previous, current)),
          tap(() => this.loading$.next(true))
        )
        .subscribe(result => {
          const processDefinitionResult = result as ProcessDefinitionResult;

          this.cleanUpListenersOnModeler();

          this._bpmnModeler?.importXML(processDefinitionResult.bpmn20Xml);
          this._bpmnViewer?.importXML(processDefinitionResult.bpmn20Xml);

          this.draft$.next(
            processDefinitionResult.draft ??
              this.parseDraftFromXml(processDefinitionResult.bpmn20Xml)
          );
          this.canInitializeDocument$.next(
            !!processDefinitionResult?.processCaseLink?.canInitializeDocument
          );
          this.startableByUser$.next(!!processDefinitionResult?.processCaseLink?.startableByUser);

          this.loading$.next(false);
        })
    );
  }

  private openParamsAndContextSubscription(): void {
    this._subscriptions.add(
      combineLatest([
        getContextObservable(this.route),
        getCaseManagementRouteParams(this.route),
        getBuildingBlockManagementRouteParams(this.route),
      ]).subscribe(([context, caseManagementParams, buildingBlockManagementParams]) => {
        if (context) this.processManagementService.context = context;

        this.processLinkStateService.setContext(context);

        if (caseManagementParams) {
          this.processManagementService.setParams(
            caseManagementParams.caseDefinitionKey,
            caseManagementParams.caseDefinitionVersionTag
          );
        }

        if (buildingBlockManagementParams) {
          this.processManagementService.setParams(
            buildingBlockManagementParams.buildingBlockDefinitionKey,
            buildingBlockManagementParams.buildingBlockDefinitionVersionTag
          );
        }

        initBreadcrumbsForContext(
          this.breadcrumbService,
          this.translateService,
          caseManagementParams || buildingBlockManagementParams,
          context as ManagementContext
        );

        this.processManagementEditorService.setManagementRouteParams(
          context,
          caseManagementParams || buildingBlockManagementParams
        );
      })
    );
  }

  private initEditing(): void {
    combineLatest([this.editParam$, this.managementParams$.pipe(startWith(null)), this.context$])
      .pipe(
        take(1),
        switchMap(([editParam, params, context]) => {
          if (editParam === 'create') {
            this._selectedProcess$.next('create');
            this.initIfCreate();

            return of(null);
          }

          switch (context) {
            case 'case':
              const caseManagementParams = params as CaseManagementParams;
              return this.processManagementService.getProcessDefinitionForCase(
                caseManagementParams.caseDefinitionKey,
                caseManagementParams.caseDefinitionVersionTag,
                editParam
              );
            case 'independent':
              return this.processManagementService
                .getUnlinkedProcessDefinitionsByKey(editParam)
                .pipe(map(processDefinitionResults => processDefinitionResults[0]));
            case 'buildingBlock':
              const buildingBlockParams = params as BuildingBlockManagementParams;
              return this.processManagementService.getBuildingBlockProcessDefinition(
                buildingBlockParams.buildingBlockDefinitionKey,
                buildingBlockParams.buildingBlockDefinitionVersionTag,
                editParam
              );
          }
        }),
        tap(res => {
          if (res) {
            this._selectedProcess$.next(res);
            this.processManagementEditorService.setSelectedProcessDefinition(res.processDefinition);
            this.processManagementEditorService.setProcessLinksForSelectedDefinition(
              res.processLinks
            );
            this.pageTitleService.setCustomPageTitle(res.processDefinition.name || '-');
          }

          this.initProcessDefinition();
        })
      )
      .subscribe();
  }

  private setCalledElementForBuildingBlockProcessLink(
    activityId: string,
    buildingBlockDefinitionKey: string,
    buildingBlockDefinitionVersionTag: string
  ): void {
    const editor = this._bpmnModeler || this._bpmnViewer;

    if (!editor) {
      return;
    }

    this.processLinkBuildingBlockApiService
      .getMainProcessDefinitionKeyForBuildingBlock(
        buildingBlockDefinitionKey,
        buildingBlockDefinitionVersionTag
      )
      .subscribe({
        next: (mainProcessDefinitionKey: string) => {
          const versionTag = `BB:${buildingBlockDefinitionKey}:${buildingBlockDefinitionVersionTag}`;

          applyBuildingBlockCalledElement(editor, activityId, mainProcessDefinitionKey, versionTag);
        },
      });
  }

  private unsetCalledElementForBuildingBlockProcessLink(activityId: string): void {
    const editor = this._bpmnModeler || this._bpmnViewer;

    if (!editor) {
      return;
    }

    clearBuildingBlockCalledElement(editor, activityId);
  }

  public getValidationErrorMessage(error: {
    reason: string;
    errorCode?: string;
    expression?: string;
  }): string {
    if (error.errorCode) {
      const translationKey = `processManagement.expressionErrors.${error.errorCode}`;
      const translated = this.translateService.instant(translationKey);
      if (translated !== translationKey) {
        return error.expression ? `${translated}: '${error.expression}'` : translated;
      }
    }
    return error.reason;
  }

  private buildOverlayElement(
    overlayClass: string,
    elementId: string,
    message: string
  ): HTMLElement {
    const container = document.createElement('div');
    container.className = overlayClass;
    container.dataset.elementId = elementId;

    const icon = document.createElement('span');
    icon.className = `${overlayClass}__icon`;
    icon.textContent = '!';
    container.appendChild(icon);

    const text = document.createElement('span');
    text.className = `${overlayClass}__text`;
    text.textContent = message;
    container.appendChild(text);

    return container;
  }
}
