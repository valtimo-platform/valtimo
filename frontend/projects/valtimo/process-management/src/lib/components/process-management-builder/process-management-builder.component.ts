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
  PendingChangesComponent,
  RenderInPageHeaderDirective,
} from '@valtimo/components';
import {
  CaseManagementParams,
  EditPermissionsService,
  getCaseManagementRouteParams,
  getCaseManagementRouteParamsAndContext,
  GlobalNotificationService,
  ManagementContext,
} from '@valtimo/shared';
import {ProcessDefinition, ProcessService} from '@valtimo/process';
import {
  ProcessLinkButtonService,
  ProcessLinkCreateEvent,
  ProcessLinkEditMode,
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
import {getContextObservable} from '../../utils';
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
export class ProcessManagementBuilderComponent
  extends PendingChangesComponent
  implements AfterViewInit, OnDestroy
{
  @ViewChild('modeler', {static: false}) modelerElementRef!: ElementRef;
  @ViewChild('modelerPanel', {static: false}) modelerPanelElementRef!: ElementRef;
  @ViewChild('viewer', {static: false}) viewerElementRef!: ElementRef;
  @ViewChild('viewerPanel', {static: false}) viewerPanelElementRef!: ElementRef;

  private readonly _selectedProcess$ = new BehaviorSubject<
    ProcessDefinitionResult | 'create' | null
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
        this.pageTitleService.setCustomPageTitle(selectedProcessDefinition.name);
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
      return param ? param : null;
    }),
    filter(editParam => !!editParam)
  );

  public readonly context$ = getContextObservable(this.route);

  public readonly managementParams$ = this.context$.pipe(
    filter(context => context === 'case'),
    switchMap(() => getCaseManagementRouteParams(this.route))
  );

  public readonly params$: Observable<any> | undefined = getCaseManagementRouteParams(this.route);

  public readonly hasEditPermissions$: Observable<boolean> = combineLatest([
    this.params$,
    this.context$,
  ]).pipe(
    switchMap(([params, context]) =>
      this.editPermissionsService.hasPermissionsToEditBasedOnContext(
        params?.caseDefinitionKey,
        params?.caseDefinitionVersionTag,
        context
      )
    )
  );

  private readonly _reload$ = new Subject<null>();

  public readonly processDefinitionVersions$: Observable<ProcessDefinition[]> = combineLatest([
    this.editParam$,
    this.context$,
    this._reload$.pipe(startWith(null)),
  ]).pipe(
    switchMap(([editParam, context]) =>
      context === 'independent'
        ? this.processManagementService.getUnlinkedProcessDefinitionsByKey(editParam)
        : of([] as ProcessDefinitionResult[])
    ),
    map(result => result.map(resultItem => resultItem.processDefinition)),
    tap(processDefinitions => {
      this.changesPending$.next(false);
      this.pendingChanges = false;
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

  public readonly $extraSpace: Signal<number> = computed(() =>
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
    private readonly editPermissionsService: EditPermissionsService
  ) {
    super();
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
    this.processLinkStateService.setEditMode(ProcessLinkEditMode.EMIT_EVENTS);
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
            return this.processLinkService.deployProcessWithProcessLinksForCase(
              processLinks as ProcessLinkCreateEvent[],
              selectedProcessDefinition.id,
              !isReadOnlyProcess ? (result?.xml ?? '') : null,
              params?.caseDefinitionKey ?? '',
              params?.caseDefinitionVersionTag ?? '',
              this.canInitializeDocument$.getValue(),
              this.startableByUser$.getValue()
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
            this.pendingChanges = false;
            this.reload();
            this.showNotification('success');
          } else {
            this.pendingChanges = false;
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

          return context === 'independent'
            ? this.processLinkService.deployProcessWithProcessLinks(
                mappedProcessLinks,
                null,
                result.xml ?? ''
              )
            : this.processLinkService.deployProcessWithProcessLinksForCase(
                mappedProcessLinks,
                null,
                result.xml ?? '',
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag,
                this.canInitializeDocument$.getValue(),
                this.startableByUser$.getValue()
              );
        })
      )
      .subscribe({
        next: () => {
          this.pendingChanges = false;
          this.navigateBack('success');
        },
        error: () => {
          this.showNotification('error');
        },
      });
  }

  public selectedVersionChange(event: {item: {processDefinitionVersion: ProcessDefinition}}): void {
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

  private setSelectedProcessDefinitionToLatest(processDefinitions: ProcessDefinition[]): void {
    if ((processDefinitions || []).length === 0) return;

    const latest = processDefinitions.reduce((acc, version) =>
      version.version > acc.version ? version : acc
    );

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
      this.pendingChanges = true;
    });

    this._bpmnModeler.on('import.done', () => {
      const idMap: Record<string, string> = {};
      const elementRegistry = this._bpmnModeler.get('elementRegistry') as any;

      elementRegistry.forEach(element => {
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
    const disableCommands = () => {
      const commandStack = this._bpmnViewer.get('commandStack') as any;
      const originalExecute = commandStack?.execute?.bind(commandStack);

      if (commandStack?.execute) {
        commandStack.execute = (command: string, context: any) => {
          if (
            command === 'elements.delete' ||
            command === 'elements.copy' ||
            command === 'elements.paste' ||
            command === 'elements.create'
          ) {
            return;
          }
          originalExecute(command, context);
        };
      }
    };

    const DisableBpmnWriteModule = {
      paletteProvider: ['value', {}],
      contextPadProvider: ['value', {}],
      directEditing: [
        'value',
        {
          registerProvider: () => {},
          activate: () => {},
          deactivate: () => {},
          isActive: () => false,
        },
      ],
      move: ['value', null],
      resizeHandles: ['value', {addResizer: () => {}, removeResizers: () => {}}],
    };

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
      this.pendingChanges = true;
    });

    this._bpmnViewer.on('import.done', () => {
      disableCommands();
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
      })
    );
  }

  private subscribeToProcessLinkCreateEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkCreateEvents$.subscribe(event => {
        this.processManagementEditorService.createProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
      })
    );
  }

  private subscribeToProcessLinkDeleteEvents(): void {
    this._subscriptions.add(
      this.processLinkStateService.processLinkDeleteEvents$.subscribe(event => {
        this.processManagementEditorService.deleteProcessLink(event);
        this.processLinkStateService.stopSaving();
        this.processLinkStateService.closeModal();
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
      getCaseManagementRouteParamsAndContext(this.route).subscribe(([context, params]) => {
        if (context) this.processManagementService.context = context;

        if (params) {
          this.processManagementService.setParams(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag
          );
        }

        this.initBreadcrumbs(params, context);
        this.processManagementEditorService.setCaseManagementRouteParams(context, params);
      })
    );
  }

  private initBreadcrumbs(params: CaseManagementParams, context: ManagementContext): void {
    if (context === 'independent') return;

    const route = `/case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [route],
      content: `${params.caseDefinitionKey} (${params.caseDefinitionVersionTag})`,
      href: route,
    });

    const routeWithForms = `${route}/processes`;

    this.breadcrumbService.setFourthBreadcrumb({
      route: [routeWithForms],
      content: this.translateService.instant('caseManagement.tabs.processes'),
      href: routeWithForms,
    });
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

          return context === 'case'
            ? this.processManagementService.getProcessDefinitionForCase(
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag,
                editParam
              )
            : this.processManagementService
                .getUnlinkedProcessDefinitionsByKey(editParam)
                .pipe(map(processDefinitionResults => processDefinitionResults[0]));
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
}
