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

import {of} from 'rxjs';
import {BuildingBlockField, BuildingBlockInputMapping, BuildingBlockOutputMapping} from '../models';
import {BuildingBlockStateService} from './building-block-state.service';

describe('BuildingBlockStateService', () => {
  const INPUT_MAPPINGS: BuildingBlockInputMapping[] = [
    {source: 'doc:/caseNumber', target: 'doc:/number'},
    {source: 'doc:/caseTitle', target: 'doc:/title'},
  ];

  const OUTPUT_MAPPINGS: BuildingBlockOutputMapping[] = [
    {source: 'doc:/result', target: 'doc:/caseResult', syncTiming: 'END'},
    {source: 'doc:/summary', target: 'doc:/caseSummary', syncTiming: 'END'},
  ];

  /**
   * Building blocks report fields without the doc: prefix; the service adds it, and mappings match on that.
   */
  const fields = (...names: string[]): BuildingBlockField[] =>
    names.map(name => ({name, required: false}));

  const buildService = (fieldsOfNewVersion: BuildingBlockField[]): BuildingBlockStateService => {
    const service = new BuildingBlockStateService(
      jasmine.createSpyObj('ProcessLinkBuildingBlockApiService', {
        getVersionsForBuildingBlock: of({content: [{versionTag: '1.0.0'}]}),
        getPluginDefinitionsForBuildingBlock: of({
          plugins: [{pluginDefinitionKey: 'smtp-plugin', dependencies: []}],
        }),
        getFieldsForBuildingBlock: of(fieldsOfNewVersion),
      })
    );

    service.setDefinitionKey('invoice');
    service.setPluginConfigurationMappings({'smtp-plugin': 'configuration-id'});
    service.setInputMappings(INPUT_MAPPINGS);
    service.setOutputMappings(OUTPUT_MAPPINGS);

    return service;
  };

  it('should keep the mappings whose fields still exist in the new version', () => {
    const service = buildService(fields('/number', '/title', '/result', '/summary'));

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

    service.ngOnDestroy();
  });

  it('should drop only the mappings whose field disappeared from the new version', () => {
    const service = buildService(fields('/number', '/result'));

    service.changeDefinitionVersionTag('2.0.0');

    expect(service.getInputMappingsSnapshot().map(mapping => mapping.target)).toEqual([
      'doc:/number',
    ]);
    expect(service.getOutputMappingsSnapshot().map(mapping => mapping.source)).toEqual([
      'doc:/result',
    ]);

    service.ngOnDestroy();
  });

  it('should clear the mappings when the version is deselected, as there is nothing to prune against', () => {
    const service = buildService(fields('/number', '/title', '/result', '/summary'));

    service.changeDefinitionVersionTag(null);

    expect(service.getInputMappingsSnapshot()).toEqual([]);
    expect(service.getOutputMappingsSnapshot()).toEqual([]);
    expect(service.getPluginConfigurationMappingsSnapshot()).toEqual({});

    service.ngOnDestroy();
  });
});
