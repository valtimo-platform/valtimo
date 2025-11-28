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
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  OnDestroy,
  Signal,
  ViewChild,
} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  FitPageDirective,
  ModalService,
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
  BuildingBlockProcessLinkCreateDto,
  BuildingBlockProcessLinkUpdateDto,
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
  DialogModule,
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
import {EMPTY_BPMN} from '../../constants';
import {
  OpenProcessLinkModalEvent,
  ProcessDefinitionResult,
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
    DialogModule,
    ToggleModule,
    TooltipModule,
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

  public readonly isReadOnlyProcess$ = new BehaviorSubject<boolean>(false);
  public readonly isSystemProcess$ = new BehaviorSubject<boolean>(false);

  public readonly canInitializeDocument$ = new BehaviorSubject<boolean>(false);
  public readonly startableByUser$ = new BehaviorSubject<boolean>(false);

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

  public readonly hasEditPermissions$: Observable<boolean> = combineLatest([
    this.managementParams$,
    this.context$,
  ]).pipe(
    switchMap(([params, context]) =>
      this.editPermissionsService.hasPermissionsToEditBasedOnContext(params, context)
    )
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

  public readonly $spaceAdjustment: Signal<number> = computed(() =>
    this.processManagementService.$context() === 'case' ? 0 : 0
  );

  public readonly updatingProcessDefinitionCaseDefinition$ = new BehaviorSubject<boolean>(false);

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
    this.setProcessManagementWindow();
  }

  public ngAfterViewInit(): void {
    this.pageTitleService.disableReset();
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
    this._bpmnModeler?.destroy();
    this._bpmnViewer?.destroy();
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
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

  public deployChanges(isReadOnlyProcess: boolean): void {
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
          if (context === 'case') {
            const caseManagementParams = params as CaseManagementParams;

            return this.processLinkService.deployProcessWithProcessLinksForCase(
              processLinks as ProcessLinkCreateEvent[],
              selectedProcessDefinition.id,
              !isReadOnlyProcess ? (result?.xml ?? '') : null,
              caseManagementParams?.caseDefinitionKey ?? '',
              caseManagementParams?.caseDefinitionVersionTag ?? '',
              this.canInitializeDocument$.getValue(),
              this.startableByUser$.getValue()
            );
          }

          if (context === 'buildingBlock') {
            const buildingBlockManagementParams = params as BuildingBlockManagementParams;

            return this.processLinkService.deployProcessWithProcessLinksForBuildingBlock(
              processLinks as ProcessLinkCreateEvent[],
              selectedProcessDefinition.id,
              result?.xml,
              buildingBlockManagementParams.buildingBlockDefinitionKey,
              buildingBlockManagementParams.buildingBlockDefinitionVersionTag
            );
          }

          return this.processLinkService.deployProcessWithProcessLinks(
            processLinks as ProcessLinkCreateEvent[],
            selectedProcessDefinition.id,
            !isReadOnlyProcess ? (result?.xml ?? '') : null
          );
        }),
        switchMap(() => this.context$)
      )
      .subscribe({
        next: context => {
          if (context === 'independent') {
            this.reload();
            this.showNotification('success');
          } else {
            this.navigateBack('success');
          }
        },
        error: () => {
          this.showNotification('error');
        },
      });
  }

  public deployNewProcessDefinition(): void {
    combineLatest([
      from(this._bpmnModeler.saveXML()),
      this.processManagementEditorService.processLinksForSelectedDefinition$,
      this.context$,
      this.managementParams$.pipe(startWith(null)),
    ])
      .pipe(
        take(1),
        switchMap(([result, processLinks, context, params]) => {
          const mappedProcessLinks = processLinks.map(link => ({
            ...link,
            processDefinitionId: '-',
          })) as ProcessLinkCreateEvent[];

          switch (context) {
            case 'independent':
              return this.processLinkService.deployProcessWithProcessLinks(
                mappedProcessLinks,
                null,
                result.xml ?? ''
              );
            case 'buildingBlock':
              const buildingBlockParams = params as BuildingBlockManagementParams;
              return this.processLinkService.deployProcessWithProcessLinksForBuildingBlock(
                mappedProcessLinks,
                null,
                result.xml ?? '',
                buildingBlockParams.buildingBlockDefinitionKey,
                buildingBlockParams.buildingBlockDefinitionVersionTag
              );
            case 'case':
              const caseManagementParams = params as CaseManagementParams;
              return this.processLinkService.deployProcessWithProcessLinksForCase(
                mappedProcessLinks,
                null,
                result.xml ?? '',
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
          this.navigateBack('success');
        },
        error: () => {
          this.showNotification('error');
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

  public onProcessToggleChange(
    field: keyof UpdateProcessDefinitionCaseDefinitionRequest,
    value: boolean
  ): void {
    if (field === 'canInitializeDocument') this.canInitializeDocument$.next(value);
    if (field === 'startableByUser') this.startableByUser$.next(value);
    this.changesPending$.next(true);
  }

  private setProcessManagementWindow(): void {
    const processManagementWindow = window as any as ProcessManagementWindow;

    if (!processManagementWindow) return;

    processManagementWindow.processManagementEditorService = this.processManagementEditorService;
    processManagementWindow.translateService = this.translateService;
    processManagementWindow.pluginTranslationService = this.pluginTranslationService;
  }

  private showNotification(notification: null | 'success' | 'error'): void {
    this.notificationService.showToast({
      caption: this.translateService.instant(`processManagement.${notification}Notification`),
      type: notification,
      title: this.translateService.instant(`interface.${notification}`),
    });
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
      this.processLinkStateService.processLinkDeleteEvents$.subscribe(event => {
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
}
