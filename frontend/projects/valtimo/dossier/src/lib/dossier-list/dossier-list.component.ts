/*
 * Copyright 2015-2020 Ritense BV, the Netherlands.
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

import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute, NavigationEnd, Router} from '@angular/router';
import {TranslateService} from '@ngx-translate/core';
import {DefinitionColumn} from '@valtimo/config';
import {
  DocumentSearchRequest,
  DocumentSearchRequestImpl,
  DocumentService,
  SortState,
  ProcessDocumentDefinition,
} from '@valtimo/document';
import moment from 'moment';
import {combineLatest, Subscription} from 'rxjs';
import {DefaultTabs} from '../dossier-detail-tab-enum';
import {DossierProcessStartModalComponent} from '../dossier-process-start-modal/dossier-process-start-modal.component';
import {DossierService} from '../dossier.service';

// eslint-disable-next-line no-var
declare var $;

moment.locale(localStorage.getItem('langKey') || '');

@Component({
  selector: 'valtimo-dossier-list',
  templateUrl: './dossier-list.component.html',
  styleUrls: ['./dossier-list.component.css'],
})
export class DossierListComponent implements OnInit, OnDestroy {
  public documentDefinitionName = '';
  public implementationDefinitions: any;
  public showCreateDocument = false;
  public schema: any;
  public documents: any;
  public items: Array<any> = [];
  public fields: Array<any> = [];
  public processDefinitionListFields: Array<any> = [];
  public processDocumentDefinitions: ProcessDocumentDefinition[] = [];
  public pagination = {
    collectionSize: 0,
    page: 1,
    size: 10,
    maxPaginationItemSize: 5,
    sort: undefined,
  };
  public globalSearchFilter: string | undefined;
  public sequence: number | undefined;
  public createdBy: string | undefined;
  private selectedProcessDocumentDefinition: ProcessDocumentDefinition | null = null;
  private modalListenerAdded = false;
  @ViewChild('processStartModal') processStart: DossierProcessStartModalComponent;

  private routerSubscription: Subscription;

  private translationSubscription: Subscription;

  initialSortState: SortState;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly dossierService: DossierService
  ) {}

  ngOnInit(): void {
    this.doInit();
    this.routeEvent(this.router);
    this.modalListenerAdded = false;
  }

  ngOnDestroy(): void {
    this.routerSubscription.unsubscribe();
    this.translationSubscription.unsubscribe();
  }

  paginationSet() {
    this.getData();
  }

  private routeEvent(router: Router) {
    this.routerSubscription = router.events.subscribe(e => {
      if (e instanceof NavigationEnd) {
        this.doInit();
        this.getData();
      }
    });
  }

  public doInit() {
    const documentDefinitionName = this.route.snapshot.paramMap.get('documentDefinitionName') || '';
    const columns: Array<DefinitionColumn> =
      this.dossierService.getDefinitionColumns(documentDefinitionName);

    this.documentDefinitionName = documentDefinitionName;
    this.initialSortState = this.dossierService.getInitialSortState(columns);

    this.openTranslationSubscription(columns);
  }

  private openTranslationSubscription(columns: Array<DefinitionColumn>): void {
    this.translationSubscription = combineLatest(
      columns.map(column => this.translateService.stream(`fieldLabels.${column.translationKey}`))
    ).subscribe(labels => {
      this.fields = columns.map((column, index) => ({
        key: column.propertyName,
        label: labels[index],
        sortable: column.sortable,
        ...(column.viewType && {viewType: column.viewType}),
      }));
    });
  }

  public getData() {
    this.findDocumentDefinition(this.documentDefinitionName);

    if (this.hasCachedSearchRequest()) {
      const documentSearchRequest = this.getCachedSearch();
      this.globalSearchFilter = documentSearchRequest.globalSearchFilter;
      this.sequence = documentSearchRequest.sequence;
      this.createdBy = documentSearchRequest.createdBy;
      this.findDocuments(documentSearchRequest);
    } else {
      this.doSearch();
    }

    this.getAllAssociatedProcessDefinitions();
  }

  public doSearch() {
    const documentSearchRequest = this.buildDocumentSearchRequest();
    this.findDocuments(documentSearchRequest);
  }

  private findDocuments(documentSearchRequest: DocumentSearchRequest) {
    return this.documentService.getDocuments(documentSearchRequest).subscribe(documents => {
      this.documents = documents;
      this.transformDocuments(this.documents.content);
      this.pagination.collectionSize = this.documents.totalElements;
      this.storeSearch(documentSearchRequest);
    });
  }

  public getAllAssociatedProcessDefinitions() {
    this.documentService
      .findProcessDocumentDefinitions(this.documentDefinitionName)
      .subscribe(processDocumentDefinitions => {
        this.processDocumentDefinitions = processDocumentDefinitions.filter(
          processDocumentDefinition => processDocumentDefinition.canInitializeDocument
        );
        this.processDefinitionListFields = [
          {
            key: 'processName',
            label: 'Proces',
          },
        ];
      });
  }

  public getCachedSearch(): DocumentSearchRequest {
    const json = JSON.parse(this.getCachedDocumentSearchRequest());
    return new DocumentSearchRequestImpl(
      json.definitionName,
      this.pagination.page - 1,
      this.pagination.size,
      json.sequence,
      json.createdBy,
      json.globalSearchFilter,
      json.sort
    );
  }

  private buildDocumentSearchRequest(): DocumentSearchRequest {
    return new DocumentSearchRequestImpl(
      this.documentDefinitionName,
      this.pagination.page - 1,
      this.pagination.size,
      this.sequence,
      this.createdBy,
      this.globalSearchFilter,
      this.pagination.sort && this.pagination.sort.isSorting
        ? this.pagination.sort
        : this.initialSortState
    );
  }

  private storeSearch(documentSearchRequest: DocumentSearchRequest) {
    localStorage.setItem(this.getCachedKey(), JSON.stringify(documentSearchRequest));
  }

  private getCachedDocumentSearchRequest(): string {
    return localStorage.getItem(this.getCachedKey()) || '';
  }

  private hasCachedSearchRequest(): boolean {
    return localStorage.getItem(this.getCachedKey()) !== null;
  }

  private getCachedKey(): string {
    return 'list-search-' + this.documentDefinitionName;
  }

  public rowClick(document: any) {
    this.router.navigate([
      `/dossiers/${this.documentDefinitionName}/document/${document.id}/${DefaultTabs.summary}`,
    ]);
  }

  public startDossier() {
    if (this.processDocumentDefinitions.length > 1) {
      $('#startProcess').modal('show');
    } else {
      this.selectedProcessDocumentDefinition = this.processDocumentDefinitions[0];
      this.showStartProcessModal();
    }
  }

  private showStartProcessModal() {
    if (this.selectedProcessDocumentDefinition !== null) {
      this.processStart.openModal(this.selectedProcessDocumentDefinition);
      this.selectedProcessDocumentDefinition = null;
    }
  }

  public selectProcess(processDocumentDefinition: ProcessDocumentDefinition) {
    const modal = $('#startProcess');
    if (!this.modalListenerAdded) {
      modal.on('hidden.bs.modal', this.showStartProcessModal.bind(this));
      this.modalListenerAdded = true;
    }
    this.selectedProcessDocumentDefinition = processDocumentDefinition;
    modal.modal('hide');
  }

  private findDocumentDefinition(documentDefinitionName: string) {
    this.documentService.getDocumentDefinition(documentDefinitionName).subscribe(definition => {
      this.schema = definition.schema;
    });
  }

  private transformDocuments(documentsContent: Array<any>) {
    this.items = documentsContent.map(document => {
      const {content, ...others} = document;
      return {...content, ...others};
    });
  }

  public paginationClicked(page: number) {
    this.pagination.page = page;
    this.doSearch();
  }

  public sortChanged(sortState: SortState) {
    this.pagination.sort = sortState;
    this.doSearch();
  }

  public getInitialSortState(): SortState {
    if (this.hasCachedSearchRequest()) {
      const cachedRequest = JSON.parse(this.getCachedDocumentSearchRequest());
      return cachedRequest.sort ? cachedRequest.sort : this.initialSortState;
    }
    return this.initialSortState;
  }
}
