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
import {ChangeDetectionStrategy, Component, ViewChild} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {ActionItem, CarbonListComponent, ColumnConfig, ViewType} from '@valtimo/components';
import {
  CaseManagementParams,
  getCaseManagementRouteParams,
  GlobalNotificationService,
  Page,
} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {FormFlowDefinition, ListFormFlowDefinition} from '../../models';
import {FormFlowService} from '../../services';

@Component({
  standalone: false,
  templateUrl: './form-flow-overview.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormFlowOverviewComponent {
  @ViewChild(CarbonListComponent) carbonList: CarbonListComponent;

  public readonly FIELDS: ColumnConfig[] = [
    {
      viewType: ViewType.TEXT,
      key: 'key',
      label: 'formFlow.key',
    },
    {
      viewType: ViewType.TEXT,
      key: 'versions.0',
      label: 'formFlow.version',
    },
    {
      viewType: ViewType.BOOLEAN,
      key: 'readOnly',
      label: 'formFlow.readOnly',
    },
  ];

  public readonly ACTION_ITEMS: ActionItem[] = [
    {
      callback: this.editFormFlowDetails.bind(this),
      label: 'interface.edit',
    },
    {
      callback: this.deleteFormFlow.bind(this),
      label: 'interface.delete',
      type: 'danger',
    },
  ];

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly showDeleteModal$ = new BehaviorSubject<boolean>(false);
  public readonly deleteDefinitionKey$ = new BehaviorSubject<string | null>(null);

  private _params: CaseManagementParams | undefined = undefined;
  private readonly _refresh$ = new BehaviorSubject<null>(null);
  public readonly formFlowDefinitions$: Observable<ListFormFlowDefinition[]> = combineLatest([
    getCaseManagementRouteParams(this.route),
    this._refresh$,
  ]).pipe(
    tap(([params]) => {
      this.loading$.next(true);
      this._params = params;
    }),
    switchMap(([params]) =>
      !params
        ? of(null)
        : this.formFlowService.getFormFlowDefinitions(
            params.caseDefinitionKey,
            params.caseDefinitionVersionTag
          )
    ),
    map((formFlows: Page<ListFormFlowDefinition> | null) => {
      this.loading$.next(false);
      return !formFlows ? [] : formFlows.content;
    })
  );
  public readonly showAddModal$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly formFlowService: FormFlowService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly translateService: TranslateService
  ) {}

  public openAddModal(): void {
    this.showAddModal$.next(true);
  }

  public onAdd(formFlowDefinition: FormFlowDefinition | null): void {
    this.showAddModal$.next(false);

    if (!formFlowDefinition || !this._params) return;

    this.formFlowService
      .createFormFlowDefinition(
        this._params.caseDefinitionKey,
        this._params.caseDefinitionVersionTag,
        formFlowDefinition
      )
      .subscribe((formFlowDefinition: FormFlowDefinition) => {
        this.showAddModal$.next(false);
        this.router.navigate([formFlowDefinition.key], {relativeTo: this.route});
      });
  }

  public editFormFlowDetails(formFlowDefinition: ListFormFlowDefinition): void {
    this.router.navigate([formFlowDefinition.key], {relativeTo: this.route});
  }

  public deleteFormFlow(item: ListFormFlowDefinition): void {
    this.deleteDefinitionKey$.next(item.key);
    this.showDeleteModal$.next(true);
  }

  public onDelete(definitionKey: string): void {
    if (!this._params) return;

    this.formFlowService
      .deleteFormFlowDefinition(
        this._params.caseDefinitionKey,
        this._params.caseDefinitionVersionTag,
        definitionKey
      )
      .subscribe(() => {
        this.globalNotificationService.showToast({
          title: this.translateService.instant('interface.delete'),
          caption: this.translateService.instant('formFlow.deletedSuccessfully', {
            key: definitionKey,
          }),
          type: 'success',
        });
        this._refresh$.next(null);
      });
  }
}
