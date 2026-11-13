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

import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {ExternalPluginHostUsage} from '@valtimo/plugin';
import {PluginUsageModalComponent} from './plugin-usage-modal.component';
import {PLUGIN_USAGE_MODAL_TEST_IDS} from '../../constants';

describe('PluginUsageModalComponent', () => {
  let fixture: ComponentFixture<PluginUsageModalComponent>;
  let component: PluginUsageModalComponent;

  const usage = (overrides: Partial<ExternalPluginHostUsage>): ExternalPluginHostUsage => ({
    configurationId: 'provider-id',
    configurationTitle: 'Open Plan',
    parentType: 'GLOBAL',
    parentKey: null,
    parentVersionTag: null,
    processDefinitionId: null,
    processDefinitionKey: null,
    processDefinitionName: null,
    activityId: null,
    activityName: null,
    processLinkId: null,
    ...overrides,
  });

  const jobUsage = (configurationId: string): ExternalPluginHostUsage =>
    usage({
      configurationId,
      parentType: 'CONTRACT_JOB',
      parentKey: 'nl.ritense.openplan@1',
      contract: 'nl.ritense.openplan@1',
      contractJobId: 'job-1',
      relatedConfigurationId: configurationId === 'provider-id' ? 'requester-id' : 'provider-id',
    });

  const bindingUsage = (relatedConfigurationId: string): ExternalPluginHostUsage =>
    usage({
      parentType: 'CONTRACT_BINDING',
      parentKey: 'nl.ritense.openplan@1',
      contract: 'nl.ritense.openplan@1',
      relatedConfigurationId,
      relatedConfigurationTitle: `Consumer ${relatedConfigurationId}`,
    });

  const render = (usages: Array<ExternalPluginHostUsage>): void => {
    fixture.componentRef.setInput('usages', usages);
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  };

  const byTestId = (testId: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-test-id="${testId}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PluginUsageModalComponent, TranslateModule.forRoot()],
      providers: [provideRouter([])],
    });

    fixture = TestBed.createComponent(PluginUsageModalComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('gives every row its own test id, also for a job listed once per party', () => {
    render([
      jobUsage('provider-id'),
      jobUsage('requester-id'),
      bindingUsage('consumer-a'),
      bindingUsage('consumer-b'),
    ]);

    const keys = component.$rows().map(row => row.key);
    expect(new Set(keys).size).toBe(4);
    expect(keys).toEqual([
      'contract-job-job-1-provider-id',
      'contract-job-job-1-requester-id',
      'contract-binding-nl.ritense.openplan@1-consumer-a',
      'contract-binding-nl.ritense.openplan@1-consumer-b',
    ]);
    expect(
      byTestId(
        PLUGIN_USAGE_MODAL_TEST_IDS.row + 'contract-binding-nl.ritense.openplan@1-consumer-a'
      )
    ).not.toBeNull();
  });

  it('links an open contract job to its details', () => {
    render([jobUsage('provider-id')]);

    const link = byTestId(
      PLUGIN_USAGE_MODAL_TEST_IDS.contractJobLink + 'contract-job-job-1-provider-id'
    );

    expect(link?.getAttribute('href')).toBe('/plugin-contract-jobs?jobId=job-1');
  });

  it('does not link a contract binding', () => {
    render([bindingUsage('consumer-a')]);

    expect(
      fixture.nativeElement.querySelector(
        `[data-test-id^="${PLUGIN_USAGE_MODAL_TEST_IDS.contractJobLink}"]`
      )
    ).toBeNull();
  });

  it('labels the usage type, or shows an unknown type as is', () => {
    render([
      bindingUsage('consumer-a'),
      usage({parentType: 'SOMETHING_NEW' as ExternalPluginHostUsage['parentType']}),
    ]);

    expect(component.$rows()[0].typeLabelKey).toBe(
      'pluginManagement.usageModal.parentType.CONTRACT_BINDING'
    );
    expect(component.$rows()[1].typeLabelKey).toBeNull();
  });
});
