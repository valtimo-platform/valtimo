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
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  QueryList,
  signal,
  ViewChildren,
} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ArrowLeft16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  EditorModel,
  PageHeaderService,
  PageTitleService,
  PendingChangesComponent,
} from '@valtimo/components';
import {
  getBuildingBlockManagementRouteParams,
  getCaseManagementRouteParams,
  getContextObservable,
  GlobalNotificationService,
  ManagementContext,
} from '@valtimo/shared';
import {IconService, Tab} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  finalize,
  map,
  Observable,
  shareReplay,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {FORM_FLOW_EDITOR_TEST_IDS} from '../../constants';
import {
  FormFlowDefinition,
  FormFlowEditorParams,
  FormFlowEditorTab,
  FormFlowRouteParams,
} from '../../models';
import {FormFlowService} from '../../services';
import {FormFlowDownloadService} from '../../services/form-flow-download.service';

@Component({
  standalone: false,
  templateUrl: './form-flow-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./form-flow-editor.component.scss'],
})
export class FormFlowEditorComponent extends PendingChangesComponent implements OnDestroy {
  // The Carbon tab headers, used to restore the highlighted header when a leave-page prompt is
  // cancelled (Carbon highlights the clicked header immediately, before the guard resolves).
  @ViewChildren(Tab) private _tabs!: QueryList<Tab>;

  public readonly readOnly$ = new BehaviorSubject<boolean>(false);
  public readonly valid$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);

  public readonly $activeTab = signal<FormFlowEditorTab>(FormFlowEditorTab.EDITOR);
  // Validate-on-save: while the admin is modelling nothing is flagged. Clicking Save on an invalid
  // definition flips this instead of calling the backend, which reveals the errors in the active
  // tab and — from then on — gates the Save button on validity until the definition is fixed.
  public readonly $saveAttempted = signal<boolean>(false);

  protected readonly FormFlowEditorTab = FormFlowEditorTab;
  protected readonly testIds = FORM_FLOW_EDITOR_TEST_IDS;

  private readonly _context$: Observable<ManagementContext | null> = getContextObservable(
    this.route
  );

  private readonly _params$: Observable<FormFlowEditorParams> = this._context$.pipe(
    switchMap(context => {
      if (context === 'buildingBlock') {
        return combineLatest([
          getBuildingBlockManagementRouteParams(this.route),
          this.route.params as Observable<FormFlowRouteParams>,
        ]).pipe(
          map(([bbParams, params]) => ({
            caseDefinitionKey: bbParams?.buildingBlockDefinitionKey ?? '',
            caseDefinitionVersionTag: bbParams?.buildingBlockDefinitionVersionTag ?? '',
            formFlowDefinitionKey: params.formFlowDefinitionKey,
          }))
        );
      }

      return combineLatest([
        getCaseManagementRouteParams(this.route),
        this.route.params as Observable<FormFlowRouteParams>,
      ]).pipe(
        map(([caseManagementParams, params]) => ({
          ...(caseManagementParams ?? {caseDefinitionKey: '', caseDefinitionVersionTag: ''}),
          ...params,
        }))
      );
    })
  );

  public readonly formFlowSchemaJson$: Observable<object> = this.formFlowService
    .getFormFlowDefinitionSchema()
    .pipe(shareReplay(1));

  private readonly _formFlowDefinition2$ = combineLatest([this._params$, this._context$]).pipe(
    tap(() => this.loading$.next(true)),
    switchMap(([params, context]) => {
      this.initBreadcrumbs(params, context);

      if (context === 'buildingBlock') {
        return this.formFlowService.getBuildingBlockFormFlowDefinitionByKey(
          params.caseDefinitionKey,
          params.caseDefinitionVersionTag,
          params.formFlowDefinitionKey
        );
      }

      return this.formFlowService.getFormFlowDefinitionByKey(
        params.caseDefinitionKey,
        params.caseDefinitionVersionTag,
        params.formFlowDefinitionKey
      );
    }),
    tap((formFlowDefinition: FormFlowDefinition) => {
      this.pageTitleService.setCustomPageTitle(formFlowDefinition.key);
      this.readOnly$.next(formFlowDefinition.readOnly === true);
      this.loading$.next(false);

      // A freshly loaded definition is the clean baseline: the next editor emission recaptures it,
      // saving without edits is possible from either tab, and the unsaved-changes flag is cleared.
      this._updatedModelValue$.next(this.serializeDefinition(formFlowDefinition));
      this._pendingBaseline = null;
      this.pendingChanges = false;
      this.valid$.next(true);
      // A reloaded definition starts a fresh modelling session; drop any prior save-attempt state.
      this.$saveAttempted.set(false);
    })
  );
  public readonly model$: Observable<EditorModel> = this._formFlowDefinition2$.pipe(
    map((formFlowDefinition: FormFlowDefinition) => this.getEditorModel(formFlowDefinition))
  );

  private readonly _updatedModelValue$ = new BehaviorSubject<string>('');
  // The editor's serialized value captured on (re)load. Edits that differ from it mark the editor
  // dirty so the leave-page guard can warn about unsaved changes.
  private _pendingBaseline: string | null = null;

  public readonly compactMode$ = this.pageHeaderService.compactMode$;

  constructor(
    private readonly breadcrumbService: BreadcrumbService,
    private readonly formFlowDownloadService: FormFlowDownloadService,
    private readonly formFlowService: FormFlowService,
    private readonly iconService: IconService,
    private readonly notificationService: GlobalNotificationService,
    private readonly pageHeaderService: PageHeaderService,
    private readonly pageTitleService: PageTitleService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {
    super();
    this.iconService.registerAll([ArrowLeft16]);
    this.pageTitleService.disableReset();
    this.restoreActiveTabFromUrl();
  }

  public ngOnDestroy(): void {
    this.pendingChanges = false;
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public onValid(valid: boolean): void {
    this.valid$.next(valid);
  }

  public onValueChange(value: string): void {
    // The first emission after a (re)load is the editor's baseline. Comparison is done on the
    // normalized (whitespace-insensitive) JSON so the JSON editor's format-on-load reflow is not
    // mistaken for an edit; only a genuine content change marks the editor dirty.
    const normalized = this.normalizeJson(value);
    if (this._pendingBaseline === null) {
      this._pendingBaseline = normalized;
      this.pendingChanges = false;
    } else {
      this.pendingChanges = normalized !== this._pendingBaseline;
    }

    this._updatedModelValue$.next(value);
  }

  public setActiveTab(tab: FormFlowEditorTab): void {
    if (this.$activeTab() === tab) return;

    combineLatest([this._params$, this._context$])
      .pipe(take(1))
      .subscribe(([params, context]) => {
        this.router.navigate(this.editorRouteSegments(params, context, tab));
      });
  }

  protected override onCancelRedirect(): void {
    this.syncTabHeaders();
  }

  public updateFormFlowDefinition(): void {
    // Validate on the click: while modelling nothing is flagged, so clicking Save on an invalid
    // definition reveals its errors (via $saveAttempted → the tabs' revealErrors) instead of
    // sending it to the backend. From here on the Save button gates on validity until it is fixed.
    if (!this.valid$.value) {
      this.$saveAttempted.set(true);
      return;
    }

    this.loading$.next(true);

    combineLatest([this._params$, this._updatedModelValue$, this._context$])
      .pipe(
        take(1),
        switchMap(([params, updatedModelValue, context]) => {
          const updatedDefinition = {
            ...(JSON.parse(updatedModelValue) as FormFlowDefinition),
            key: params.formFlowDefinitionKey,
          };

          if (context === 'buildingBlock') {
            return this.formFlowService.updateBuildingBlockFormFlowDefinition(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag,
              params.formFlowDefinitionKey,
              updatedDefinition
            );
          }

          return this.formFlowService.updateFormFlowDefinition(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag,
            params.formFlowDefinitionKey,
            updatedDefinition
          );
        }),
        finalize(() => this.loading$.next(false))
      )
      .subscribe(result => {
        // The saved value is the new clean baseline for the leave-page guard.
        this._pendingBaseline = this.normalizeJson(this._updatedModelValue$.getValue());
        this.pendingChanges = false;
        this.$saveAttempted.set(false);
        this.showSuccessMessage(result.key);
      });
  }

  public onDelete(): void {
    this.loading$.next(true);
    this.pendingChanges = false;

    combineLatest([this._params$, this._context$])
      .pipe(
        take(1),
        switchMap(([params, context]) => {
          if (context === 'buildingBlock') {
            return this.formFlowService
              .deleteBuildingBlockFormFlowDefinition(
                params.caseDefinitionKey,
                params.caseDefinitionVersionTag,
                params.formFlowDefinitionKey
              )
              .pipe(map(() => ({params, context})));
          }

          return this.formFlowService
            .deleteFormFlowDefinition(
              params.caseDefinitionKey,
              params.caseDefinitionVersionTag,
              params.formFlowDefinitionKey
            )
            .pipe(map(() => ({params, context})));
        })
      )
      .subscribe(({params, context}) => {
        this.router.navigate(this.overviewRouteSegments(params, context));
      });
  }

  public showDeleteModal(): void {
    this.showDeleteModal$.next(true);
  }

  public downloadFormFlowDefinition(model: EditorModel): void {
    this._params$
      .pipe(take(1))
      .subscribe((params: FormFlowEditorParams) =>
        this.formFlowDownloadService.downloadJson(JSON.parse(model.value), params)
      );
  }

  public navigateBack(): void {
    combineLatest([this._params$, this._context$])
      .pipe(take(1))
      .subscribe(([params, context]) => {
        this.router.navigate(this.overviewRouteSegments(params, context));
      });
  }

  private restoreActiveTabFromUrl(): void {
    const url = this.route.snapshot.url;
    const lastSegment = url[url.length - 1]?.path;
    if (lastSegment === 'json-editor') {
      this.$activeTab.set(FormFlowEditorTab.JSON_EDITOR);
    }
  }

  // The Carbon tab header highlights the clicked tab immediately; if the leave-page prompt is
  // cancelled, restore the highlight to the tab that is actually still active.
  private syncTabHeaders(): void {
    const order = [FormFlowEditorTab.EDITOR, FormFlowEditorTab.JSON_EDITOR];
    this._tabs?.forEach((tab, index) => {
      tab.active = order[index] === this.$activeTab();
    });
  }

  private editorRouteSegments(
    params: FormFlowEditorParams,
    context: ManagementContext | null,
    tab: FormFlowEditorTab
  ): string[] {
    const segments = [...this.overviewRouteSegments(params, context), params.formFlowDefinitionKey];

    return tab === FormFlowEditorTab.JSON_EDITOR ? [...segments, 'json-editor'] : segments;
  }

  private overviewRouteSegments(
    params: FormFlowEditorParams,
    context: ManagementContext | null
  ): string[] {
    if (context === 'buildingBlock') {
      return [
        '/building-block-management',
        'building-block',
        params.caseDefinitionKey,
        'version',
        params.caseDefinitionVersionTag,
        'form-flows',
      ];
    }

    return [
      '/case-management',
      'case',
      params.caseDefinitionKey,
      'version',
      params.caseDefinitionVersionTag,
      'form-flows',
    ];
  }

  private serializeDefinition(formFlowDefinition: FormFlowDefinition): string {
    const clone = {...formFlowDefinition};
    delete clone.readOnly;
    return JSON.stringify(clone);
  }

  private getEditorModel(formFlowDefinition: FormFlowDefinition): EditorModel {
    return {
      value: this.serializeDefinition(formFlowDefinition),
      language: 'json',
      uri: `inmemory://form-flow/${formFlowDefinition.key}.formflow.json`,
    };
  }

  // Canonicalizes a JSON string by dropping insignificant whitespace, so reformatting (such as the
  // JSON editor's format-on-load) does not register as a change. Invalid JSON is compared as-is.
  private normalizeJson(value: string): string {
    try {
      return JSON.stringify(JSON.parse(value));
    } catch {
      return value;
    }
  }

  private showSuccessMessage(formFlowDefinitionKey: string): void {
    this.notificationService.showToast({
      caption: this.translateService.instant('formFlow.savedSuccessTitleMessage', {
        key: formFlowDefinitionKey,
      }),
      type: 'success',
      title: this.translateService.instant('formFlow.savedSuccessTitle'),
    });
  }

  private initBreadcrumbs(params: FormFlowEditorParams, context: ManagementContext | null): void {
    if (context === 'buildingBlock') {
      const route = `/building-block-management/building-block/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}`;
      const generalRoute = `${route}/general`;

      this.breadcrumbService.setThirdBreadcrumb({
        route: [generalRoute],
        content: `${params.caseDefinitionKey} (${params.caseDefinitionVersionTag})`,
        href: generalRoute,
      });

      const routeWithFormFlows = `${route}/form-flows`;

      this.breadcrumbService.setFourthBreadcrumb({
        route: [routeWithFormFlows],
        content: this.translateService.instant('buildingBlockManagement.tabs.formFlows'),
        href: routeWithFormFlows,
      });
    } else {
      const route = `/case-management/case/${params.caseDefinitionKey}/version/${params.caseDefinitionVersionTag}`;

      this.breadcrumbService.setThirdBreadcrumb({
        route: [route],
        content: `${params.caseDefinitionKey} (${params.caseDefinitionVersionTag})`,
        href: route,
      });

      const routeWithFormFlows = `${route}/form-flows`;

      this.breadcrumbService.setFourthBreadcrumb({
        route: [routeWithFormFlows],
        content: this.translateService.instant('caseManagement.tabs.formFlows'),
        href: routeWithFormFlows,
      });
    }
  }
}
