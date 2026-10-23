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
import {ActivatedRoute, convertToParamMap, ParamMap, Router} from '@angular/router';
import {TranslateModule} from '@ngx-translate/core';
import {BehaviorSubject, of} from 'rxjs';
import {Page} from '@valtimo/shared';
import {
  ExternalPluginConfiguration,
  ExternalPluginContractJobQuery,
  ExternalPluginContractJobSummary,
  ExternalPluginService,
} from '@valtimo/plugin';
import {PluginContractJobsPageComponent} from './plugin-contract-jobs-page.component';

describe('PluginContractJobsPageComponent', () => {
  let fixture: ComponentFixture<PluginContractJobsPageComponent>;
  let component: PluginContractJobsPageComponent;
  let externalPluginService: jasmine.SpyObj<ExternalPluginService>;
  let router: jasmine.SpyObj<Router>;
  let queryParamMap$: BehaviorSubject<ParamMap>;

  const job = (id: string): ExternalPluginContractJobSummary => ({
    id,
    contract: 'nl.ritense.openplan@1',
    operation: 'export',
    requesterConfigurationId: 'requester-id',
    requesterTitle: null,
    requesterPluginId: 'pdca',
    providerConfigurationId: 'provider-id',
    providerTitle: 'Open Plan',
    providerPluginId: 'openplan',
    status: 'FAILED',
    requestedBy: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: null,
    completedAt: null,
    deliveredAt: null,
    deadline: null,
    deliveryAttempts: 0,
    errorCode: 'PROVIDER_ERROR',
    providerErrorCode: 'OPENPLAN_DOWN',
    errorMessage: 'Open Plan is down',
  });

  const page = (
    content: Array<ExternalPluginContractJobSummary>,
    totalElements: number
  ): Page<ExternalPluginContractJobSummary> =>
    ({content, totalElements}) as unknown as Page<ExternalPluginContractJobSummary>;

  const lastQuery = (): ExternalPluginContractJobQuery =>
    externalPluginService.getContractJobs.calls.mostRecent().args[0];

  beforeEach(() => {
    externalPluginService = jasmine.createSpyObj<ExternalPluginService>('ExternalPluginService', [
      'getContractJobs',
      'getConfigurations',
    ]);
    externalPluginService.getContractJobs.and.returnValue(of(page([job('job-1')], 1)));
    externalPluginService.getConfigurations.and.returnValue(
      of([
        {id: 'b', title: 'Beta'} as ExternalPluginConfiguration,
        {id: 'a', title: 'Alpha'} as ExternalPluginConfiguration,
      ])
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    queryParamMap$ = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    TestBed.configureTestingModule({
      imports: [PluginContractJobsPageComponent, TranslateModule.forRoot()],
      providers: [
        {provide: ExternalPluginService, useValue: externalPluginService},
        {provide: Router, useValue: router},
        {provide: ActivatedRoute, useValue: {queryParamMap: queryParamMap$}},
      ],
    });
    TestBed.overrideComponent(PluginContractJobsPageComponent, {
      set: {template: '', styles: []},
    });

    fixture = TestBed.createComponent(PluginContractJobsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the provider error code next to the error code', () => {
    expect(component.$rows()[0].errorLabel).toBe('PROVIDER_ERROR · OPENPLAN_DOWN');
    expect(component.$rows()[0].requesterTitle).toBe('requester-id');
  });

  describe('configuration filter', () => {
    it('offers every configuration, sorted by title', () => {
      expect(component.$configurationItems().map(item => item.content)).toEqual([
        'pluginManagement.contractJobs.filterAllConfigurations',
        'Alpha',
        'Beta',
      ]);
    });

    it('lists the jobs of the chosen configuration from the first page', () => {
      component.onPaginationClicked(2);

      component.onConfigurationSelected({item: {content: 'Alpha', selected: true, value: 'a'}});

      expect(lastQuery()).toEqual({page: 0, size: 10, status: undefined, configurationId: 'a'});
      expect(component.$configurationItems().find(item => item.selected)?.value).toBe('a');

      component.onConfigurationSelected({item: {content: 'All', selected: true, value: ''}});

      expect(lastQuery().configurationId).toBeUndefined();
    });
  });

  describe('job details', () => {
    it('opens the job named by the jobId query parameter', () => {
      queryParamMap$.next(convertToParamMap({jobId: 'job-1'}));

      expect(component.$selectedJobId()).toBe('job-1');
      expect(component.$detailOpen()).toBeTrue();

      queryParamMap$.next(convertToParamMap({}));

      expect(component.$detailOpen()).toBeFalse();
    });

    it('puts a clicked job in the URL and takes it out on close', () => {
      component.onRowClicked(component.$rows()[0]);

      expect(router.navigate).toHaveBeenCalledWith(
        [],
        jasmine.objectContaining({queryParams: {jobId: 'job-1'}})
      );

      component.onDetailClose();

      expect(component.$detailOpen()).toBeFalse();
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        jasmine.objectContaining({queryParams: {jobId: null}})
      );
    });

    it('refreshes the list after a job changed', () => {
      externalPluginService.getContractJobs.calls.reset();

      component.onJobChanged();

      expect(externalPluginService.getContractJobs).toHaveBeenCalledTimes(1);
    });
  });

  describe('pagination', () => {
    it('reflects the page and the total', () => {
      externalPluginService.getContractJobs.and.returnValue(of(page([job('job-1')], 25)));

      component.onPaginationClicked(2);

      expect(component.$pagination()).toEqual({page: 2, size: 10, collectionSize: 25});
    });

    it('steps back when a refresh leaves the current page empty', () => {
      externalPluginService.getContractJobs.and.callFake(query =>
        of(query.page >= 2 ? page([], 20) : page([job('job-2')], 20))
      );

      component.onPaginationClicked(3);

      expect(component.$page()).toBe(2);
      expect(lastQuery().page).toBe(1);
      expect(component.$rows().map(row => row.id)).toEqual(['job-2']);
      expect(component.$loading()).toBeFalse();
    });
  });
});
