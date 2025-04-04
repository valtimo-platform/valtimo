import {Component, EventEmitter, Output} from '@angular/core';
import {ActivatedRoute, Router} from '@angular/router';
import {BehaviorSubject, combineLatest, map, Observable, of, switchMap, tap} from 'rxjs';
import {Upload16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {FormManagementService} from '../../services';
import {CarbonListModule, ColumnConfig, Pagination} from '@valtimo/components';
import {FormDefinition, FormManagementParams} from '../../models';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms'; // For translation support
import {ManagementContext} from '@valtimo/config';

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

  public readonly context$: Observable<ManagementContext | ''> = this.route.data.pipe(
    map(data => data && (data['context'] as ManagementContext))
  );

  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly searchTerm$ = new BehaviorSubject<string>('');

  public readonly caseManagementRouteParams$: Observable<FormManagementParams | null> = this.route
    .parent
    ? this.route.parent.params.pipe(
        map(({caseDefinitionName, caseVersionTag}) =>
          caseDefinitionName && caseVersionTag
            ? {
                definitionName: caseDefinitionName,
                versionTag: caseVersionTag,
              }
            : null
        )
      )
    : of(null);

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
    this.caseManagementRouteParams$,
    this._partialPagination$,
    this.searchTerm$,
  ]).pipe(
    switchMap(([context, routeParams, pagination, searchTerm]) => {
      const params = {
        ...pagination,
        page: pagination.page - 1,
        ...(searchTerm && {searchTerm}),
      };

      switch (context) {
        case 'case':
          return this.formManagementService.queryFormDefinitionsCase(
            routeParams.definitionName,
            routeParams.versionTag,
            params
          );
        default:
        case 'independent':
          return this.formManagementService.queryFormDefinitions(params);
      }
    }),
    map(res => {
      this._collectionSize$.next(res.totalElements);

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
    private readonly router: Router,
    private readonly route: ActivatedRoute
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
