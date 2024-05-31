/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {TabsModule} from 'carbon-components-angular';
import {DossierManagementZgwService} from '../../services';
import {ZgwTab, ZgwTabEnum} from '../../models';
import {TranslateModule} from '@ngx-translate/core';
import {CommonModule} from '@angular/common';
import {
  DocumentenApiColumnsComponent,
  DocumentenApiTagsComponent,
  DocumentenApiVersionService,
  SupportedDocumentenApiFeatures,
} from '../../modules';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {ActivatedRoute} from '@angular/router';

@Component({
  templateUrl: './dossier-management-zgw.component.html',
  styleUrls: ['./dossier-management-zgw.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TabsModule,
    TranslateModule,
    DocumentenApiTagsComponent,
    DocumentenApiColumnsComponent,
  ],
})
export class DossierManagementZgwComponent implements AfterViewInit, OnDestroy {
  @ViewChild('zgwTabContent', {read: ViewContainerRef})
  private _zgwTabContent: ViewContainerRef;

  private readonly _viewInitialized$ = new BehaviorSubject<boolean>(false);

  private readonly _supportedDocumentenApiFeatures$: Observable<SupportedDocumentenApiFeatures> =
    this.route.params.pipe(
      map(params => params?.name),
      filter(caseDefinitionName => !!caseDefinitionName),
      switchMap(caseDefinitionName =>
        this.documentenApiVersionService.getSupportedApiFeatures(caseDefinitionName)
      )
    );

  public readonly zgwTabs$: Observable<ZgwTab[]> = combineLatest([
    this._viewInitialized$,
    this.dossierManagementZgwService.currentTab$,
    this._supportedDocumentenApiFeatures$,
  ]).pipe(
    filter(([viewInitialized]) => viewInitialized),
    map(([_, currentTab, supportedDocumentenApiFeatures]) =>
      [
        {
          class: 'no-padding-left-right no-padding-top-bottom',
          headingTranslationKey: 'zgw.tabs.documentColumns',
          tab: ZgwTabEnum.DOCUMENTEN_API_COLUMNS,
          component: DocumentenApiColumnsComponent,
        },
        ...(supportedDocumentenApiFeatures.supportsTrefwoorden
          ? [
              {
                class: 'no-padding-left-right no-padding-top-bottom',
                headingTranslationKey: 'zgw.tabs.documentTags',
                tab: ZgwTabEnum.DOCUMENTEN_API_TAGS,
                component: DocumentenApiTagsComponent,
              },
            ]
          : []),
      ].map(zgwTab => ({...zgwTab, active: currentTab === zgwTab.tab}))
    ),
    tap(zgwTabs => {
      const activeTab = zgwTabs.length > 1 ? zgwTabs.find(tab => tab.active) : zgwTabs[0];
      this._zgwTabContent.clear();
      this._zgwTabContent.createComponent(activeTab.component);
      this.cdr.detectChanges();
    })
  );

  constructor(
    private readonly dossierManagementZgwService: DossierManagementZgwService,
    private readonly cdr: ChangeDetectorRef,
    private readonly documentenApiVersionService: DocumentenApiVersionService,
    private readonly route: ActivatedRoute
  ) {}

  public ngAfterViewInit(): void {
    this._viewInitialized$.next(true);
  }

  public ngOnDestroy(): void {
    this.dossierManagementZgwService.resetToDefaultTab();
  }

  public displayTab(tab: ZgwTabEnum): void {
    this.dossierManagementZgwService.currentTab = tab;
  }
}
