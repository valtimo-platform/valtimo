/*
 * Copyright 2015-2023 Ritense BV, the Netherlands.
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
import {TabService} from '../../services';
import {TabEnum} from '../../models';
import {PageTitleService} from '@valtimo/components';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-dossier-management-detail-container',
  templateUrl: './dossier-management-detail-container.component.html',
  styleUrls: ['./dossier-management-detail-container.component.css'],
})
export class DossierManagementDetailContainerComponent implements OnInit, OnDestroy {
  public currentTab: TabEnum;
  public caseListColumn!: boolean;
  public tabManagementEnabled!: boolean;

  public readonly documentDefinitionTitle$ = this.pageTitleService.customPageTitle$;

  private tabSubscription: Subscription;

  readonly TabEnum = TabEnum;

  readonly documentDefinitionName$: Observable<string> = this.route.params.pipe(
    map(params => params.name || ''),
    filter(docDefName => !!docDefName)
  );

  readonly documentDefinition$ = this.documentDefinitionName$.pipe(
    switchMap(documentDefinitionName =>
      this.documentService.getDocumentDefinitionForManagement(documentDefinitionName)
    ),
    tap(documentDefinition => {
      this.pageTitleService.setCustomPageTitle(documentDefinition.schema.title);
    })
  );

  constructor(
    private readonly documentService: DocumentService,
    private readonly route: ActivatedRoute,
    private readonly configService: ConfigService,
    private readonly tabService: TabService,
    private readonly pageTitleService: PageTitleService
  ) {
    const featureToggles = this.configService.config.featureToggles;
    this.caseListColumn = featureToggles?.caseListColumn;
    this.tabManagementEnabled = featureToggles?.enableTabManagement;
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
