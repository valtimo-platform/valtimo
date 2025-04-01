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
import {DOCUMENT} from '@angular/common';
import {
  AfterViewInit,
  Component,
  ComponentFactoryResolver,
  ElementRef,
  Inject,
  OnDestroy,
  Renderer2,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute, NavigationStart, ParamMap, Params, Router} from '@angular/router';
import {ChevronDown16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {PermissionService} from '@valtimo/access-control';
import {
  BreadcrumbService,
  CARBON_CONSTANTS,
  CdsThemeService,
  CurrentCarbonTheme,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
} from '@valtimo/components';
import {ConfigService} from '@valtimo/config';
import {
  CaseStatusService,
  Document as ValtimoDocument,
  DocumentService,
  InternalCaseStatus,
  InternalCaseStatusUtils,
  ProcessDefinitionCaseDefinition,
} from '@valtimo/document';
import {TaskWithProcessLink} from '@valtimo/process-link';
import {UserProviderService} from '@valtimo/security';
import {IntermediateSubmission} from '@valtimo/task';
import {IconService, NotificationService} from 'carbon-components-angular';
import {KeycloakService} from 'keycloak-angular';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  combineLatest,
  filter,
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
import {TabImpl, TabLoaderImpl} from '../../models';
import {
  CAN_ASSIGN_CASE_PERMISSION,
  CAN_CLAIM_CASE_PERMISSION,
  CAN_DELETE_CASE_PERMISSION,
  CAN_VIEW_CASE_PERMISSION,
  CASE_DETAIL_PERMISSION_RESOURCE,
} from '../../permissions';
import {WidgetsService} from './tab/widgets/widgets.service';
import {
  CASE_DETAIL_DEFAULT_DISPLAY_SIZE,
  CASE_DETAIL_DEFAULT_DISPLAY_TYPE,
  CASE_DETAIL_GUTTER_SIZE,
  CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH,
} from '../../constants';
import {CaseDetailLayoutService, CaseService, CaseTabService} from '../../services';
import {CaseSupportingProcessStartModalComponent} from '../case-supporting-process-start-modal/case-supporting-process-start-modal.component';

@Component({
  templateUrl: './case-detail.component.html',
  styleUrls: ['./case-detail.component.scss'],
  providers: [CaseTabService, CaseDetailLayoutService, NotificationService],
})
export class CaseDetailComponent
  extends PendingChangesComponent
  implements AfterViewInit, OnDestroy
{
  @ViewChild('supportingProcessStartModal')
  supportingProcessStart: CaseSupportingProcessStartModalComponent;

  @ViewChild('tabContainer', {read: ViewContainerRef})
  viewContainerRef: ViewContainerRef;

  @ViewChild('tabContentContainer')
  private readonly _tabContentContainer!: ElementRef<HTMLDivElement>;

  public customCaseHeaderItems: Array<any> = [];
  public document: ValtimoDocument | null = null;
  public caseDefinitionKey: string;
  public documentDefinitionTitle: string;
  public documentId: string;
  public processDefinitionListFields: Array<any> = [];
  public processDefinitionCaseDefinitions: (ProcessDefinitionCaseDefinition & {
    displayName?: string;
  })[] = [];
  public tabLoader: TabLoaderImpl | null = null;

  public readonly assigneeId$ = new BehaviorSubject<string>('');
  public readonly currentIntermediateSave$ = new BehaviorSubject<IntermediateSubmission | null>(
    null
  );
  public readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));

  public readonly taskAndProcessLinkOpenedInPanel$ =
    this.caseDetailLayoutService.taskAndProcessLinkOpenedInPanel$;

  private readonly _caseStatusKey$ = new BehaviorSubject<string | null | 'NOT_AVAILABLE'>(null);

  public readonly dropdownWidth$ = new BehaviorSubject<number>(
    CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH.small
  );
  public readonly caseStatusKey$: Observable<string | 'NOT_AVAILABLE'> = this._caseStatusKey$.pipe(
    filter(key => !!key)
  );

  public readonly showDeleteModal$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  public readonly canView$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_VIEW_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: params.get('documentId') ?? '',
      })
    )
  );

  public readonly document$: Observable<ValtimoDocument | null> = combineLatest([
    this.caseService.refreshDocument$,
    this.canView$,
  ]).pipe(
    filter(([_, canView]) => canView),
    switchMap(() => this.route.params),
    map((params: Params) => params?.documentId),
    switchMap((documentId: string) =>
      documentId ? this.documentService.getDocument(this.documentId) : of(null)
    ),
    tap((document: ValtimoDocument | null) => {
      if (document) {
        this.assigneeId$.next(document.assigneeId);
        this.document = document;
        this._caseStatusKey$.next(document?.internalStatus || 'NOT_AVAILABLE');

        if (
          this.configService.config.customCaseHeader?.hasOwnProperty(
            this.caseDefinitionKey.toLowerCase()
          ) &&
          this.customCaseHeaderItems.length === 0
        ) {
          this.configService.config.customCaseHeader[this.caseDefinitionKey.toLowerCase()]?.forEach(
            item => this.getCustomCaseHeaderItem(item)
          );
        }
      }
    })
  );

  public readonly caseDefinitionKey$: Observable<string> = this.route.params.pipe(
    map(params => params.caseDefinitionKey || '')
  );

  public readonly caseStatus$: Observable<InternalCaseStatus | undefined> =
    this.caseDefinitionKey$.pipe(
      filter(caseDefinitionKey => !!caseDefinitionKey),
      switchMap(caseDefinitionKey =>
        combineLatest([
          this.caseStatusService.getInternalCaseStatuses(caseDefinitionKey),
          this.caseStatusKey$,
        ])
      ),
      map(
        ([statuses, key]) => key !== 'NOT_AVAILABLE' && statuses.find(status => status?.key === key)
      ),
      map(
        status =>
          status && {
            ...status,
            tagType: InternalCaseStatusUtils.getTagTypeFromInternalCaseStatusColor(status.color),
          }
      )
    );

  public readonly userId$: Observable<string | undefined> = of(
    this.keyCloakService.isLoggedIn()
  ).pipe(
    switchMap(() => this.keyCloakService.loadUserProfile()),
    map(profile => profile?.id)
  );

  public readonly isAssigning$ = new BehaviorSubject<boolean>(false);
  public readonly isAssignedToCurrentUser$: Observable<boolean> = combineLatest([
    this.assigneeId$,
    this.userId$,
  ]).pipe(
    map(([assigneeId, userId]) => !!assigneeId && !!userId && assigneeId === userId),
    startWith(true)
  );

  public readonly canHaveAssignee$: Observable<boolean> = this.caseDefinitionKey$.pipe(
    switchMap(caseDefinitionKey => this.documentService.getCaseSettings(caseDefinitionKey)),
    map(caseSettings => caseSettings?.canHaveAssignee)
  );

  public readonly canAssignLoaded$ = new BehaviorSubject<boolean>(false);
  public readonly canAssign$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_ASSIGN_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: params.get('documentId') ?? '',
      })
    ),
    tap(() => {
      this.canAssignLoaded$.next(true);
    })
  );

  public readonly canClaim$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_CLAIM_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: params.get('documentId') ?? '',
      })
    )
  );

  public readonly isDeleting$ = new BehaviorSubject<boolean>(false);
  public readonly canDelete$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_DELETE_CASE_PERMISSION, {
        resource: CASE_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: params.get('documentId') ?? '',
      })
    )
  );

  public readonly loadingTabs$ = new BehaviorSubject<boolean>(true);
  public readonly noTabsConfigured$ = new BehaviorSubject<boolean>(false);
  public readonly showNoAccess$ = new BehaviorSubject<boolean>(false);
  public activeTab$: Observable<TabImpl>;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly tabHorizontalOverflowDisabled = this.caseTabService.tabHorizontalOverflowDisabled;

  public readonly showTaskList$ = this.caseTabService.showTaskList$;

  private readonly _activeTabName$ = new BehaviorSubject<string | null>(null);
  public get activeTabName$(): Observable<string | null> {
    return combineLatest([this.route.paramMap, this._activeTabName$]).pipe(
      map(([paramMap, activeTabName]) =>
        !activeTabName ? (paramMap.get('tab') ?? null) : activeTabName
      )
    );
  }

  public readonly CASE_DETAIL_GUTTER_SIZE = CASE_DETAIL_GUTTER_SIZE;

  public readonly caseDetailLayout$ = this.caseDetailLayoutService.caseDetailLayout$;

  public readonly openTaskAndProcessLinkInModal$ = new Subject<TaskWithProcessLink>();

  public readonly isDarkMode$ = this.cdsThemeService.currentTheme$.pipe(
    map(currentTheme => currentTheme === CurrentCarbonTheme.G90)
  );

  private _snapshot: ParamMap;
  private _initialTabName: string;
  private _activeChange = false;
  private _oldTabName: string;
  private _pendingTab: TabImpl;
  private _observer!: ResizeObserver;
  private _tabsInit = false;
  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly caseStatusService: CaseStatusService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly caseDetailLayoutService: CaseDetailLayoutService,
    private readonly caseService: CaseService,
    private readonly caseTabService: CaseTabService,
    private readonly iconService: IconService,
    private readonly keyCloakService: KeycloakService,
    private readonly logger: NGXLogger,
    private readonly notificationService: NotificationService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageTitleService: PageTitleService,
    private readonly permissionService: PermissionService,
    private readonly translateService: TranslateService,
    private readonly renderer: Renderer2,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly widgetsService: WidgetsService,
    private readonly userProviderService: UserProviderService,
    @Inject(DOCUMENT) private readonly htmlDocument: Document
  ) {
    super();
    this._snapshot = this.route.snapshot.paramMap;
    this.caseDefinitionKey = this._snapshot.get('caseDefinitionKey') || '';
    this.documentId = this._snapshot.get('documentId') || '';
  }

  public ngAfterViewInit(): void {
    this.initTabLoader();
    this.initBreadcrumb();
    this.openWidthObserver();
    this.pageTitleService.disableReset();
    this.iconService.registerAll([ChevronDown16]);
    this.setDocumentStyle();
    this.enableResetOnBackNavigation();
    this.openWidgetProcessSubscription();
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
    this.pageTitleService.enableReset();
    this.removeDocumentStyle();
    this._subscriptions.unsubscribe();
  }

  public getAllAssociatedProcessDefinitions(): void {
    this._subscriptions.add(
      combineLatest([
        this.documentService.findProcessDefinitionCaseDefinitionsForDocument(this.documentId, {
          startableByUser: true,
        }),
        this.translateService.stream('key'),
      ]).subscribe(([processDefinitionCaseDefinitions]) => {
        this.processDefinitionCaseDefinitions = this.mapProcessDocumentDefinitions(
          processDefinitionCaseDefinitions
        );
        this.setProcessDropdownWidth();

        this.processDefinitionListFields = [
          {
            key: 'processName',
            label: 'Proces',
          },
        ];
      })
    );
  }

  public startProcess(processDefinitionCaseDefinition: ProcessDefinitionCaseDefinition): void {
    this.supportingProcessStart.openModal(processDefinitionCaseDefinition, this.documentId);
  }

  public openWidgetProcessSubscription(): void {
    this._subscriptions.add(
      this.widgetsService.startProcessEvent
        .pipe(switchMap(() => this.widgetsService.activeProcess$))
        .subscribe(processDefinitionCaseDefinition => {
          this.startProcess(processDefinitionCaseDefinition[0]);
        })
    );
  }

  public claimAssignee(): void {
    this.isAssigning$.next(true);

    this.userId$
      .pipe(
        take(1),
        switchMap((userId: string | undefined) =>
          this.documentService.assignHandlerToDocument(this.documentId, userId ?? '')
        )
      )
      .subscribe({
        next: (): void => {
          this.isAssigning$.next(false);
          this.caseService.refresh();
        },
        error: (): void => {
          this.isAssigning$.next(false);
          this.logger.debug('Something went wrong while assigning user to case');
        },
      });
  }

  public unassignAssignee(): void {
    this.isAssigning$.next(true);

    this.userId$
      .pipe(
        take(1),
        switchMap((userId: string | undefined) =>
          this.documentService.unassignHandlerFromDocument(this.documentId)
        )
      )
      .subscribe({
        next: (): void => {
          this.isAssigning$.next(false);
          this.caseService.refresh();
        },
        error: (): void => {
          this.isAssigning$.next(false);
          this.logger.debug('Something went wrong while unassigning user from case');
        },
      });
  }

  public deleteDocument(): void {
    this.showDeleteModal$.next(true);
  }

  public onConfirmDelete(): void {
    this.isDeleting$.next(true);
    this.documentService.deleteDocument(this.documentId).subscribe({
      next: (): void => {
        this.isDeleting$.next(false);
        this.showDeleteModal$.next(false);
        this.router.navigate([`/cases/${this.caseDefinitionKey}`]);
      },
      error: (): void => {
        this.isDeleting$.next(false);
        this.logger.debug('Something went wrong while deleting the case');
      },
    });
  }

  public onTaskClickEvent(taskProcessLinkResult: TaskWithProcessLink): void {
    if (!taskProcessLinkResult.processLinkActivityResult) {
      this.isAdmin$.pipe(take(1)).subscribe(isAdmin => {
        this.handleNoTaskProcessLink(isAdmin);
      });
      return;
    }

    const displayType =
      taskProcessLinkResult.processLinkActivityResult.properties.formDisplayType ||
      CASE_DETAIL_DEFAULT_DISPLAY_TYPE;
    const size =
      taskProcessLinkResult.processLinkActivityResult.properties.formSize ||
      CASE_DETAIL_DEFAULT_DISPLAY_SIZE;

    this.caseDetailLayoutService.setFormDisplaySize(size);
    this.caseDetailLayoutService.setFormDisplayType(displayType);

    if (displayType === 'panel') {
      this.caseDetailLayoutService.setTaskAndProcessLinkOpenedInPanel(taskProcessLinkResult);
    } else {
      this.openTaskAndProcessLinkInModal$.next({...taskProcessLinkResult});
    }
  }

  public onTaskDetailsClose(): void {
    this.caseDetailLayoutService.setTaskAndProcessLinkOpenedInPanel(null);
  }

  public onActiveChangeEvent(event: boolean): void {
    this._activeChange = event;
  }

  public onTabSelected(tab: TabImpl, activeTab: TabImpl): void {
    if (!this.tabLoader) return;

    if (!this._tabsInit) {
      this._tabsInit = true;
      return;
    }

    this._oldTabName = activeTab.name;
    this._pendingTab = tab;
    this._activeTabName$.next(tab.name);
    this.pendingChanges =
      tab.contentKey === 'summary' ? false : !tab.showTasks && this._activeChange;

    if (this.pendingChanges) {
      this.tabLoader.replaceUrlState(tab);
      return;
    }

    if (!tab.showTasks) this.openTaskAndProcessLinkInModal$.next(null);
    this.tabLoader.load(tab);
    this.setDocumentStyle();
  }

  public onFormSubmitEvent(): void {
    this.caseDetailLayoutService.setTaskAndProcessLinkOpenedInPanel(null);

    if (!this.tabLoader) return;
    this.tabLoader.refreshView();
  }

  protected onConfirmRedirect(): void {
    if (!this.tabLoader || !this._pendingTab) return;
    this._activeChange = false;
    this._activeTabName$.next(this._pendingTab.name);
    this.tabLoader.load(this._pendingTab);
    this.caseDetailLayoutService.setTaskAndProcessLinkOpenedInPanel(null);
  }

  protected onCancelRedirect(): void {
    if (!this.tabLoader) return;
    this._activeTabName$.next(this._oldTabName);
  }

  private initBreadcrumb(): void {
    this.documentService.getDocumentDefinition(this.caseDefinitionKey).subscribe(definition => {
      this.documentDefinitionTitle = definition.schema.title;
      this.setBreadcrumb();
    });
  }

  private initTabLoader(): void {
    combineLatest([this.caseTabService.tabs$, this.canView$])
      .pipe(take(1))
      .subscribe(([tabs, canView]) => {
        if (canView) {
          if (tabs?.length > 0) {
            this._initialTabName = this._snapshot.get('tab') ?? '';
            this.tabLoader = new TabLoaderImpl(
              tabs,
              this.componentFactoryResolver,
              this.viewContainerRef,
              this.router,
              this.route
            );
            this.tabLoader.initial(this._initialTabName);
            this.caseTabService.setTabLoader(this.tabLoader);
            this.loadingTabs$.next(false);
            this.activeTab$ = this.tabLoader.activeTab$;
          } else {
            this.noTabsConfigured$.next(true);
            this.loadingTabs$.next(false);
          }

          this.getAllAssociatedProcessDefinitions();
        } else {
          this.showNoAccess$.next(true);
          this.loadingTabs$.next(false);
        }
      });
  }

  public assignmentOfDocumentChanged(): void {
    this.caseService.refresh();
  }

  private getCustomCaseHeaderItem(item): void {
    this.customCaseHeaderItems.push({
      label: item['labelTranslationKey'] || '',
      columnSize: item['columnSize'] || 3,
      textSize: item['textSize'] || 'md',
      customClass: item['customClass'] || '',
      modifier: item['modifier'] || '',
      value: item['propertyPaths']?.reduce(
        (prev, curr) => prev + this.getStringFromDocumentPath(item, curr),
        ''
      ),
    });
  }

  private getStringFromDocumentPath(item, path): string {
    const prefix = item['propertyPaths'].indexOf(path) > 0 ? ' ' : '';
    let string = this.getNestedProperty(this.document.content, path, item['noValueText']) || '';
    const dateFormats = [moment.ISO_8601, 'MM-DD-YYYY', 'DD-MM-YYYY', 'YYYY-MM-DD'];
    switch (item['modifier']) {
      case 'age': {
        if (moment(string, dateFormats, true).isValid()) {
          string = moment().diff(string, 'years');
        }
        break;
      }
      default: {
        if (moment(string, dateFormats, true).isValid()) {
          string = moment(string).format('DD-MM-YYYY');
        }
      }
    }
    return prefix + string;
  }

  private getNestedProperty(obj: any, path: string, defaultValue: any): any {
    return (
      path.split('.').reduce((currentObject, key) => currentObject?.[key], obj) || defaultValue
    );
  }

  private setBreadcrumb(): void {
    this.breadcrumbService.setSecondBreadcrumb({
      route: [`/cases/${this.caseDefinitionKey}`],
      content: this.documentDefinitionTitle,
      href: `/cases/${this.caseDefinitionKey}`,
    });
  }

  private openWidthObserver(): void {
    if (!this._tabContentContainer.nativeElement) return;

    this._observer = new ResizeObserver(event => {
      this.observerMutation(event);
    });
    this._observer.observe(this._tabContentContainer.nativeElement);
  }

  private observerMutation(event: Array<ResizeObserverEntry>): void {
    const elementWidth = event[0]?.borderBoxSize[0]?.inlineSize;

    if (typeof elementWidth === 'number' && elementWidth !== 0) {
      this.caseDetailLayoutService.setTabContentContainerWidth(elementWidth);
    }
  }

  private setDocumentStyle(): void {
    this.renderer.addClass(this.htmlDocument.getElementsByTagName('html')[0], 'html--fixed');
  }

  private removeDocumentStyle(): void {
    this.renderer.removeClass(this.htmlDocument.getElementsByTagName('html')[0], 'html--fixed');
  }

  private enableResetOnBackNavigation(): void {
    this._subscriptions.add(
      this.router.events
        .pipe(
          filter(
            event => event instanceof NavigationStart && event.navigationTrigger === 'popstate'
          )
        )
        .subscribe(() => {
          this.pageTitleService.enableReset();
        })
    );
  }

  private handleNoTaskProcessLink(isAdmin: boolean): void {
    this.notificationService.showActionable({
      type: 'warning',
      lowContrast: true,
      title: this.translateService.instant('case.noLinkedProcessNotification'),
      ...(isAdmin && {
        actions: [
          {
            text: this.translateService.instant('dossier.configure'),
            click: () => this.router.navigate(['/process-links']),
          },
        ],
      }),
      duration: CARBON_CONSTANTS.notificationDuration,
    });
  }

  private mapProcessDocumentDefinitions(
    processDefinitionCaseDefinitions: ProcessDefinitionCaseDefinition[]
  ): (ProcessDefinitionCaseDefinition & {displayName: string})[] {
    return processDefinitionCaseDefinitions.map(
      (processDefinitionCaseDefinition: ProcessDefinitionCaseDefinition) => ({
        ...processDefinitionCaseDefinition,
        displayName:
          this.translateService.instant(processDefinitionCaseDefinition?.processDefinitionKey) !==
          processDefinitionCaseDefinition?.processDefinitionKey
            ? this.translateService.instant(processDefinitionCaseDefinition.processDefinitionKey)
            : processDefinitionCaseDefinition.processDefinitionName,
      })
    );
  }

  private setProcessDropdownWidth(): void {
    const longestName = this.processDefinitionCaseDefinitions.reduce(
      (acc, curr) =>
        !!curr.displayName && curr.displayName.length > acc ? curr.displayName.length : acc,
      0
    );

    this.dropdownWidth$.next(
      longestName < 20
        ? CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH.small
        : longestName < 40
          ? CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH.medium
          : CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH.large
    );
  }
}
