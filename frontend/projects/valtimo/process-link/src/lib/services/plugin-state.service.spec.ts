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
import {
  PluginConfiguration,
  PluginDefinition,
  PluginManagementService,
  PluginService,
  PluginSpecification,
} from '@valtimo/plugin';
import {of} from 'rxjs';
import {take} from 'rxjs/operators';
import {ProcessLink} from '../models';
import {PluginStateService} from './plugin-state.service';

describe('PluginStateService', () => {
  let service: PluginStateService;
  let pluginManagementService: jasmine.SpyObj<PluginManagementService>;

  const ACTION_KEY = 'generate-document';

  // Both plugins expose the same action key, which is what makes deriving the plugin from it ambiguous
  const PLUGIN_SPECIFICATIONS = [
    {
      pluginId: 'smart-documents',
      functionConfigurationComponents: {[ACTION_KEY]: class {}},
      pluginTranslations: {},
    },
    {
      pluginId: 'xential',
      functionConfigurationComponents: {[ACTION_KEY]: class {}},
      pluginTranslations: {},
    },
  ] as unknown as Array<PluginSpecification>;

  const DEFINITIONS = [
    {key: 'smart-documents', title: 'SmartDocuments'},
    {key: 'xential', title: 'Xential'},
  ] as Array<PluginDefinition>;

  // The second plugin is deliberately the configured one, so a first-match scan resolves the wrong plugin
  const CONFIGURATIONS = [
    {
      id: 'configuration-id',
      title: 'Xential configuration',
      properties: {},
      pluginDefinition: {key: 'xential'},
    },
  ] as Array<PluginConfiguration>;

  const processLink = (overrides: Partial<ProcessLink>): ProcessLink =>
    ({
      id: 'process-link-id',
      processDefinitionId: 'process-definition-id',
      activityId: 'service-task-id',
      activityType: 'bpmn:ServiceTask:start',
      processLinkType: 'plugin',
      pluginActionDefinitionKey: ACTION_KEY,
      ...overrides,
    }) as ProcessLink;

  beforeEach(() => {
    pluginManagementService = jasmine.createSpyObj('PluginManagementService', [
      'getPluginDefinitions',
      'getAllPluginConfigurations',
    ]);
    pluginManagementService.getPluginDefinitions.and.returnValue(of(DEFINITIONS));
    pluginManagementService.getAllPluginConfigurations.and.returnValue(of(CONFIGURATIONS));

    TestBed.configureTestingModule({
      providers: [
        PluginStateService,
        {provide: PluginManagementService, useValue: pluginManagementService},
        {
          provide: PluginService,
          useValue: {
            pluginSpecifications$: of(PLUGIN_SPECIFICATIONS),
            pluginSpecifications: PLUGIN_SPECIFICATIONS,
          },
        },
      ],
    });

    service = TestBed.inject(PluginStateService);
  });

  it('resolves the plugin the process link is configured with, not the first one sharing the action key', done => {
    service.selectProcessLink(processLink({pluginConfigurationId: 'configuration-id'}));

    service.pluginDefinitionKey$.pipe(take(1)).subscribe(pluginDefinitionKey => {
      expect(pluginDefinitionKey).toBe('xential');
      done();
    });
  });

  it('selects the plugin definition of the configured plugin when a process link is opened again', done => {
    service.selectProcessLink(processLink({pluginConfigurationId: 'configuration-id'}));

    service.selectedPluginDefinition$.pipe(take(1)).subscribe(definition => {
      expect(definition?.key).toBe('xential');
      done();
    });
  });

  it('uses the definition key a building block process link records', done => {
    service.selectProcessLink(
      processLink({pluginDefinitionKey: 'smart-documents', referenceType: 'BUILDING_BLOCK'})
    );

    service.pluginDefinitionKey$.pipe(take(1)).subscribe(pluginDefinitionKey => {
      expect(pluginDefinitionKey).toBe('smart-documents');
      expect(pluginManagementService.getAllPluginConfigurations).not.toHaveBeenCalled();
      done();
    });
  });

  it('falls back to the action key only when the link records no plugin and no configuration', done => {
    service.selectProcessLink(processLink({}));

    service.pluginDefinitionKey$.pipe(take(1)).subscribe(pluginDefinitionKey => {
      expect(pluginDefinitionKey).toBe('smart-documents');
      done();
    });
  });
});
