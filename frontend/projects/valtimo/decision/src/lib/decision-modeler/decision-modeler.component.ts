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

import {DecisionService} from '../services/decision.service';
import {AfterViewInit, Component, OnDestroy, OnInit} from '@angular/core';
import DmnJS from 'dmn-js/dist/dmn-modeler.development.js';
import {ActivatedRoute, Router, RouterModule} from '@angular/router';
import {DecisionXml} from '../models';
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
  switchMap,
  take,
  tap,
} from 'rxjs';
import {
  BreadcrumbService,
  FitPageDirective,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
  RenderInPageHeaderDirective,
  SelectedValue,
  SelectModule as ValtimoSelectModule,
  OverflowMenuComponent,
  OverflowMenuOptionComponent,
  OverflowMenuTriggerComponent,
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
} from 'carbon-components-angular';
import {
  BuildingBlockManagementParams,
  CaseManagementParams,
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
    FitPageDirective,
    OverflowMenuComponent,
    OverflowMenuOptionComponent,
    OverflowMenuTriggerComponent,
  ],
})
export class DecisionModelerComponent
  extends PendingChangesComponent
  implements OnInit, OnDestroy, AfterViewInit
{
  private CLASS_NAMES = {
    drd: 'dmn-icon-lasso-tool',
    decisionTable: 'dmn-icon-decision-table',
    literalExpression: 'dmn-icon-literal-expression',
  };

  private $container!: any;
  private $tabs!: any;
  private dmnModeler!: DmnJS;

  public readonly versionSelectionDisabled$ = new BehaviorSubject<boolean>(true);
  public readonly isCreating$ = new BehaviorSubject<boolean>(false);
  public readonly selectionId$ = new BehaviorSubject<string>('');

  private _fileName!: string;

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
    this.context$,
  ]).pipe(
    switchMap(([params, context]) =>
      this.editPermissionsService.hasPermissionsToEditBasedOnContext(params, context ?? '')
    )
  );

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
      if (decision) this.selectionId$.next(decision.id);
    })
  );

  public readonly decisionTitle$ = this.decision$.pipe(
    map(d => d?.name || d?.key || '-'),
    tap(title => this.pageTitleService.setCustomPageTitle(title))
  );

  private readonly _refreshDecisionSelectItems$ = new BehaviorSubject<null>(null);
  public readonly decisionVersionSelectItems$ = this._refreshDecisionSelectItems$.pipe(
    switchMap(() => combineLatest([this.decision$, this.decisionService.getDecisions()])),
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
    private readonly editPermissionsService: EditPermissionsService
  ) {
    super();
    this.iconService.registerAll([Deploy16, Download16, ArrowLeft16]);
  }

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public ngAfterViewInit(): void {
    this.setProperties();
    this.setTabEvents();
    this.setModelerEvents();

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
    from(this.dmnModeler.saveXML({format: true}))
      .pipe(
        map(result => new File([(result as any).xml], this._fileName, {type: 'text/xml'})),
        switchMap(file => combineLatest([of(file), this.context$])),
        switchMap(([file, context]) => {
          if (context === 'independent') {
            return this.decisionService.deployDmn(file);
          } else if (context === 'buildingBlock') {
            return this.buildingBlockManagementRouteParams$.pipe(
              switchMap(params =>
                this.decisionService.deployBuildingBlockDecisionDefinition(
                  params?.buildingBlockDefinitionKey ?? '',
                  params?.buildingBlockDefinitionVersionTag ?? '',
                  file
                )
              )
            );
          } else {
            return this.caseManagementRouteParams$.pipe(
              switchMap(params =>
                this.decisionService.deployCaseDecisionDefinition(
                  params?.caseDefinitionKey ?? '',
                  params?.caseDefinitionVersionTag ?? '',
                  file
                )
              )
            );
          }
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
    from(this.dmnModeler.saveXML({format: true}))
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

  public navigateBack(notification: null | 'success' | 'error', message: string): void {
    this.router.navigate(['../'], {relativeTo: this.route});

    if (!notification) return;

    this.showNotification(notification, message);
  }

  private showNotification(notification: null | 'success' | 'error', message: string): void {
    if (!notification) return;

    this.notificationService.showToast({
      caption: this.translateService.instant(message),
      type: notification,
      title: this.translateService.instant(`interface.${notification}`),
    });
  }

  private setProperties(): void {
    const isCreating = this.isCreating$.getValue();
    this.$container = $('.editor-container');
    this.$tabs = $('.editor-tabs');
    this.dmnModeler = new DmnJS({
      container: this.$container,
      height: 500,
      width: '100%',
      keyboard: {bindTo: window},
    });
    if (isCreating) this.loadEmptyDecisionTable();
  }

  private loadEmptyDecisionTable(): void {
    this.loadDecisionXml(EMPTY_DECISION);
  }

  private setTabEvents(): void {
    this.$tabs.delegate('.tab', 'click', async (event: any) => {
      const index = +event.currentTarget.getAttribute('data-id');
      const view = this.dmnModeler.getViews()[index];
      try {
        await this.dmnModeler.open(view);
      } catch (err) {
        console.error('tab open error', err);
      }
    });
  }

  private setModelerEvents(): void {
    this.dmnModeler.on('views.changed', event => {
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
    from(this.dmnModeler.importXML(decision.dmnXml))
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
        switchMap(xml => this.dmnModeler.importXML(xml)),
        tap(() => this.setEditor()),
        catchError(() => {
          this.showNotification('error', 'decisions.loadFailure');
          return of(null);
        })
      )
      .subscribe();
  }

  private setEditor(): void {
    const view = this.dmnModeler.getActiveView();
    if (view?.type === 'drd') {
      const canvas = this.dmnModeler.getActiveViewer().get('canvas');
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
