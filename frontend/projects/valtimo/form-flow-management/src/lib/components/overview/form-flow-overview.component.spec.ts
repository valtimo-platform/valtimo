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
import {ListFormFlowDefinition} from '../../models';
import {FormFlowOverviewComponent} from './form-flow-overview.component';

describe('FormFlowOverviewComponent', () => {
  const build = (): FormFlowOverviewComponent =>
    new FormFlowOverviewComponent(
      {} as any,
      {} as any,
      {params: of({})} as any,
      {} as any,
      {instant: (key: string) => key} as any,
      {} as any
    );

  const deleteAction = (component: FormFlowOverviewComponent) =>
    component.ACTION_ITEMS.find(item => item.label === 'interface.delete');

  const definition = (readOnly: boolean): ListFormFlowDefinition =>
    ({key: 'flow', versions: [1], readOnly}) as ListFormFlowDefinition;

  it('disables delete for a read-only form flow definition', () => {
    expect(deleteAction(build())?.disabledCallback?.(definition(true))).toBeTrue();
  });

  it('enables delete for an editable form flow definition', () => {
    expect(deleteAction(build())?.disabledCallback?.(definition(false))).toBeFalse();
  });
});
