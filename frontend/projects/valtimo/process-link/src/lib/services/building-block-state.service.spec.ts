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

import {TestBed} from '@angular/core/testing';
import {BuildingBlockVersionDto, Page} from '@valtimo/shared';
import {of} from 'rxjs';
import {BuildingBlockField, BuildingBlockInputMapping, BuildingBlockOutputMapping} from '../models';
import {BuildingBlockStateService} from './building-block-state.service';
import {ProcessLinkBuildingBlockApiService} from './process-link-building-block-api.service';

describe('BuildingBlockStateService', () => {
  let service: BuildingBlockStateService;
  let apiService: jasmine.SpyObj<ProcessLinkBuildingBlockApiService>;

  const INPUT_MAPPINGS: BuildingBlockInputMapping[] = [
    {source: 'doc:/caseNumber', target: 'doc:/number'},
    {source: 'doc:/caseTitle', target: 'doc:/title'},
  ];

  const OUTPUT_MAPPINGS: BuildingBlockOutputMapping[] = [
    {source: 'doc:/result', target: 'doc:/caseResult', syncTiming: 'END'},
    {source: 'doc:/summary', target: 'doc:/caseSummary', syncTiming: 'END'},
  ];

  const pageOf = (versionTags: Array<string>): Page<BuildingBlockVersionDto> =>
    ({
      content: versionTags.map(versionTag => ({versionTag, final: true})),
    }) as Page<BuildingBlockVersionDto>;

  /**
   * Building blocks report fields without the doc: prefix; the service adds it, and mappings match on that.
   */
  const fields = (...names: string[]): BuildingBlockField[] =>
    names.map(name => ({name, required: false}));

  /**
   * Puts the service on a building block with mappings the user already entered, so a following
   * changeDefinitionVersionTag prunes them against the fields the new version reports.
   */
  const configureMappedBuildingBlock = (fieldsOfNewVersion: BuildingBlockField[]): void => {
    apiService.getAllVersionsForBuildingBlock.and.returnValue(of(pageOf(['1.0.0'])));
    apiService.getPluginDefinitionsForBuildingBlock.and.returnValue(
      of({plugins: [{pluginDefinitionKey: 'smtp-plugin', dependencies: []}]})
    );
    apiService.getFieldsForBuildingBlock.and.returnValue(of(fieldsOfNewVersion));

    service.setDefinitionKey('invoice');
    service.setPluginConfigurationMappings({'smtp-plugin': 'configuration-id'});
    service.setInputMappings(INPUT_MAPPINGS);
    service.setOutputMappings(OUTPUT_MAPPINGS);
  };

  beforeEach(() => {
    apiService = jasmine.createSpyObj('ProcessLinkBuildingBlockApiService', [
      'getAllVersionsForBuildingBlock',
      'getPluginDefinitionsForBuildingBlock',
      'getFieldsForBuildingBlock',
    ]);

    TestBed.configureTestingModule({
      providers: [
        BuildingBlockStateService,
        {provide: ProcessLinkBuildingBlockApiService, useValue: apiService},
      ],
    });

    service = TestBed.inject(BuildingBlockStateService);
  });

  it('exposes every version the backend returns, not just the first page of five', done => {
    const allVersions = ['2.0.0', '1.10.0', '1.9.0', '1.2.0', '1.1.0', '1.0.0'];
    apiService.getAllVersionsForBuildingBlock.and.returnValue(of(pageOf(allVersions)));

    service.setDefinitionKey('my-block');

    expect(apiService.getAllVersionsForBuildingBlock).toHaveBeenCalledWith('my-block');
    service.versions$.subscribe(versions => {
      expect(versions).toEqual(allVersions);
      done();
    });
  });

  it('clears the versions when the definition key is unset', done => {
    service.setDefinitionKey(null);

    expect(apiService.getAllVersionsForBuildingBlock).not.toHaveBeenCalled();
    service.versions$.subscribe(versions => {
      expect(versions).toEqual([]);
      done();
    });
  });

  it('should keep the mappings whose fields still exist in the new version', () => {
    configureMappedBuildingBlock(fields('/number', '/title', '/result', '/summary'));

    service.changeDefinitionVersionTag('2.0.0');

    expect(service.getInputMappingsSnapshot().map(mapping => mapping.target)).toEqual([
      'doc:/number',
      'doc:/title',
    ]);
    expect(service.getOutputMappingsSnapshot().map(mapping => mapping.source)).toEqual([
      'doc:/result',
      'doc:/summary',
    ]);
    expect(service.getPluginConfigurationMappingsSnapshot()).toEqual({
      'smtp-plugin': 'configuration-id',
    });
  });

  it('should drop only the mappings whose field disappeared from the new version', () => {
    configureMappedBuildingBlock(fields('/number', '/result'));

    service.changeDefinitionVersionTag('2.0.0');

    expect(service.getInputMappingsSnapshot().map(mapping => mapping.target)).toEqual([
      'doc:/number',
    ]);
    expect(service.getOutputMappingsSnapshot().map(mapping => mapping.source)).toEqual([
      'doc:/result',
    ]);
  });

  it('should clear the mappings when the version is deselected, as there is nothing to prune against', () => {
    configureMappedBuildingBlock(fields('/number', '/title', '/result', '/summary'));

    service.changeDefinitionVersionTag(null);

    expect(service.getInputMappingsSnapshot()).toEqual([]);
    expect(service.getOutputMappingsSnapshot()).toEqual([]);
    expect(service.getPluginConfigurationMappingsSnapshot()).toEqual({});
  });
});
