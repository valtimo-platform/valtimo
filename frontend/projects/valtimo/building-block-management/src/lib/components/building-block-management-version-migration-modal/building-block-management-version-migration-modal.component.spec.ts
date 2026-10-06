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

import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {PluginManagementService} from '@valtimo/plugin';
import {
  BuildingBlockVersionMigrationChainDto,
  BuildingBlockVersionMigrationPreviewDto,
  BuildingBlockVersionMigrationPreviewRequestDto,
} from '@valtimo/shared';
import {of} from 'rxjs';
import {
  BUILDING_BLOCK_MANAGEMENT_VERSION_MIGRATION_TEST_IDS,
  VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS,
  VERSION_MIGRATION_STEP,
} from '../../constants';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementService,
  BuildingBlockVersionMigrationApiService,
} from '../../services';
import {BuildingBlockManagementVersionMigrationModalComponent} from './building-block-management-version-migration-modal.component';

describe('BuildingBlockManagementVersionMigrationModalComponent', () => {
  let fixture: ComponentFixture<BuildingBlockManagementVersionMigrationModalComponent>;
  let component: BuildingBlockManagementVersionMigrationModalComponent;
  let migrationApi: jasmine.SpyObj<BuildingBlockVersionMigrationApiService>;
  let chainOverrides: Record<string, Partial<BuildingBlockVersionMigrationChainDto>>;
  let draftsAllowed: boolean;

  const SOURCE = {
    key: 'send-email',
    versionTag: '1.0.0',
    name: 'Send email',
    final: true,
    referenceCount: 3,
  };

  const chain = (
    id: string,
    overrides: Partial<BuildingBlockVersionMigrationChainDto>
  ): BuildingBlockVersionMigrationChainDto => {
    const container = {type: 'CASE' as const, key: `case-${id}`, versionTag: '1.0.0', final: false};
    const link = {
      container,
      kind: 'PROCESS_LINK' as const,
      processDefinitionKey: 'main',
      activityId: `call-${id}`,
      buildingBlockKey: 'send-email',
      buildingBlockVersionTag: '1.0.0',
    };
    return {
      id,
      containers: [container],
      references: [link],
      link,
      selected: false,
      selectedByDefault: false,
      requiresDrafts: false,
      modifiesExistingDraft: false,
      existingDrafts: [],
      migratable: true,
      notMigratableReason: null,
      differences: {
        existingInputMappings: [],
        missingRequiredInputs: [],
        droppedInputMappings: [],
        droppedOutputMappings: [],
        missingPluginDefinitionKeys: [],
        pluginConfigurationLink: null,
        unresolvedRequiredInputs: [],
        unresolvedPluginDefinitionKeys: [],
        configured: true,
      },
      ...overrides,
    };
  };

  const previewFor = (
    request: BuildingBlockVersionMigrationPreviewRequestDto
  ): BuildingBlockVersionMigrationPreviewDto => {
    const ids = ['draft-chain', 'final-chain', 'blocked-chain'];
    const defaults = ['draft-chain', 'blocked-chain'];
    const selected = request.selectedChainIds ?? defaults;
    return {
      key: request.key,
      sourceVersionTag: request.sourceVersionTag,
      targetVersionTag: request.targetVersionTag,
      draftsAllowed,
      chains: ids.map(id =>
        chain(id, {
          selected: selected.includes(id),
          selectedByDefault: defaults.includes(id),
          requiresDrafts: id === 'final-chain',
          migratable: draftsAllowed && id !== 'blocked-chain',
          notMigratableReason: id === 'blocked-chain' ? 'The open draft no longer holds it.' : null,
          ...chainOverrides[id],
          ...resolvedDifferences(id, request),
        })
      ),
      changeset: {
        draftsToCreate: [],
        draftsToModify: [],
        linksToRepoint: [],
        skippedChainIds: ids.filter(id => !selected.includes(id)),
        coveredChainIds: [],
      },
    };
  };

  const resolvedDifferences = (
    id: string,
    request: BuildingBlockVersionMigrationPreviewRequestDto
  ): Partial<BuildingBlockVersionMigrationChainDto> => {
    const differences = chainOverrides[id]?.differences;
    if (!differences) return {};
    const resolution = request.resolutions.find(candidate => candidate.chainId === id);
    const unresolvedRequiredInputs = differences.missingRequiredInputs.filter(
      field => !resolution?.inputMappings.some(mapping => mapping.target === field)
    );
    const unresolvedPluginDefinitionKeys = differences.missingPluginDefinitionKeys.filter(
      key => !resolution?.pluginConfigurations[key]
    );
    return {
      differences: {
        ...differences,
        unresolvedRequiredInputs,
        unresolvedPluginDefinitionKeys,
        configured:
          unresolvedRequiredInputs.length === 0 && unresolvedPluginDefinitionKeys.length === 0,
      },
    };
  };

  const testId = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${id}"]`);

  const goToChains = (): void => {
    component.onSourceSelected({item: {id: 'send-email:1.0.0'}});
    component.onNextClick();
    component.onTargetSelected({item: {id: '1.0.1'}});
    component.onNextClick();
  };

  beforeEach(() => {
    chainOverrides = {};
    draftsAllowed = true;
    migrationApi = jasmine.createSpyObj<BuildingBlockVersionMigrationApiService>(
      'BuildingBlockVersionMigrationApiService',
      ['getInUseVersions', 'preview', 'execute']
    );
    migrationApi.getInUseVersions.and.returnValue(of([SOURCE]));
    migrationApi.preview.and.callFake(request => of(previewFor(request)));
    migrationApi.execute.and.returnValue(
      of({
        key: 'send-email',
        sourceVersionTag: '1.0.0',
        targetVersionTag: '1.0.1',
        chainsMigratedDirectly: ['draft-chain'],
        linksRepointed: [],
        draftsCreated: [
          {type: 'BUILDING_BLOCK', key: 'notify', versionTag: '1.2.0', basedOnVersionTag: '1.1.0'},
        ],
        draftsModified: [],
        skippedChainIds: [],
        remainingReferences: [],
      })
    );

    TestBed.configureTestingModule({
      imports: [BuildingBlockManagementVersionMigrationModalComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        BuildingBlockManagementService,
        {provide: BuildingBlockVersionMigrationApiService, useValue: migrationApi},
        {
          provide: BuildingBlockManagementApiService,
          useValue: {
            getVersionsForBuildingBlock: () =>
              of({
                content: [
                  {versionTag: '1.0.1', final: true},
                  {versionTag: '1.0.0', final: true},
                  {versionTag: '0.9.0', final: true},
                ],
              }),
          },
        },
        {
          provide: PluginManagementService,
          useValue: {
            getPluginConfigurationsByPluginDefinitionKey: () =>
              of([{id: 'smtp-config-id', title: 'SMTP', properties: {}}]),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(BuildingBlockManagementVersionMigrationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    TestBed.inject(BuildingBlockManagementService).showVersionMigrationModal();
    fixture.detectChanges();
  });

  describe('step gating', () => {
    it('does not proceed from the source step without a source', () => {
      expect(component.$canProceed()).toBeFalse();
      component.onNextClick();
      expect(component.$step()).toBe(VERSION_MIGRATION_STEP.SOURCE);

      component.onSourceSelected({item: {id: 'send-email:1.0.0'}});

      expect(component.$canProceed()).toBeTrue();
    });

    it('does not proceed from the target step without a target and never offers the source as target', () => {
      component.onSourceSelected({item: {id: 'send-email:1.0.0'}});
      component.onNextClick();

      expect(component.$step()).toBe(VERSION_MIGRATION_STEP.TARGET);
      expect(component.$canProceed()).toBeFalse();
      expect(component.$targetItems().map(item => item.id)).toEqual(['1.0.1', '0.9.0']);

      component.onTargetSelected({item: {id: '0.9.0'}});

      expect(component.$canProceed()).toBeTrue();
    });

    it('does not proceed from the chains step without at least one selected chain', () => {
      goToChains();
      expect(component.$canProceed()).toBeTrue();

      component.onChainCheckedChange('draft-chain', false);

      expect(component.$selectedChainIds()).toEqual([]);
      expect(component.$canProceed()).toBeFalse();
      component.onNextClick();
      expect(component.$step()).toBe(VERSION_MIGRATION_STEP.CHAINS);
    });

    it('does not proceed while drafts are not allowed and says so', () => {
      draftsAllowed = false;
      goToChains();
      fixture.detectChanges();

      expect(component.$canProceed()).toBeFalse();
      expect(
        testId(BUILDING_BLOCK_MANAGEMENT_VERSION_MIGRATION_TEST_IDS.draftsNotAllowed)
      ).not.toBeNull();
    });

    it('does not proceed from the differences step while a selected chain is not configured', fakeAsync(() => {
      chainOverrides['draft-chain'] = {
        differences: {
          ...chain('draft-chain', {}).differences,
          missingRequiredInputs: ['/recipient'],
          missingPluginDefinitionKeys: ['smtp'],
        },
      };
      goToChains();
      component.onNextClick();
      fixture.detectChanges();

      expect(component.$step()).toBe(VERSION_MIGRATION_STEP.DIFFERENCES);
      expect(component.$canProceed()).toBeFalse();

      component.resolutionForm
        .get(['draft-chain', 'inputs'])!
        .get(['/recipient'])!
        .setValue('doc:/email');
      tick(VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS);
      expect(component.$canProceed()).toBeFalse();

      component.resolutionForm.get(['draft-chain', 'plugins', 'smtp'])!.setValue('smtp-config-id');
      expect(component.$canProceed()).toBeFalse();
      tick(VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS);

      expect(component.$canProceed()).toBeTrue();
    }));

    it('does not execute without an explicit confirmation', () => {
      goToChains();
      component.onNextClick();
      component.onNextClick();

      expect(component.$step()).toBe(VERSION_MIGRATION_STEP.REVIEW);
      component.onExecute();
      expect(migrationApi.execute).not.toHaveBeenCalled();

      component.onConfirmedChange(true);
      component.onExecute();

      expect(migrationApi.execute).toHaveBeenCalledTimes(1);
      expect(component.$result()?.draftsCreated.length).toBe(1);
    });
  });

  describe('default selection', () => {
    it('selects the chains that are selected by default and migratable, and leaves finalized chains opt-in', () => {
      goToChains();

      expect(component.$selectedChainIds()).toEqual(['draft-chain']);
      expect(migrationApi.preview.calls.first().args[0].selectedChainIds).toBeNull();
      expect(migrationApi.preview.calls.mostRecent().args[0].selectedChainIds).toEqual([
        'draft-chain',
      ]);

      component.onChainCheckedChange('final-chain', true);

      expect(component.$selectedChainIds()).toEqual(['draft-chain', 'final-chain']);
      expect(component.$canProceed()).toBeTrue();
    });
  });

  describe('execute request', () => {
    it('sends the selected chains and their resolutions', fakeAsync(() => {
      chainOverrides['final-chain'] = {
        differences: {
          ...chain('final-chain', {}).differences,
          missingRequiredInputs: ['/recipient', '/subject'],
          missingPluginDefinitionKeys: ['smtp'],
        },
      };
      goToChains();
      component.onChainCheckedChange('final-chain', true);
      component.onNextClick();
      component.resolutionForm.get(['final-chain', 'inputs'])!.patchValue({
        '/recipient': ' doc:/email ',
        '/subject': 'Welcome',
      });
      component.resolutionForm.get(['final-chain', 'plugins', 'smtp'])!.setValue('smtp-config-id');
      tick(VERSION_MIGRATION_PREVIEW_DEBOUNCE_MS);
      component.onNextClick();
      component.onConfirmedChange(true);

      component.onExecute();

      expect(migrationApi.execute).toHaveBeenCalledOnceWith({
        key: 'send-email',
        sourceVersionTag: '1.0.0',
        targetVersionTag: '1.0.1',
        selectedChainIds: ['draft-chain', 'final-chain'],
        resolutions: [
          {
            chainId: 'final-chain',
            inputMappings: [
              {source: 'doc:/email', target: '/recipient'},
              {source: 'Welcome', target: '/subject'},
            ],
            pluginConfigurations: {smtp: 'smtp-config-id'},
          },
        ],
      });
    }));
  });
});
