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

import {Component, Input, Type} from '@angular/core';
import {NG_VALUE_ACCESSOR} from '@angular/forms';
import {ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
import {By} from '@angular/platform-browser';
import {provideRouter} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {ValuePathSelectorComponent} from '@valtimo/components';
import {PluginManagementService} from '@valtimo/plugin';
import {
  BuildingBlockUsageUpdateChainDto,
  BuildingBlockUsageUpdatePreviewDto,
  BuildingBlockUsageUpdatePreviewRequestDto,
} from '@valtimo/shared';
import {NEVER, of, throwError} from 'rxjs';
import {
  BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS,
  USAGE_UPDATE_PREVIEW_DEBOUNCE_MS,
  USAGE_UPDATE_STEP,
  USAGE_UPDATE_STEPS,
} from '../../constants';
import {
  BuildingBlockManagementApiService,
  BuildingBlockManagementService,
  BuildingBlockUsageUpdateApiService,
} from '../../services';
import {BuildingBlockManagementUsageUpdateModalComponent} from './building-block-management-usage-update-modal.component';
import {BuildingBlockUsageUpdateWizardService} from './building-block-usage-update-wizard.service';
import {BuildingBlockUsageUpdateDifferencesStepComponent} from './usage-update-differences-step/usage-update-differences-step.component';
import {BuildingBlockUsageUpdateSourceStepComponent} from './usage-update-source-step/usage-update-source-step.component';
import {BuildingBlockUsageUpdateTargetStepComponent} from './usage-update-target-step/usage-update-target-step.component';

@Component({
  standalone: true,
  selector: 'valtimo-value-path-selector',
  template: '',
  providers: [
    {provide: NG_VALUE_ACCESSOR, useExisting: ValuePathSelectorStubComponent, multi: true},
  ],
})
class ValuePathSelectorStubComponent {
  @Input() public buildingBlockDefinitionKey: string | null = null;
  @Input() public buildingBlockDefinitionVersionTag: string | null = null;
  @Input() public caseDefinitionKey: string | null = null;
  @Input() public caseDefinitionVersionTag: string | null = null;
  @Input() public label = '';
  @Input() public notation = '';
  @Input() public prefixes: string[] = [];

  public writeValue(): void {}
  public registerOnChange(): void {}
  public registerOnTouched(): void {}
}

describe('BuildingBlockManagementUsageUpdateModalComponent', () => {
  let fixture: ComponentFixture<BuildingBlockManagementUsageUpdateModalComponent>;
  let component: BuildingBlockManagementUsageUpdateModalComponent;
  let wizard: BuildingBlockUsageUpdateWizardService;
  let usageUpdateApi: jasmine.SpyObj<BuildingBlockUsageUpdateApiService>;
  let chainOverrides: Record<string, Partial<BuildingBlockUsageUpdateChainDto>>;
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
    overrides: Partial<BuildingBlockUsageUpdateChainDto>
  ): BuildingBlockUsageUpdateChainDto => {
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
      updatable: true,
      notUpdatableReason: null,
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
    request: BuildingBlockUsageUpdatePreviewRequestDto
  ): BuildingBlockUsageUpdatePreviewDto => {
    const ids = ['draft-chain', 'final-chain', 'blocked-chain'];
    const defaults = ['draft-chain', 'blocked-chain'];
    const selected = request.selectedChainIds ?? defaults;
    return {
      key: request.key,
      sourceVersionTag: request.sourceVersionTag,
      targetKey: request.targetKey ?? request.key,
      targetVersionTag: request.targetVersionTag,
      draftsAllowed,
      chains: ids.map(id =>
        chain(id, {
          selected: selected.includes(id),
          selectedByDefault: defaults.includes(id),
          requiresDrafts: id === 'final-chain',
          updatable: draftsAllowed && id !== 'blocked-chain',
          notUpdatableReason: id === 'blocked-chain' ? 'The open draft no longer holds it.' : null,
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
    request: BuildingBlockUsageUpdatePreviewRequestDto
  ): Partial<BuildingBlockUsageUpdateChainDto> => {
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

  const item = (id: string): {id: string; content: string; selected: boolean} => ({
    id,
    content: id,
    selected: true,
  });

  const step = <T>(type: Type<T>): T => {
    fixture.detectChanges();
    return fixture.debugElement.query(By.directive(type)).componentInstance;
  };

  const sourceStep = (): BuildingBlockUsageUpdateSourceStepComponent =>
    step(BuildingBlockUsageUpdateSourceStepComponent);

  const targetStep = (): BuildingBlockUsageUpdateTargetStepComponent =>
    step(BuildingBlockUsageUpdateTargetStepComponent);

  const testId = (id: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${id}"]`);

  const goToChains = (): void => {
    wizard.selectSourceKey(item('send-email'));
    wizard.next();
    wizard.selectTarget(item('1.0.1'));
    wizard.next();
  };

  beforeEach(() => {
    chainOverrides = {};
    draftsAllowed = true;
    usageUpdateApi = jasmine.createSpyObj<BuildingBlockUsageUpdateApiService>(
      'BuildingBlockUsageUpdateApiService',
      ['getInUseVersions', 'preview', 'execute']
    );
    usageUpdateApi.getInUseVersions.and.returnValue(of([SOURCE]));
    usageUpdateApi.preview.and.callFake(request => of(previewFor(request)));
    usageUpdateApi.execute.and.returnValue(
      of({
        key: 'send-email',
        sourceVersionTag: '1.0.0',
        targetKey: 'send-email',
        targetVersionTag: '1.0.1',
        chainsUpdatedDirectly: ['draft-chain'],
        linksRepointed: [],
        draftsCreated: [
          {type: 'BUILDING_BLOCK', key: 'notify', versionTag: '1.2.0', basedOnVersionTag: '1.1.0'},
        ],
        draftsModified: [],
        skippedChainIds: [],
        remainingReferences: [],
      })
    );

    TestBed.overrideComponent(BuildingBlockUsageUpdateDifferencesStepComponent, {
      remove: {imports: [ValuePathSelectorComponent]},
      add: {imports: [ValuePathSelectorStubComponent]},
    });
    TestBed.configureTestingModule({
      imports: [BuildingBlockManagementUsageUpdateModalComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        BuildingBlockManagementService,
        {provide: BuildingBlockUsageUpdateApiService, useValue: usageUpdateApi},
        {
          provide: BuildingBlockManagementApiService,
          useValue: {
            getBuildingBlockDefinitions: () =>
              of([
                {key: 'send-letter', name: 'Send letter'},
                {key: 'send-email', name: 'Send email'},
              ]),
            getVersionsForBuildingBlock: (key: string) =>
              of({
                content:
                  key === 'send-letter'
                    ? [{versionTag: '1.0.0', final: true}]
                    : [
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
    fixture = TestBed.createComponent(BuildingBlockManagementUsageUpdateModalComponent);
    component = fixture.componentInstance;
    wizard = fixture.debugElement.injector.get(BuildingBlockUsageUpdateWizardService);
    fixture.detectChanges();
    TestBed.inject(BuildingBlockManagementService).showUsageUpdateModal();
    fixture.detectChanges();
  });

  describe('step gating', () => {
    it('does not proceed from the source step without a source', () => {
      expect(wizard.$canProceed()).toBeFalse();
      wizard.next();
      expect(wizard.$step()).toBe(USAGE_UPDATE_STEP.SOURCE);

      wizard.selectSourceKey(item('send-email'));

      expect(wizard.$canProceed()).toBeTrue();
    });

    it('does not proceed from the target step without a target and never offers the source as target', () => {
      wizard.selectSourceKey(item('send-email'));
      wizard.next();

      expect(wizard.$step()).toBe(USAGE_UPDATE_STEP.TARGET);
      expect(wizard.$canProceed()).toBeFalse();
      expect(
        targetStep()
          .$targetItems()
          .map(item => item.id)
      ).toEqual(['1.0.1', '0.9.0']);

      wizard.selectTarget(item('0.9.0'));

      expect(wizard.$canProceed()).toBeTrue();
    });

    it('offers another building block as target, with all its versions, and previews against it', () => {
      wizard.selectSourceKey(item('send-email'));
      wizard.next();

      expect(wizard.$targetKey()).toBe('send-email');
      expect(
        targetStep()
          .$targetKeyItems()
          .map(item => item.id)
      ).toEqual(['send-email', 'send-letter']);

      wizard.selectTargetKey(item('send-letter'));

      expect(wizard.$target()).toBeNull();
      expect(
        targetStep()
          .$targetItems()
          .map(item => item.id)
      ).toEqual(['1.0.0']);

      wizard.selectTarget(item('1.0.0'));
      expect(wizard.$canProceed()).toBeTrue();
      wizard.next();

      expect(usageUpdateApi.preview).toHaveBeenCalledWith(
        jasmine.objectContaining({
          key: 'send-email',
          targetKey: 'send-letter',
          targetVersionTag: '1.0.0',
        })
      );
      expect(wizard.$preview()?.targetKey).toBe('send-letter');
    });

    it('does not proceed from the chains step without at least one selected chain', () => {
      goToChains();
      expect(wizard.$canProceed()).toBeTrue();

      wizard.setChainSelected('draft-chain', false);

      expect(wizard.$selectedChainIds()).toEqual([]);
      expect(wizard.$canProceed()).toBeFalse();
      wizard.next();
      expect(wizard.$step()).toBe(USAGE_UPDATE_STEP.CHAINS);
    });

    it('does not proceed while drafts are not allowed and says so', () => {
      draftsAllowed = false;
      goToChains();
      fixture.detectChanges();

      expect(wizard.$canProceed()).toBeFalse();
      expect(
        testId(BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS.draftsNotAllowed)
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
      wizard.next();
      fixture.detectChanges();

      expect(wizard.$step()).toBe(USAGE_UPDATE_STEP.DIFFERENCES);
      expect(wizard.$canProceed()).toBeFalse();

      wizard.resolutionForm
        .get(['draft-chain', 'inputs'])!
        .get(['/recipient', 'source'])!
        .setValue('doc:/email');
      tick(USAGE_UPDATE_PREVIEW_DEBOUNCE_MS);
      expect(wizard.$canProceed()).toBeFalse();

      wizard.resolutionForm.get(['draft-chain', 'plugins', 'smtp'])!.setValue('smtp-config-id');
      expect(wizard.$canProceed()).toBeFalse();
      tick(USAGE_UPDATE_PREVIEW_DEBOUNCE_MS);

      expect(wizard.$canProceed()).toBeTrue();
    }));

    it('does not execute without an explicit confirmation', () => {
      goToChains();
      wizard.next();
      wizard.next();

      expect(wizard.$step()).toBe(USAGE_UPDATE_STEP.REVIEW);
      wizard.execute();
      expect(usageUpdateApi.execute).not.toHaveBeenCalled();

      wizard.$confirmed.set(true);
      wizard.execute();

      expect(usageUpdateApi.execute).toHaveBeenCalledTimes(1);
      expect(wizard.$result()?.draftsCreated.length).toBe(1);
      expect(component.$progressSteps().every(step => step.complete)).toBeTrue();
      expect(component.$progressCurrentIndex()).toBe(USAGE_UPDATE_STEPS.length);
    });
  });

  describe('failures', () => {
    it('shows a retry when the preview fails and recovers on retry', () => {
      usageUpdateApi.preview.and.returnValue(throwError(() => new Error('preview failed')));
      goToChains();
      fixture.detectChanges();

      expect(wizard.$previewFailed()).toBeTrue();
      expect(testId(BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS.previewFailed)).not.toBeNull();

      usageUpdateApi.preview.and.callFake(request => of(previewFor(request)));
      wizard.requestPreview();
      fixture.detectChanges();

      expect(wizard.$previewFailed()).toBeFalse();
      expect(wizard.$preview()?.chains.length).toBe(3);
    });

    it('shows a retry when a later preview fails on the chains step', () => {
      goToChains();
      usageUpdateApi.preview.and.returnValue(throwError(() => new Error('preview failed')));

      wizard.setChainSelected('final-chain', true);
      fixture.detectChanges();

      expect(wizard.$preview()).not.toBeNull();
      expect(testId(BUILDING_BLOCK_MANAGEMENT_USAGE_UPDATE_TEST_IDS.previewFailed)).not.toBeNull();
    });

    it('does not close while the usage update is executing', () => {
      usageUpdateApi.execute.and.returnValue(NEVER);
      goToChains();
      wizard.next();
      wizard.next();
      wizard.$confirmed.set(true);
      wizard.execute();

      const hideSpy = spyOn(TestBed.inject(BuildingBlockManagementService), 'hideUsageUpdateModal');
      wizard.close();

      expect(hideSpy).not.toHaveBeenCalled();
    });
  });

  describe('source selection', () => {
    it('lists each key once and asks for a version when the key has several in use', () => {
      usageUpdateApi.getInUseVersions.and.returnValue(
        of([SOURCE, {...SOURCE, versionTag: '0.9.0', final: false}])
      );
      TestBed.inject(BuildingBlockManagementService).showUsageUpdateModal();

      expect(
        sourceStep()
          .$sourceKeyItems()
          .map(keyItem => keyItem.content)
      ).toEqual(['Send email (send-email)']);

      wizard.selectSourceKey(item('send-email'));

      expect(wizard.$source()).toBeNull();
      expect(
        sourceStep()
          .$sourceItems()
          .map(versionItem => versionItem.content)
      ).toEqual(['1.0.0', '0.9.0']);

      wizard.selectSource(item('send-email:0.9.0'));

      expect(wizard.$source()?.versionTag).toBe('0.9.0');

      wizard.selectSourceKey({id: 'send-email', content: '', selected: false});

      expect(wizard.$sourceKey()).toBeNull();
      expect(wizard.$source()).toBeNull();
    });
  });

  describe('default selection', () => {
    it('selects the chains that are selected by default and updatable, and leaves finalized chains opt-in', () => {
      goToChains();

      expect(wizard.$selectedChainIds()).toEqual(['draft-chain']);
      expect(usageUpdateApi.preview.calls.first().args[0].selectedChainIds).toBeNull();
      expect(usageUpdateApi.preview.calls.mostRecent().args[0].selectedChainIds).toEqual([
        'draft-chain',
      ]);

      wizard.setChainSelected('final-chain', true);

      expect(wizard.$selectedChainIds()).toEqual(['draft-chain', 'final-chain']);
      expect(wizard.$canProceed()).toBeTrue();
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
      wizard.setChainSelected('final-chain', true);
      wizard.next();
      wizard.resolutionForm.get(['final-chain', 'inputs'])!.patchValue({
        '/recipient': {source: ' doc:/email '},
        '/subject': {mode: 'value', source: 'doc:/ignored', value: 'Welcome'},
      });
      wizard.resolutionForm.get(['final-chain', 'plugins', 'smtp'])!.setValue('smtp-config-id');
      tick(USAGE_UPDATE_PREVIEW_DEBOUNCE_MS);
      wizard.next();
      wizard.$confirmed.set(true);

      wizard.execute();

      expect(usageUpdateApi.execute).toHaveBeenCalledOnceWith({
        key: 'send-email',
        sourceVersionTag: '1.0.0',
        targetKey: 'send-email',
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
