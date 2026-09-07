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
import {of, throwError} from 'rxjs';
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

  // Xential is deliberately the configured plugin, so a scan by action key resolves the wrong one
  const CONFIGURATION = {
    id: 'configuration-id',
    title: 'Xential configuration',
    properties: {},
    pluginDefinition: {key: 'xential'},
  } as PluginConfiguration;

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
      'getPluginConfiguration',
    ]);
    pluginManagementService.getPluginDefinitions.and.returnValue(of(DEFINITIONS));
    // The endpoint answers 404 for a configuration that has since been deleted
    pluginManagementService.getPluginConfiguration.and.callFake((configurationId: string) =>
      configurationId === CONFIGURATION.id ? of(CONFIGURATION) : throwError(() => ({status: 404}))
    );

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

  it('looks the configuration up by id rather than scanning every configuration', done => {
    service.selectProcessLink(processLink({pluginConfigurationId: 'configuration-id'}));

    service.selectedPluginConfiguration$.pipe(take(1)).subscribe(configuration => {
      expect(configuration?.id).toBe('configuration-id');
      expect(pluginManagementService.getPluginConfiguration).toHaveBeenCalledWith(
        'configuration-id'
      );
      done();
    });
  });

  it('uses the definition key a building block process link records', done => {
    service.selectProcessLink(
      processLink({pluginDefinitionKey: 'smart-documents', referenceType: 'BUILDING_BLOCK'})
    );

    service.pluginDefinitionKey$.pipe(take(1)).subscribe(pluginDefinitionKey => {
      expect(pluginDefinitionKey).toBe('smart-documents');
      expect(pluginManagementService.getPluginConfiguration).not.toHaveBeenCalled();
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

  it('clears the selection when the next link points at a configuration that no longer exists', () => {
    service.selectProcessLink(processLink({pluginConfigurationId: 'configuration-id'}));

    let definitionKey: string | undefined;
    let configurationId: string | undefined;
    let functionKey: string | undefined;
    service.selectedPluginDefinition$.subscribe(definition => (definitionKey = definition?.key));
    service.selectedPluginConfiguration$.subscribe(
      configuration => (configurationId = configuration?.id)
    );
    service.selectedPluginFunction$.subscribe(
      pluginFunction => (functionKey = pluginFunction?.key)
    );
    expect(definitionKey).toBe('xential');

    service.selectProcessLink(processLink({pluginConfigurationId: 'deleted-configuration-id'}));

    expect(definitionKey).toBeUndefined();
    expect(configurationId).toBeUndefined();
    expect(functionKey).toBeUndefined();
  });

  it('reports no plugin definition key for a link whose configuration no longer exists', done => {
    service.selectProcessLink(processLink({pluginConfigurationId: 'deleted-configuration-id'}));

    service.pluginDefinitionKey$.pipe(take(1)).subscribe(pluginDefinitionKey => {
      expect(pluginDefinitionKey).toBeUndefined();
      done();
    });
  });
});
