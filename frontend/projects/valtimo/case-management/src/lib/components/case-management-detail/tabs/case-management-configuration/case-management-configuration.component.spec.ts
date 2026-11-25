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

import {ActionItem} from '@valtimo/components';
import {firstValueFrom, of} from 'rxjs';
import {CaseManagementConfigurationComponent} from './case-management-configuration.component';

describe('CaseManagementConfigurationComponent', () => {
  const PARAMS = {caseDefinitionKey: 'permit', caseDefinitionVersionTag: '1.0.0'};
  const ITEM = {key: 'api-url', defaultValue: 'https://a', environmentValue: null};

  let api: jasmine.SpyObj<any>;

  const build = (canEdit: boolean): CaseManagementConfigurationComponent => {
    api = jasmine.createSpyObj('CaseConfigurationApiService', [
      'getConfigurations',
      'deleteConfiguration',
      'clearEnvironmentValue',
    ]);
    api.getConfigurations.and.returnValue(of([ITEM]));
    api.deleteConfiguration.and.returnValue(of(undefined));
    api.clearEnvironmentValue.and.returnValue(of(undefined));

    return new CaseManagementConfigurationComponent(
      api,
      {hasEditPermissions: () => of(canEdit)} as any,
      {registerAll: () => {}} as any,
      {params: of(PARAMS), parent: {params: of({})}} as any
    );
  };

  const labels = (items: ActionItem[]): string[] => items.map(item => item.label);

  it('offers edit and delete of declarations on an editable version', async () => {
    const component = build(true);

    expect(labels(await firstValueFrom(component.actionItems$))).toEqual([
      'interface.edit',
      'caseManagement.configuration.setEnvironmentValue',
      'caseManagement.configuration.clearEnvironmentValue',
      'interface.delete',
    ]);
  });

  it('offers only the environment value actions on a final version', async () => {
    const component = build(false);

    expect(labels(await firstValueFrom(component.actionItems$))).toEqual([
      'caseManagement.configuration.setEnvironmentValue',
      'caseManagement.configuration.clearEnvironmentValue',
    ]);
  });

  it('disables clearing when no environment value is set', async () => {
    const component = build(false);
    const clear = (await firstValueFrom(component.actionItems$))[1];

    expect(clear.disabledCallback?.(ITEM)).toBeTrue();
    expect(clear.disabledCallback?.({...ITEM, environmentValue: 'x'})).toBeFalse();
  });

  it('loads the items of the route version and records the used keys', async () => {
    const component = build(true);

    expect(await firstValueFrom(component.items$)).toEqual([ITEM]);
    expect(api.getConfigurations).toHaveBeenCalledWith(PARAMS);
    expect(component.$usedKeys()).toEqual(['api-url']);
  });

  it('opens the declaration modal on row click when editable, the environment value modal otherwise', () => {
    const editable = build(true);
    editable.onRowClicked(ITEM);
    expect(editable.$declarationModalOpen()).toBeTrue();
    expect(editable.$environmentValueModalOpen()).toBeFalse();

    const final = build(false);
    final.onRowClicked(ITEM);
    expect(final.$declarationModalOpen()).toBeFalse();
    expect(final.$environmentValueModalOpen()).toBeTrue();
    expect(final.$environmentValueItem()).toBe(ITEM);
  });

  it('deletes a declaration and clears an environment value for the route version', () => {
    const component = build(true);

    component.onConfirmDelete(ITEM);
    component.onConfirmClearEnvironmentValue(ITEM);

    expect(api.deleteConfiguration).toHaveBeenCalledWith(PARAMS, 'api-url');
    expect(api.clearEnvironmentValue).toHaveBeenCalledWith(PARAMS, 'api-url');
  });
});
