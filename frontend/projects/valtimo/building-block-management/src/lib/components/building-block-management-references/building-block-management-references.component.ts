/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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
  OnInit,
  signal,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {RouterLink} from '@angular/router';
import {toSignal} from '@angular/core/rxjs-interop';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CarbonListModule, ColumnConfig, ViewType} from '@valtimo/components';
import {BuildingBlockReferenceDto, EnvironmentService} from '@valtimo/shared';
import {Migrate16} from '@carbon/icons';
import {ButtonModule, IconModule, IconService} from 'carbon-components-angular';
import {catchError, combineLatest, distinctUntilChanged, map, of, switchMap, tap} from 'rxjs';
import {isEqual} from 'lodash';
import {
  BUILDING_BLOCK_MANAGEMENT_REFERENCES_TEST_IDS,
  BUILDING_BLOCK_MANAGEMENT_TABS,
} from '../../constants';
import {BuildingBlockReferenceItem} from '../../models';
import {
  BuildingBlockManagementDetailService,
  BuildingBlockReferenceUpdateApiService,
} from '../../services';
import {BuildingBlockManagementReferenceUpdateModalComponent} from '../building-block-management-reference-update-modal/building-block-management-reference-update-modal.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-references',
  templateUrl: './building-block-management-references.component.html',
  styleUrls: ['./building-block-management-references.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    ButtonModule,
    IconModule,
    CarbonListModule,
    BuildingBlockManagementReferenceUpdateModalComponent,
  ],
})
export class BuildingBlockManagementReferencesComponent implements OnInit {
  @ViewChild('linkColumn', {static: true}) public linkColumnTemplate!: TemplateRef<unknown>;

  public readonly $fields = signal<ColumnConfig[]>([]);

  public readonly $loading = signal<boolean>(true);

  public readonly canUpdate$ = this.environmentService.canUpdateGlobalConfiguration();

  public readonly references$ = combineLatest([
    this.buildingBlockManagementDetailService.buildingBlockDefinitionKey$,
    this.buildingBlockManagementDetailService.buildingBlockDefinitionVersionTag$,
  ]).pipe(
    distinctUntilChanged((a, b) => isEqual(a, b)),
    switchMap(([key, versionTag]) =>
      this.buildingBlockManagementDetailService.reloadReferences$.pipe(
        tap(() => this.$loading.set(true)),
        switchMap(() =>
          this.buildingBlockReferenceUpdateApiService
            .getReferences(key, versionTag)
            .pipe(catchError(() => of([])))
        )
      )
    ),
    map(references => references.map(reference => this.toItem(reference))),
    tap(() => this.$loading.set(false))
  );

  public readonly $references = toSignal(this.references$, {initialValue: []});

  protected readonly testIds = BUILDING_BLOCK_MANAGEMENT_REFERENCES_TEST_IDS;

  constructor(
    private readonly buildingBlockManagementDetailService: BuildingBlockManagementDetailService,
    private readonly buildingBlockReferenceUpdateApiService: BuildingBlockReferenceUpdateApiService,
    private readonly environmentService: EnvironmentService,
    private readonly iconService: IconService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([Migrate16]);
  }

  public ngOnInit(): void {
    this.$fields.set([
      {key: 'containerTypeText', label: 'buildingBlockManagement.references.containerType'},
      {key: 'container.key', label: 'buildingBlockManagement.references.key'},
      {key: 'container.versionTag', label: 'buildingBlockManagement.references.versionTag'},
      {
        key: 'statusTags',
        label: 'buildingBlockManagement.references.status',
        viewType: ViewType.TAGS,
      },
      {key: 'locationText', label: 'buildingBlockManagement.references.location'},
      {
        key: 'link',
        label: 'buildingBlockManagement.references.goTo',
        viewType: ViewType.TEMPLATE,
        template: this.linkColumnTemplate,
      },
    ]);
  }

  public onUpdateReferencesClick(): void {
    this.buildingBlockManagementDetailService.showReferenceUpdateModal();
  }

  private toItem(reference: BuildingBlockReferenceDto): BuildingBlockReferenceItem {
    return {
      ...reference,
      containerTypeText: this.translateService.instant(
        `buildingBlockManagement.referenceUpdate.containerType.${reference.container.type}`
      ),
      statusTags: [
        reference.container.final
          ? {
              content: this.translateService.instant(
                'buildingBlockManagement.referenceUpdate.final'
              ),
              type: 'green',
            }
          : {
              content: this.translateService.instant(
                'buildingBlockManagement.referenceUpdate.draft'
              ),
              type: 'red',
            },
      ],
      locationText:
        reference.kind === 'CASE_LINK'
          ? this.translateService.instant('buildingBlockManagement.references.caseLink')
          : this.translateService.instant('buildingBlockManagement.references.processLink', {
              processDefinitionKey: reference.processDefinitionKey,
              activityId: reference.activityId,
            }),
      linkRoute: this.linkRoute(reference),
      linkText: this.translateService.instant(
        reference.kind === 'CASE_LINK'
          ? 'buildingBlockManagement.references.actionsLink'
          : 'buildingBlockManagement.references.processDefinitionLink'
      ),
    };
  }

  private linkRoute(reference: BuildingBlockReferenceDto): string[] {
    const {type, key, versionTag} = reference.container;

    if (type === 'CASE') {
      return reference.kind === 'CASE_LINK'
        ? ['/case-management', 'case', key, 'version', versionTag, 'actions']
        : [
            '/case-management',
            'case',
            key,
            'version',
            versionTag,
            'processes',
            reference.processDefinitionKey ?? '',
          ];
    }

    return [
      '/building-block-management',
      'building-block',
      key,
      'version',
      versionTag,
      BUILDING_BLOCK_MANAGEMENT_TABS.PROCESSES,
      reference.processDefinitionKey ?? '',
    ];
  }
}
