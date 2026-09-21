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

import {ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {of} from 'rxjs';
import {PluginManagementService} from '../../services/plugin-management.service';
import {PluginTranslationService} from '../../services/plugin-translation.service';
import {PluginConfigurationMappingComponent} from './plugin-configuration-mapping.component';

describe('PluginConfigurationMappingComponent', () => {
  let component: PluginConfigurationMappingComponent;
  let fixture: ComponentFixture<PluginConfigurationMappingComponent>;
  let pluginManagementService: jasmine.SpyObj<PluginManagementService>;

  const SOURCE_ID = '5474fe57-532a-4050-8d89-32e62ca3e895';
  const TARGET_ID = '3079d6fe-42e3-4f8f-a9db-52ce2507b7ee';

  beforeEach(waitForAsync(() => {
    pluginManagementService = jasmine.createSpyObj('PluginManagementService', [
      'getPluginDefinitions',
      'getPluginConfigurationsByPluginDefinitionKey',
    ]);

    TestBed.configureTestingModule({
      imports: [PluginConfigurationMappingComponent, TranslateModule.forRoot()],
      providers: [
        {provide: PluginManagementService, useValue: pluginManagementService},
        {
          provide: PluginTranslationService,
          useValue: {instant: (_key: string, pluginDefinitionKey: string) => pluginDefinitionKey},
        },
        TranslateService,
      ],
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(PluginConfigurationMappingComponent);
    component = fixture.componentInstance;
  });

  it('should preselect the source configuration when it exists on this environment', () => {
    pluginManagementService.getPluginDefinitions.and.returnValue(of([{key: 'my-plugin'}] as any));
    pluginManagementService.getPluginConfigurationsByPluginDefinitionKey.and.returnValue(
      of([{id: SOURCE_ID, title: 'My configuration'}] as any)
    );
    component.pluginConfigurations = [
      {
        pluginConfigurationId: SOURCE_ID,
        pluginDefinitionKey: 'my-plugin',
        existsInTargetEnvironment: true,
      },
    ];

    fixture.detectChanges();

    expect(component.rows$.value[0].status).toBe('available');
    expect(component.getMappings()).toEqual({[SOURCE_ID]: SOURCE_ID});
  });

  it('should map the source configuration to the selected target configuration', () => {
    pluginManagementService.getPluginDefinitions.and.returnValue(of([{key: 'my-plugin'}] as any));
    pluginManagementService.getPluginConfigurationsByPluginDefinitionKey.and.returnValue(
      of([{id: TARGET_ID, title: 'Other configuration'}] as any)
    );
    component.pluginConfigurations = [
      {
        pluginConfigurationId: SOURCE_ID,
        pluginDefinitionKey: 'my-plugin',
        existsInTargetEnvironment: false,
      },
    ];

    fixture.detectChanges();
    component.form.get(SOURCE_ID)?.setValue(TARGET_ID);

    expect(component.getMappings()).toEqual({[SOURCE_ID]: TARGET_ID});
  });

  it('should mark a configuration of a plugin that is not installed as not-installed', () => {
    pluginManagementService.getPluginDefinitions.and.returnValue(
      of([{key: 'other-plugin'}] as any)
    );
    component.pluginConfigurations = [
      {
        pluginConfigurationId: SOURCE_ID,
        pluginDefinitionKey: 'my-plugin',
        existsInTargetEnvironment: false,
      },
    ];

    fixture.detectChanges();

    expect(component.rows$.value[0].status).toBe('not-installed');
    expect(component.getMappings()).toEqual({[SOURCE_ID]: null});
  });

  it('should mark a plugin without configurations on this environment as no-configurations', () => {
    pluginManagementService.getPluginDefinitions.and.returnValue(of([{key: 'my-plugin'}] as any));
    pluginManagementService.getPluginConfigurationsByPluginDefinitionKey.and.returnValue(of([]));
    component.pluginConfigurations = [
      {
        pluginConfigurationId: SOURCE_ID,
        pluginDefinitionKey: 'my-plugin',
        existsInTargetEnvironment: false,
      },
    ];

    fixture.detectChanges();

    expect(component.rows$.value[0].status).toBe('no-configurations');
  });

  it('should report unidentifiable plugins and not build a row for them', () => {
    component.pluginConfigurations = [
      {
        pluginConfigurationId: SOURCE_ID,
        pluginDefinitionKey: null,
        existsInTargetEnvironment: false,
      },
    ];

    fixture.detectChanges();

    expect(component.hasUnidentifiablePlugins$.value).toBeTrue();
    expect(component.rows$.value).toEqual([]);
  });
});
