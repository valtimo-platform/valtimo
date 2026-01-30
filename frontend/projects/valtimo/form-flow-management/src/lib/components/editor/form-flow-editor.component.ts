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
import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {ArrowLeft16} from '@carbon/icons';
import {TranslateService} from '@ngx-translate/core';
import {
  BreadcrumbService,
  EditorModel,
  PageHeaderService,
  PageTitleService,
} from '@valtimo/components';
import {
  CaseManagementParams,
  getCaseManagementRouteParams,
  GlobalNotificationService,
} from '@valtimo/shared';
import {IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  finalize,
  map,
  Observable,
  switchMap,
  take,
  tap,
} from 'rxjs';
import {FormFlowDefinition, FormFlowDefinitionId, FormFlowEditorParams} from '../../models';
import {FormFlowService} from '../../services';
import {FormFlowDownloadService} from '../../services/form-flow-download.service';
import formFlowSchemaJson from './formflow.schema.json';

@Component({
  standalone: false,
  templateUrl: './form-flow-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./form-flow-editor.component.scss'],
})
export class FormFlowEditorComponent implements OnDestroy {
  public readonly readOnly$ = new BehaviorSubject<boolean>(false);
  public readonly valid$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly formFlowDefinitionId$ = new BehaviorSubject<FormFlowDefinitionId | null>(null);
  public readonly CARBON_THEME = 'g10';

  private readonly _params$: Observable<FormFlowEditorParams> = combineLatest([
    getCaseManagementRouteParams(this.route),
    this.route.params as Observable<{formFlowDefinitionKey: string}>,
  ]).pipe(
    map(([caseManagementParams, params]) => ({
      ...(caseManagementParams ?? {caseDefinitionKey: '', caseDefinitionVersionTag: ''}),
      ...params,
    }))
  );
  public readonly formFlowSchemaJson = formFlowSchemaJson;

  private readonly _formFlowDefinition2$ = this._params$.pipe(
    tap(() => this.loading$.next(true)),
    switchMap((params: FormFlowEditorParams) => {
      this.initBreadcrumbs(params);

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
    })
  );
  public readonly model$: Observable<EditorModel> = this._formFlowDefinition2$.pipe(
    map((formFlowDefinition: FormFlowDefinition) => this.getEditorModel(formFlowDefinition))
  );

  private readonly _updatedModelValue$ = new BehaviorSubject<string>('');

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
    this.iconService.registerAll([ArrowLeft16]);
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
    this.breadcrumbService.clearThirdBreadcrumb();
    this.breadcrumbService.clearFourthBreadcrumb();
  }

  public onValid(valid: boolean): void {
    this.valid$.next(valid);
  }

  public onValueChange(value: string): void {
    this._updatedModelValue$.next(value);
  }

  public updateFormFlowDefinition(): void {
    this.loading$.next(true);

    combineLatest([this._params$, this._updatedModelValue$])
      .pipe(
        take(1),
        switchMap(([params, updatedModelValue]) =>
          this.formFlowService.updateFormFlowDefinition(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag,
            params.formFlowDefinitionKey,
            {
              ...(JSON.parse(updatedModelValue) as FormFlowDefinition),
              key: params.formFlowDefinitionKey,
            }
          )
        ),
        finalize(() => this.loading$.next(false))
      )
      .subscribe(result => {
        this.showSuccessMessage(result.key);
      });
  }

  public onDelete(): void {
    this.loading$.next(true);
    this._params$
      .pipe(
        take(1),
        switchMap((params: CaseManagementParams & {formFlowDefinitionKey: string}) =>
          this.formFlowService.deleteFormFlowDefinition(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag,
            params.formFlowDefinitionKey
          )
        )
      )
      .subscribe(() => {
        this.router.navigate(['../'], {relativeTo: this.route});
      });
  }

  public showDeleteModal(): void {
    this.showDeleteModal$.next(true);
  }

  public downloadFormFlowDefinition(model: EditorModel): void {
    this._params$
      .pipe(take(1))
      .subscribe((params: CaseManagementParams & {formFlowDefinitionKey: string}) =>
        this.formFlowDownloadService.downloadJson(JSON.parse(model.value), params)
      );
  }

  public navigateBack(): void {
    this.router.navigate(['../'], {relativeTo: this.route});
  }

  private getEditorModel(formFlowDefinition: FormFlowDefinition): EditorModel {
    const clone = {...formFlowDefinition};
    delete clone.readOnly;
    return {
      value: JSON.stringify(clone),
      language: 'json',
    };
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

  private initBreadcrumbs(params: FormFlowEditorParams): void {
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
