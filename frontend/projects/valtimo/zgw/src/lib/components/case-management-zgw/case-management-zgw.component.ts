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
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {CaseManagementParams, getCaseManagementRouteParams} from '@valtimo/shared';
import {TabsModule} from 'carbon-components-angular';
import {BehaviorSubject, combineLatest, filter, map, Observable, switchMap, tap} from 'rxjs';
import {ZgwTab, ZgwTabEnum} from '../../models';
import {
  DocumentenApiColumnsComponent,
  DocumentenApiTagsComponent,
  DocumentenApiUploadFieldsComponent,
  DocumentenApiVersionService,
  SupportedDocumentenApiFeatures,
} from '../../modules';
import {CaseManagementZgwService} from '../../services';
import {CaseManagementZgwGeneralComponent} from '../case-management-zgw-general/case-management-zgw-general.component';

@Component({
  templateUrl: './case-management-zgw.component.html',
  styleUrl: './case-management-zgw.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, TabsModule, TranslateModule],
})
export class CaseManagementZgwComponent implements AfterViewInit, OnDestroy {
  @ViewChild('zgwTabContent', {read: ViewContainerRef})
  private _zgwTabContent: ViewContainerRef;

  private readonly _viewInitialized$ = new BehaviorSubject<boolean>(false);

  private readonly _supportedDocumentenApiFeatures$: Observable<SupportedDocumentenApiFeatures> =
    getCaseManagementRouteParams(this.route).pipe(
      map((params: CaseManagementParams | undefined) => params?.caseDefinitionKey ?? ''),
      filter((caseDefinitionKey: string) => !!caseDefinitionKey),
      switchMap((caseDefinitionKey: string) =>
        this.documentenApiVersionService.getSupportedApiFeatures(caseDefinitionKey ?? '')
      )
    );

  public readonly zgwTabs$: Observable<ZgwTab[]> = combineLatest([
    this._viewInitialized$,
    this.caseManagementZgwService.currentTab$,
    this._supportedDocumentenApiFeatures$,
  ]).pipe(
    filter(([viewInitialized]) => viewInitialized),
    map(([_, currentTab, supportedDocumentenApiFeatures]) =>
      [
        {
          class: 'no-padding-left-right no-padding-top-bottom',
          headingTranslationKey: 'caseManagement.tabs.general',
          tab: ZgwTabEnum.GENERAL,
          component: CaseManagementZgwGeneralComponent,
        },
        {
          class: 'no-padding-left-right no-padding-top-bottom',
          headingTranslationKey: 'zgw.tabs.documentColumns',
          tab: ZgwTabEnum.DOCUMENTEN_API_COLUMNS,
          component: DocumentenApiColumnsComponent,
        },
        {
          class: 'no-padding-left-right no-padding-top-bottom',
          headingTranslationKey: 'zgw.tabs.documentUploadFields',
          tab: ZgwTabEnum.DOCUMENTEN_API_UPLOAD_FIELDS,
          component: DocumentenApiUploadFieldsComponent,
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
      if (!activeTab) return;

      this._zgwTabContent.clear();
      this._zgwTabContent.createComponent(activeTab.component);
      this.cdr.detectChanges();
    })
  );

  constructor(
    private readonly caseManagementZgwService: CaseManagementZgwService,
    private readonly cdr: ChangeDetectorRef,
    private readonly documentenApiVersionService: DocumentenApiVersionService,
    private readonly route: ActivatedRoute
  ) {}

  public ngAfterViewInit(): void {
    this._viewInitialized$.next(true);
  }

  public ngOnDestroy(): void {
    this.caseManagementZgwService.resetToDefaultTab();
  }

  public displayTab(tab: ZgwTabEnum): void {
    this.caseManagementZgwService.currentTab = tab;
  }
}
