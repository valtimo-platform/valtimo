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
import {ActivatedRoute, ParamMap, Params, Router} from '@angular/router';
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
  ProcessDocumentDefinition,
} from '@valtimo/document';
import {ProcessInstanceTask} from '@valtimo/process';
import {UserProviderService} from '@valtimo/security';
import {IntermediateSubmission, Task, TaskProcessLinkResult, TaskService} from '@valtimo/task';
import {IconService, NotificationService} from 'carbon-components-angular';
import {KeycloakService} from 'keycloak-angular';
import {isBoolean} from 'lodash';
import moment from 'moment';
import {NGXLogger} from 'ngx-logger';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  map,
  Observable,
  of,
  startWith,
  Subject,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  DOSSIER_DETAIL_DEFAULT_DISPLAY_SIZE,
  DOSSIER_DETAIL_DEFAULT_DISPLAY_TYPE,
  DOSSIER_DETAIL_GUTTER_SIZE,
} from '../../constants';
import {TabImpl, TabLoaderImpl} from '../../models';
import {
  CAN_ASSIGN_CASE_PERMISSION,
  CAN_CLAIM_CASE_PERMISSION,
  DOSSIER_DETAIL_PERMISSION_RESOURCE,
} from '../../permissions';
import {DossierDetailLayoutService, DossierService, DossierTabService} from '../../services';
import {DossierSupportingProcessStartModalComponent} from '../dossier-supporting-process-start-modal/dossier-supporting-process-start-modal.component';

@Component({
  selector: 'valtimo-dossier-detail',
  templateUrl: './dossier-detail.component.html',
  styleUrls: ['./dossier-detail.component.scss'],
  providers: [DossierTabService, DossierDetailLayoutService, NotificationService],
})
export class DossierDetailComponent
  extends PendingChangesComponent
  implements AfterViewInit, OnDestroy
{
  @ViewChild('supportingProcessStartModal')
  supportingProcessStart: DossierSupportingProcessStartModalComponent;

  @ViewChild('tabContainer', {read: ViewContainerRef})
  viewContainerRef: ViewContainerRef;

  @ViewChild('tabContentContainer')
  private readonly _tabContentContainer!: ElementRef<HTMLDivElement>;

  public customDossierHeaderItems: Array<any> = [];
  public document: ValtimoDocument | null = null;
  public documentDefinitionName: string;
  public documentDefinitionNameTitle: string;
  public documentId: string;
  public processDefinitionListFields: Array<any> = [];
  public processDocumentDefinitions: ProcessDocumentDefinition[] = [];
  public tabLoader: TabLoaderImpl | null = null;

  public readonly assigneeId$ = new BehaviorSubject<string>('');
  public readonly currentIntermediateSave$ = new BehaviorSubject<IntermediateSubmission | null>(
    null
  );
  public readonly isAdmin$: Observable<boolean> = this.userProviderService
    .getUserSubject()
    .pipe(map(userIdentity => userIdentity?.roles?.includes('ROLE_ADMIN')));

  public readonly taskOpenedInPanel$ = this.dossierDetailLayoutService.taskOpenedInPanel$;

  private readonly _caseStatusKey$ = new BehaviorSubject<string | null | 'NOT_AVAILABLE'>(null);
  private readonly _taskPanelToggle = this.configService.featureToggles?.enableTaskPanel;

  public readonly caseStatusKey$: Observable<string | 'NOT_AVAILABLE'> = this._caseStatusKey$.pipe(
    filter(key => !!key)
  );

  public readonly document$: Observable<ValtimoDocument | null> =
    this.dossierService.refreshDocument$.pipe(
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
            this.configService.config.customDossierHeader?.hasOwnProperty(
              this.documentDefinitionName.toLowerCase()
            ) &&
            this.customDossierHeaderItems.length === 0
          ) {
            this.configService.config.customDossierHeader[
              this.documentDefinitionName.toLowerCase()
            ]?.forEach(item => this.getCustomDossierHeaderItem(item));
          }
        }
      })
    );

  public readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.documentDefinitionName || '')
  );

  public readonly caseStatus$: Observable<InternalCaseStatus | undefined> =
    this.documentDefinitionName$.pipe(
      filter(documentDefinitionName => !!documentDefinitionName),
      switchMap(documentDefinitionName =>
        combineLatest([
          this.caseStatusService.getInternalCaseStatuses(documentDefinitionName),
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

  public readonly canHaveAssignee$: Observable<boolean> = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getCaseSettings(documentDefinitionName)
    ),
    map(caseSettings => caseSettings?.canHaveAssignee)
  );

  public readonly canAssignLoaded$ = new BehaviorSubject<boolean>(false);
  public readonly canAssign$: Observable<boolean> = this.route.paramMap.pipe(
    switchMap((params: ParamMap) =>
      this.permissionService.requestPermission(CAN_ASSIGN_CASE_PERMISSION, {
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
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
        resource: DOSSIER_DETAIL_PERMISSION_RESOURCE.jsonSchemaDocument,
        identifier: params.get('documentId') ?? '',
      })
    )
  );

  public readonly loadingTabs$ = new BehaviorSubject<boolean>(true);
  public readonly noTabsConfigured$ = new BehaviorSubject<boolean>(false);
  public activeTab$: Observable<TabImpl>;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly tabHorizontalOverflowDisabled =
    this.dossierTabService.tabHorizontalOverflowDisabled;

  public readonly showTaskList$ = this.dossierTabService.showTaskList$;

  private readonly _activeTabName$ = new BehaviorSubject<string | null>(null);
  public get activeTabName$(): Observable<string | null> {
    return combineLatest([this.route.paramMap, this._activeTabName$]).pipe(
      map(([paramMap, activeTabName]) =>
        !activeTabName ? (paramMap.get('tab') ?? null) : activeTabName
      )
    );
  }

  public readonly DOSSIER_DETAIL_GUTTER_SIZE = DOSSIER_DETAIL_GUTTER_SIZE;

  public readonly dossierDetailLayout$ = this.dossierDetailLayoutService.dossierDetailLayout$;

  public readonly openTaskInModal$ = new Subject<Task>();

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

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly caseStatusService: CaseStatusService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly componentFactoryResolver: ComponentFactoryResolver,
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly dossierDetailLayoutService: DossierDetailLayoutService,
    private readonly dossierService: DossierService,
    private readonly dossierTabService: DossierTabService,
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
    private readonly taskService: TaskService,
    private readonly userProviderService: UserProviderService,
    @Inject(DOCUMENT) private readonly htmlDocument: Document
  ) {
    super();
    this._snapshot = this.route.snapshot.paramMap;
    this.documentDefinitionName = this._snapshot.get('documentDefinitionName') || '';
    this.documentId = this._snapshot.get('documentId') || '';
  }

  public ngAfterViewInit(): void {
    this.initTabLoader();
    this.initBreadcrumb();
    this.getAllAssociatedProcessDefinitions();
    this.openWidthObserver();
    this.pageTitleService.disableReset();
    this.iconService.registerAll([ChevronDown16]);
    this.setDocumentStyle();
  }

  public ngOnDestroy(): void {
    this.breadcrumbService.clearSecondBreadcrumb();
    this.pageTitleService.enableReset();
    this.removeDocumentStyle();
  }

  public getAllAssociatedProcessDefinitions(): void {
    this.documentService
      .findProcessDocumentDefinitionsByStartableByUser(this.documentDefinitionName, true)
      .subscribe((processDocumentDefinitions: ProcessDocumentDefinition[]) => {
        this.processDocumentDefinitions = processDocumentDefinitions;

        this.processDefinitionListFields = [
          {
            key: 'processName',
            label: 'Proces',
          },
        ];
      });
  }

  public startProcess(processDocumentDefinition: ProcessDocumentDefinition): void {
    this.supportingProcessStart.openModal(processDocumentDefinition, this.documentId);
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
          this.dossierService.refresh();
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
          this.dossierService.refresh();
        },
        error: (): void => {
          this.isAssigning$.next(false);
          this.logger.debug('Something went wrong while unassigning user from case');
        },
      });
  }

  public onTaskClickEvent(task: Task): void {
    this.taskService
      .getTaskProcessLink(task.id)
      .pipe(catchError(() => this.isAdmin$))
      .subscribe((result: TaskProcessLinkResult | boolean) => {
        if (isBoolean(result)) {
          this.handleNoTaskProcessLink(result as boolean);
          return;
        }

        const displayType =
          (result as TaskProcessLinkResult).properties.formDisplayType ||
          DOSSIER_DETAIL_DEFAULT_DISPLAY_TYPE;
        const size =
          (result as TaskProcessLinkResult).properties.formSize ||
          DOSSIER_DETAIL_DEFAULT_DISPLAY_SIZE;

        this.dossierDetailLayoutService.setFormDisplaySize(size);
        this.dossierDetailLayoutService.setFormDisplayType(displayType);

        if (displayType === 'panel' && !!this._taskPanelToggle) {
          this.dossierDetailLayoutService.setTaskOpenedInPanel(task as any as ProcessInstanceTask);
        } else {
          this.openTaskInModal$.next({...task});
        }
      });
  }

  public onTaskDetailsClose(): void {
    this.dossierDetailLayoutService.setTaskOpenedInPanel(null);
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

    if (!tab.showTasks) this.openTaskInModal$.next(null);
    this.tabLoader.load(tab);
    this.setDocumentStyle();
  }

  public onFormSubmitEvent(): void {
    this.dossierDetailLayoutService.setTaskOpenedInPanel(null);

    if (!this.tabLoader) return;
    this.tabLoader.refreshView();
  }

  protected onConfirmRedirect(): void {
    if (!this.tabLoader || !this._pendingTab) return;
    this._activeChange = false;
    this._activeTabName$.next(this._pendingTab.name);
    this.tabLoader.load(this._pendingTab);
    this.dossierDetailLayoutService.setTaskOpenedInPanel(null);
  }

  protected onCancelRedirect(): void {
    if (!this.tabLoader) return;
    this._activeTabName$.next(this._oldTabName);
  }

  private initBreadcrumb(): void {
    this.documentService
      .getDocumentDefinition(this.documentDefinitionName)
      .subscribe(definition => {
        this.documentDefinitionNameTitle = definition.schema.title;
        this.setBreadcrumb();
      });
  }

  private initTabLoader(): void {
    this.dossierTabService.tabs$.pipe(take(1)).subscribe(tabs => {
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
        this.dossierTabService.setTabLoader(this.tabLoader);
        this.loadingTabs$.next(false);
        this.activeTab$ = this.tabLoader.activeTab$;
      } else {
        this.noTabsConfigured$.next(true);
        this.loadingTabs$.next(false);
      }
    });
  }

  public assignmentOfDocumentChanged(): void {
    this.dossierService.refresh();
  }

  private getCustomDossierHeaderItem(item): void {
    this.customDossierHeaderItems.push({
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
      route: [`/dossiers/${this.documentDefinitionName}`],
      content: this.documentDefinitionNameTitle,
      href: `/dossiers/${this.documentDefinitionName}`,
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
      this.dossierDetailLayoutService.setTabContentContainerWidth(elementWidth);
    }
  }

  private setDocumentStyle(): void {
    this.renderer.addClass(this.htmlDocument.getElementsByTagName('html')[0], 'html--fixed');
  }

  private removeDocumentStyle(): void {
    this.renderer.removeClass(this.htmlDocument.getElementsByTagName('html')[0], 'html--fixed');
  }

  private handleNoTaskProcessLink(isAdmin: boolean): void {
    this.notificationService.showActionable({
      type: 'warning',
      lowContrast: true,
      title: this.translateService.instant('dossier.noLinkedProcessNotification'),
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
}
