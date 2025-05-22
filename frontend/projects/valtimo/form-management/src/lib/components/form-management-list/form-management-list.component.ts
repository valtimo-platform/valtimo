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
import {Component, EventEmitter, Output} from '@angular/core';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute} from '@angular/router';
import {Upload16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule, ColumnConfig, Pagination} from '@valtimo/components';
import {EnvironmentService, getCaseManagementRouteParams} from '@valtimo/shared';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  map,
  Observable,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import {FormDefinition} from '../../models';
import {FormManagementService} from '../../services';
import {getContextObservable} from '../../utils';

@Component({
  selector: 'valtimo-form-management-list',
  templateUrl: './form-management-list.component.html',
  styleUrls: ['./form-management-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    CarbonListModule,
    IconModule,
    ButtonModule,
  ],
})
export class FormManagementListComponent {
  @Output() public readonly navigateToCreateEvent = new EventEmitter<void>();
  @Output() public readonly navigateToUploadEvent = new EventEmitter<void>();
  @Output() public readonly navigateToEditEvent = new EventEmitter<string>();

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly searchTerm$ = new BehaviorSubject<string>('');

  public readonly context$ = getContextObservable(this.route);

  public readonly canUpdateGlobalConfiguration$ =
    this.environmentService.canUpdateGlobalConfiguration();

  public readonly caseManagementRouteParams$ = this.context$.pipe(
    filter(context => context === 'case'),
    switchMap(() => getCaseManagementRouteParams(this.route))
  );

  private readonly _collectionSize$ = new BehaviorSubject<number>(0);

  private readonly _partialPagination$ = new BehaviorSubject<Partial<Pagination>>({
    page: 1,
    size: 10,
  });

  private get _partialPagination(): Partial<Pagination> {
    return this._partialPagination$.getValue();
  }

  public pagination$: Observable<Pagination> = combineLatest([
    this._collectionSize$,
    this._partialPagination$,
  ]).pipe(
    map(
      ([collectionSize, partialPagination]) =>
        ({...partialPagination, collectionSize}) as Pagination
    )
  );

  public readonly formDefinitions$ = combineLatest([
    this.context$,
    this.caseManagementRouteParams$.pipe(startWith(null)),
    this._partialPagination$,
    this.searchTerm$,
  ]).pipe(
    filter(([context, params]) =>
      context === 'case' ? !!(params?.caseDefinitionVersionTag && params?.caseDefinitionKey) : true
    ),
    switchMap(([context, routeParams, pagination, searchTerm]) => {
      const params = {
        ...pagination,
        page: pagination.page - 1,
        ...(searchTerm && {searchTerm}),
      };

      switch (context) {
        case 'case':
          return this.formManagementService.queryFormDefinitionsCase(
            routeParams.caseDefinitionKey,
            routeParams.caseDefinitionVersionTag,
            params
          );
        default:
        case 'independent':
          return this.formManagementService.queryFormDefinitions(params);
      }
    }),
    map(res => {
      this._collectionSize$.next(res?.totalElements);

      return res?.content || [];
    }),
    tap(() => this.loading$.next(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {key: 'name', label: 'Form name'},
    {key: 'readOnly', label: 'Read-only'},
  ];

  constructor(
    private readonly formManagementService: FormManagementService,
    private readonly iconService: IconService,
    private readonly route: ActivatedRoute,
    private readonly environmentService: EnvironmentService
  ) {
    this.iconService.registerAll([Upload16]);
  }

  public navigateToCreateRoute(): void {
    this.navigateToCreateEvent.emit();
  }

  public navigateToUploadRoute(): void {
    this.navigateToUploadEvent.emit();
  }

  public paginationClicked(page: number): void {
    this.updatePagination({page});
  }

  public paginationSet(size: number): void {
    this.updatePagination({size, page: 1});
  }

  public editFormDefinition(formDefinition: FormDefinition): void {
    this.navigateToEditEvent.emit(formDefinition.id);
  }

  public searchTermEntered(searchTerm: string): void {
    this.searchTerm$.next(searchTerm);
  }

  private updatePagination(update: Partial<Pagination>): void {
    this._partialPagination$.next({...this._partialPagination, ...update});
  }
}
