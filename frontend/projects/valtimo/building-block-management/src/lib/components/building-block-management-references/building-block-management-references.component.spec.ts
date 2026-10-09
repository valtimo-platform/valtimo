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

import {Component, Input} from '@angular/core';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {CarbonListModule} from '@valtimo/components';
import {BuildingBlockReferenceDto, EnvironmentService} from '@valtimo/shared';
import {BehaviorSubject, of} from 'rxjs';
import {BUILDING_BLOCK_MANAGEMENT_REFERENCES_TEST_IDS} from '../../constants';
import {
  BuildingBlockManagementDetailService,
  BuildingBlockReferenceUpdateApiService,
} from '../../services';
import {BuildingBlockManagementReferenceUpdateModalComponent} from '../building-block-management-reference-update-modal/building-block-management-reference-update-modal.component';
import {BuildingBlockManagementReferencesComponent} from './building-block-management-references.component';

@Component({
  standalone: true,
  selector: 'valtimo-building-block-management-reference-update-modal',
  template: '',
})
class ReferenceUpdateModalStubComponent {}

@Component({
  standalone: true,
  selector: 'valtimo-carbon-list',
  template: '<ng-content select="[carbonToolbarContent]"></ng-content>',
})
class CarbonListStubComponent {
  @Input() public fields: unknown;
  @Input() public items: unknown;
  @Input() public loading: unknown;
}

@Component({
  standalone: true,
  selector: 'valtimo-no-results',
  template: '',
})
class NoResultsStubComponent {
  @Input() public description: unknown;
  @Input() public title: unknown;
}

describe('BuildingBlockManagementReferencesComponent', () => {
  let fixture: ComponentFixture<BuildingBlockManagementReferencesComponent>;
  let component: BuildingBlockManagementReferencesComponent;
  let referenceUpdateApi: jasmine.SpyObj<BuildingBlockReferenceUpdateApiService>;
  let reloadReferences$: BehaviorSubject<null>;
  let showReferenceUpdateModal: jasmine.Spy;

  const reference = (overrides: Partial<BuildingBlockReferenceDto>): BuildingBlockReferenceDto => ({
    container: {type: 'CASE', key: 'moving', versionTag: '1.3.0', final: false},
    kind: 'PROCESS_LINK',
    processDefinitionKey: 'main',
    activityId: 'callSendEmail',
    buildingBlockKey: 'send-email',
    buildingBlockVersionTag: '1.0.0',
    ...overrides,
  });

  const updateButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector(
      `[data-test-id="${BUILDING_BLOCK_MANAGEMENT_REFERENCES_TEST_IDS.updateReferencesButton}"]`
    );

  beforeEach(() => {
    referenceUpdateApi = jasmine.createSpyObj<BuildingBlockReferenceUpdateApiService>(
      'BuildingBlockReferenceUpdateApiService',
      ['getReferences']
    );
    referenceUpdateApi.getReferences.and.returnValue(
      of([
        reference({}),
        reference({
          container: {type: 'CASE', key: 'notify', versionTag: '1.1.0', final: true},
          kind: 'CASE_LINK',
          processDefinitionKey: null,
          activityId: null,
        }),
        reference({
          container: {type: 'BUILDING_BLOCK', key: 'outer', versionTag: '2.0.0', final: false},
          processDefinitionKey: 'outer-main',
        }),
      ])
    );
    reloadReferences$ = new BehaviorSubject<null>(null);
    showReferenceUpdateModal = jasmine.createSpy('showReferenceUpdateModal');

    TestBed.overrideComponent(BuildingBlockManagementReferencesComponent, {
      remove: {imports: [BuildingBlockManagementReferenceUpdateModalComponent, CarbonListModule]},
      add: {
        imports: [
          ReferenceUpdateModalStubComponent,
          CarbonListStubComponent,
          NoResultsStubComponent,
        ],
      },
    });
    TestBed.configureTestingModule({
      imports: [BuildingBlockManagementReferencesComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {provide: BuildingBlockReferenceUpdateApiService, useValue: referenceUpdateApi},
        {provide: EnvironmentService, useValue: {canUpdateGlobalConfiguration: () => of(true)}},
        {
          provide: BuildingBlockManagementDetailService,
          useValue: {
            buildingBlockDefinitionKey$: of('send-email'),
            buildingBlockDefinitionVersionTag$: of('1.0.0'),
            reloadReferences$,
            showReferenceUpdateModal,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(BuildingBlockManagementReferencesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists the references to the building block version of the page', () => {
    expect(referenceUpdateApi.getReferences).toHaveBeenCalledOnceWith('send-email', '1.0.0');
    expect(component.$loading()).toBeFalse();
    expect(
      component.$references().map(item => [item.container.key, item.statusTags[0].type])
    ).toEqual([
      ['moving', 'red'],
      ['notify', 'green'],
      ['outer', 'red'],
    ]);
    expect(component.$references()[0].locationText).toBe(
      'buildingBlockManagement.references.processLink'
    );
    expect(component.$references()[1].locationText).toBe(
      'buildingBlockManagement.references.caseLink'
    );
  });

  it('links each reference to the process or actions tab of its container', () => {
    expect(component.$references().map(item => item.linkRoute)).toEqual([
      ['/case-management', 'case', 'moving', 'version', '1.3.0', 'processes', 'main'],
      ['/case-management', 'case', 'notify', 'version', '1.1.0', 'actions'],
      [
        '/building-block-management',
        'building-block',
        'outer',
        'version',
        '2.0.0',
        'process-definition',
        'outer-main',
      ],
    ]);
    expect(component.$fields().at(-1)?.template).toBe(component.linkColumnTemplate);
  });

  it('opens the reference update wizard from the update button', () => {
    expect(updateButton().disabled).toBeFalse();

    updateButton().click();

    expect(showReferenceUpdateModal).toHaveBeenCalledTimes(1);
  });

  it('disables the update button when nothing references the version', () => {
    referenceUpdateApi.getReferences.and.returnValue(of([]));
    reloadReferences$.next(null);
    fixture.detectChanges();

    expect(referenceUpdateApi.getReferences).toHaveBeenCalledTimes(2);
    expect(updateButton().disabled).toBeTrue();
  });
});
