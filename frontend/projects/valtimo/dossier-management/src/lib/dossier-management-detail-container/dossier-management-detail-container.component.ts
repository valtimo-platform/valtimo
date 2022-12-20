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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {DocumentService} from '@valtimo/document';
import {filter, map, Observable, Subscription, switchMap} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {TabService} from '../tab.service';
import {TabEnum} from '../tab.enum';

@Component({
  selector: 'valtimo-dossier-management-detail-container',
  templateUrl: './dossier-management-detail-container.component.html',
  styleUrls: ['./dossier-management-detail-container.component.css'],
})
export class DossierManagementDetailContainerComponent implements OnInit, OnDestroy {
  public currentTab: TabEnum;
  public caseListColumn!: boolean;

  private tabSubscription: Subscription;

  readonly TabEnum = TabEnum;

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName)
  );

  readonly documentDefinition$ = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getDocumentDefinition(documentDefinitionName)
    )
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly configService: ConfigService,
    private readonly tabService: TabService
  ) {
    this.caseListColumn = this.configService.config.featureToggles.caseListColumn;
  }

  ngOnInit(): void {
    this.openCurrentTabSubscription();
  }

  displayBodyComponent(tab: TabEnum): void {
    this.tabService.currentTab = tab;
  }

  openCurrentTabSubscription(): void {
    this.tabSubscription = this.tabService.currentTab$.subscribe(
      value => (this.currentTab = value)
    );
  }

  ngOnDestroy(): void {
    this.tabService.currentTab = TabEnum.CASE;
    this.tabSubscription?.unsubscribe();
  }
}
