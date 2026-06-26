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

import {DECISION_MODELER_TEST_IDS} from '../constants';
import {DecisionService} from '../services/decision.service';
import {AfterViewInit, Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import DmnJS from 'dmn-js/dist/dmn-modeler.development.js';
import DmnViewer from 'dmn-js/dist/dmn-viewer.development.js';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {DecisionFormValue, DecisionXml} from '../models';
import {
  createDmnXml,
  parseDecisionForm,
  toDecisionFileName,
  updateDmnXml,
} from '../utils/dmn-template';
import {DecisionFormModalComponent} from '../decision-form-modal/decision-form-modal.component';
import {migrateDiagram} from '@bpmn-io/dmn-migrate';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  filter,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  BreadcrumbService,
  ConfirmationModalModule,
  FitPageDirective,
  OverflowMenuComponent,
  OverflowMenuOptionComponent,
  OverflowMenuTriggerComponent,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
  RenderInPageHeaderDirective,
  SelectedValue,
  SelectModule as ValtimoSelectModule,
  WidgetModule,
} from '@valtimo/components';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {EMPTY_DECISION} from './empty-decision';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  IconModule,
  IconService,
  ModalModule,
  SelectModule,
  TagModule,
} from 'carbon-components-angular';
import {
  BuildingBlockManagementParams,
  CaseManagementParams,
  DraftVersionService,
  EditPermissionsService,
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  getContextObservable,
  GlobalNotificationService,
  ManagementContext,
} from '@valtimo/shared';
import {ArrowLeft16, Deploy16, Download16} from '@carbon/icons';

declare const $: any;

@Component({
  selector: 'valtimo-decision-modeler',
  standalone: true,
  templateUrl: './decision-modeler.component.html',
  styleUrls: ['./decision-modeler.component.scss'],
  imports: [
    CommonModule,
    RouterModule,
    ModalModule,
    SelectModule,
    WidgetModule,
    ValtimoSelectModule,
    TranslateModule,
    RenderInPageHeaderDirective,
    ButtonModule,
    IconModule,
    TagModule,
    FitPageDirective,
    OverflowMenuComponent,
    OverflowMenuOptionComponent,
    OverflowMenuTriggerComponent,
    DecisionFormModalComponent,
    ConfirmationModalModule,
  ],
})
export class DecisionModelerComponent
  extends PendingChangesComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  @ViewChild('decisionEdit') edit: DecisionFormModalComponent;

  private CLASS_NAMES = {
    drd: 'dmn-icon-lasso-tool',
    decisionTable: 'dmn-icon-decision-table',
    literalExpression: 'dmn-icon-literal-expression',
  };

  protected readonly testIds = DECISION_MODELER_TEST_IDS;

  private $container!: any;
  private $tabs!: any;
  private dmnEditor!: DmnJS | DmnViewer;

  public readonly versionSelectionDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly isCreating$ = new BehaviorSubject<boolean>(false);
  public readonly selectionId$ = new BehaviorSubject<string>('');
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  // Emits once the dmn-js editor instance has been created, so XML import can wait for it.
  private readonly _editorReady$ = new BehaviorSubject<boolean>(false);

  private _fileName!: string;
  private _createSeed: DecisionFormValue | null = null;
  private _decisionKey: string | null = null;

  public readonly caseManagementRouteParams$: Observable<CaseManagementParams | undefined> =
    getCaseManagementRouteParams(this.route);

  public readonly buildingBlockManagementRouteParams$: Observable<
    BuildingBlockManagementParams | undefined
  > = getBuildingBlockManagementRouteParams(this.route);

  public readonly context$: Observable<ManagementContext | null> = getContextObservable(this.route);
  public readonly isIndependent$ = this.context$.pipe(map(context => context === 'independent'));

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  public readonly hasEditPermissions$: Observable<boolean> = combineLatest([
    this.caseManagementRouteParams$,
    this.buildingBlockManagementRouteParams$,
    this.context$,
  ]).pipe(
    switchMap(([caseParams, buildingBlockParams, context]) => {
      // Building block decision tables can only be edited on a draft (non-final) version.
      if (context === 'buildingBlock') {
        return this.draftVersionService.isDraftVersionBuildingBlock(
          buildingBlockParams?.buildingBlockDefinitionKey ?? '',
          buildingBlockParams?.buildingBlockDefinitionVersionTag ?? ''
        );
      }
      return this.editPermissionsService.hasPermissionsToEditBasedOnContext(
        caseParams,
        context ?? ''
      );
    }),
    shareReplay({bufferSize: 1, refCount: false})
  );

  // The editor is shown as a read-only viewer when the user cannot edit (e.g. a final case or
  // building block definition) and is not creating a new decision table.
  public readonly readOnly$: Observable<boolean> = combineLatest([
    this.isCreating$,
    this.hasEditPermissions$,
  ]).pipe(map(([isCreating, hasEditPermissions]) => !isCreating && !hasEditPermissions));

  private readonly decisionId$ = this.route.params.pipe(
    map(params => params?.id),
    tap(id => {
      this.isCreating$.next(id === 'create');
      this.versionSelectionDisabled$.next(true);
    }),
    filter(id => !!id && id !== 'create')
  );

  public readonly decision$ = this.decisionId$.pipe(
    switchMap(id => this.decisionService.getDecisionById(id)),
    tap(decision => {
      this._fileName = decision.resource;
      this._decisionKey = decision?.key ?? null;
      if (decision) this.selectionId$.next(decision.id);
    })
  );

  public readonly decisionTitle$ = this.decision$.pipe(
    map(d => d?.name || d?.key || '-'),
    tap(title => this.pageTitleService.setCustomPageTitle(title))
  );

  private readonly _refreshDecisionSelectItems$ = new BehaviorSubject<null>(null);
  public readonly decisionVersionSelectItems$ = this._refreshDecisionSelectItems$.pipe(
    switchMap(() => combineLatest([this.decision$, this.decisionService.getUnlinkedDecisions()])),
    map(([current, list]) => {
      const filtered = list.filter(d => d.key === current.key);
      return [...filtered.map(d => ({id: d.id, text: d.version.toString()}))].sort(
        (a, b) => +(b.text ?? '') - +(a.text ?? '')
      );
    }),
    tap(() => this.versionSelectionDisabled$.next(false))
  );

  public readonly decisionXml$ = this.decisionId$.pipe(
    switchMap(id => this.decisionService.getDecisionXml(id)),
    // Wait until the editor (modeler or read-only viewer) has been created before importing.
    switchMap(xml =>
      this._editorReady$.pipe(
        filter(Boolean),
        take(1),
        map(() => xml)
      )
    ),
    tap(xml => xml && this.loadDecisionXml(xml))
  );

  constructor(
    private readonly decisionService: DecisionService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService,
    private readonly pageTitleService: PageTitleService,
    private readonly breadcrumbService: BreadcrumbService,
    private readonly iconService: IconService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly notificationService: GlobalNotificationService,
    private readonly editPermissionsService: EditPermissionsService,
    private readonly draftVersionService: DraftVersionService
  ) {
    super();
    this.iconService.registerAll([Deploy16, Download16, ArrowLeft16]);
    this._createSeed = this.extractCreateSeed();
  }

  private extractCreateSeed(): DecisionFormValue | null {
    const navigationState =
      this.router.getCurrentNavigation()?.extras?.state ??
      (typeof history !== 'undefined' ? history.state : undefined);

    const name = navigationState?.['decisionName'];
    const inputVariables = navigationState?.['inputVariables'];

    if (typeof name === 'string' && name) {
      return {
        name,
        inputVariables: Array.isArray(inputVariables)
          ? inputVariables
              .filter((variable: unknown): variable is Record<string, unknown> => !!variable)
              .map(variable => ({
                label: String(variable['label'] ?? ''),
                expression: String(variable['expression'] ?? ''),
              }))
          : [],
      };
    }

    return null;
  }

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.dmnEditor?.destroy();
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public ngAfterViewInit(): void {
    this.initEditor();

    this.context$.pipe(take(1)).subscribe(context => {
      if (!context) return;

      if (context === 'buildingBlock') {
        this.buildingBlockManagementRouteParams$.pipe(take(1)).subscribe(params => {
          if (params) this.initBuildingBlockBreadcrumbs(params);
        });
      } else {
        this.caseManagementRouteParams$.pipe(take(1)).subscribe(params => {
          if (params) this.initBreadcrumbs(params, context);
        });
      }
    });
  }

  public switchVersion(decisionId: string | SelectedValue): void {
    if (!decisionId) return;

    this.router.navigate(['../', decisionId], {relativeTo: this.route});
    this._refreshDecisionSelectItems$.next(null);
  }

  public deploy(): void {
    from(this.dmnEditor.saveXML({format: true}))
      .pipe(
        map(result => new File([(result as any).xml], this._fileName, {type: 'text/xml'})),
        switchMap(file => combineLatest([of(file), this.context$])),
        switchMap(([file, context]) => {
          if (context === 'independent') {
            return this.decisionService.deployDmn(file);
          }
          if (context === 'buildingBlock') {
            return this.buildingBlockManagementRouteParams$.pipe(
              switchMap(params =>
                this.decisionService.deployBuildingBlockDecisionDefinition(
                  params?.buildingBlockDefinitionKey ?? '',
                  params?.buildingBlockDefinitionVersionTag ?? '',
                  file
                )
              )
            );
          }
          return this.caseManagementRouteParams$.pipe(
            switchMap(params =>
              this.decisionService.deployCaseDecisionDefinition(
                params?.caseDefinitionKey ?? '',
                params?.caseDefinitionVersionTag ?? '',
                file
              )
            )
          );
        }),
        tap((res: {identifier: string}) => {
          this.switchVersion(res.identifier);
          this.showNotification('success', 'decisions.deploySuccess');
        }),
        catchError(() => {
          this.showNotification('error', 'decisions.deployFailure');

          return of(null);
        })
      )
      .subscribe();
  }

  public download(): void {
    from(this.dmnEditor.saveXML({format: true}))
      .pipe(
        map(result => new File([(result as any).xml], 'decision.dmn', {type: 'text/xml'})),
        tap(file => {
          const link = document.createElement('a');
          link.download = 'diagram.dmn';
          link.href = window.URL.createObjectURL(file);
          link.click();
          window.URL.revokeObjectURL(link.href);
          link.remove();
        })
      )
      .subscribe();
  }

  public openEditModal(): void {
    from(this.dmnEditor.saveXML({format: true}))
      .pipe(take(1))
      .subscribe(result => this.edit.open(parseDecisionForm((result as any).xml)));
  }

  public onEditDecision(value: DecisionFormValue): void {
    from(this.dmnEditor.saveXML({format: true}))
      .pipe(
        map(result => updateDmnXml((result as any).xml, value)),
        switchMap(xml => this.dmnEditor.importXML(xml)),
        tap(() => {
          this.setEditor();
          if (value.name) this.pageTitleService.setCustomPageTitle(value.name);
        }),
        catchError(() => {
          this.showNotification('error', 'decisions.loadFailure');
          return of(null);
        })
      )
      .subscribe();
  }

  public onDeleteClick(): void {
    this.showDeleteModal$.next(true);
  }

  public onDeleteConfirm(): void {
    const decisionKey = this._decisionKey;
    if (!decisionKey) return;

    this.context$
      .pipe(
        take(1),
        switchMap(context => {
          if (context === 'buildingBlock') {
            return this.buildingBlockManagementRouteParams$.pipe(
              take(1),
              switchMap(params =>
                this.decisionService.deleteBuildingBlockDecisionDefinition(
                  params?.buildingBlockDefinitionKey ?? '',
                  params?.buildingBlockDefinitionVersionTag ?? '',
                  decisionKey
                )
              )
            );
          }
          return this.caseManagementRouteParams$.pipe(
            take(1),
            switchMap(params =>
              this.decisionService.deleteCaseDecisionDefinition(
                params?.caseDefinitionKey ?? '',
                params?.caseDefinitionVersionTag ?? '',
                decisionKey
              )
            )
          );
        })
      )
      .subscribe({
        next: () => {
          this.navigateBack();
          this.showNotification('success', 'decisions.deleteSuccess');
        },
        error: () => this.showNotification('error', 'decisions.deleteFailure'),
      });
  }

  public navigateBack(): void {
    this.context$.pipe(take(1)).subscribe(context => {
      if (context === 'independent') {
        this.router.navigate(['/decision-tables']);
      } else {
        this.router.navigate(['../'], {relativeTo: this.route});
      }
    });
  }

  private showNotification(notification: null | 'success' | 'error', message: string): void {
    if (!notification) return;

    this.notificationService.showToast({
      caption: this.translateService.instant(message),
      type: notification,
      title: this.translateService.instant(`interface.${notification}`),
    });
  }

  private initEditor(): void {
    // A new decision table is always created in the editable modeler. For existing tables the
    // edit permissions decide whether to render the editable modeler or a read-only viewer.
    if (this.route.snapshot.params?.['id'] === 'create') {
      this.createEditor(false);
      this.loadEmptyDecisionTable();
      return;
    }

    this.hasEditPermissions$
      .pipe(take(1))
      .subscribe(hasEditPermissions => this.createEditor(!hasEditPermissions));
  }

  private createEditor(readOnly: boolean): void {
    this.$container = $('.editor-container');
    this.$tabs = $('.editor-tabs');
    this.dmnEditor = readOnly
      ? new DmnViewer({
          container: this.$container,
          height: 500,
          width: '100%',
        })
      : new DmnJS({
          container: this.$container,
          height: 500,
          width: '100%',
          keyboard: {bindTo: window},
        });
    this.setTabEvents();
    this.setModelerEvents();
    this._editorReady$.next(true);
  }

  private loadEmptyDecisionTable(): void {
    if (this._createSeed) {
      this._fileName = toDecisionFileName(this._createSeed.name);
      this.pageTitleService.setCustomPageTitle(this._createSeed.name);
      this.loadDecisionXml(createDmnXml(this._createSeed));
      return;
    }

    this._fileName = 'decision.dmn';
    this.loadDecisionXml(EMPTY_DECISION);
  }

  private setTabEvents(): void {
    this.$tabs.delegate('.tab', 'click', async (event: any) => {
      const index = +event.currentTarget.getAttribute('data-id');
      const view = this.dmnEditor.getViews()[index];
      try {
        await this.dmnEditor.open(view);
      } catch (err) {
        console.error('tab open error', err);
      }
    });
  }

  private setModelerEvents(): void {
    this.dmnEditor.on('views.changed', event => {
      const {views, activeView} = event;
      this.$tabs.empty();
      views.forEach((v, i) => {
        const className = this.CLASS_NAMES[v.type];
        const tab = $(
          `<div class="tab ${v === activeView ? 'active' : ''}" data-id="${i}"><span class="${className}"></span>${v.element.name || v.element.id}</div>`
        );
        this.$tabs.append(tab);
      });
    });
  }

  private loadDecisionXml(decision: DecisionXml): void {
    from(this.dmnEditor.importXML(decision.dmnXml))
      .pipe(
        tap(() => this.setEditor()),
        catchError(() => {
          this.migrateAndLoadDecisionXml(decision);
          return of(null);
        })
      )
      .subscribe();
  }

  private migrateAndLoadDecisionXml(decision: DecisionXml): void {
    from(migrateDiagram(decision.dmnXml))
      .pipe(
        switchMap(xml => this.dmnEditor.importXML(xml)),
        tap(() => this.setEditor()),
        catchError(() => {
          this.showNotification('error', 'decisions.loadFailure');
          return of(null);
        })
      )
      .subscribe();
  }

  private setEditor(): void {
    const view = this.dmnEditor.getActiveView();
    if (view?.type === 'drd') {
      const canvas = this.dmnEditor.getActiveViewer().get('canvas');
      canvas.zoom('fit-viewport');
    }
  }

  private initBreadcrumbs(params: CaseManagementParams, context: ManagementContext): void {
    if (context === 'independent') return;

    const route = `/case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [route],
      content: `${params.caseDefinitionKey} (${params.caseDefinitionVersionTag})`,
      href: route,
    });

    const routeWithDecisions = `${route}/decisions`;

    this.breadcrumbService.setFourthBreadcrumb({
      route: [routeWithDecisions],
      content: this.translateService.instant('caseManagement.tabs.decision'),
      href: routeWithDecisions,
    });
  }

  private initBuildingBlockBreadcrumbs(params: BuildingBlockManagementParams): void {
    const route = `/building-block-management/building-block/${params.buildingBlockDefinitionKey}/version/${params.buildingBlockDefinitionVersionTag}`;
    const generalRoute = `${route}/general`;

    this.breadcrumbService.setThirdBreadcrumb({
      route: [generalRoute],
      content: `${params.buildingBlockDefinitionKey} (${params.buildingBlockDefinitionVersionTag})`,
      href: generalRoute,
    });

    const routeWithDecisions = `${route}/decisions`;

    this.breadcrumbService.setFourthBreadcrumb({
      route: [routeWithDecisions],
      content: this.translateService.instant('buildingBlockManagement.tabs.decisions'),
      href: routeWithDecisions,
    });
  }
}
