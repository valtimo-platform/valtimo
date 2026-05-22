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

import {ConditionOperator} from '../models';

const OPERATOR_LABEL: Record<ConditionOperator, string> = {
  '==': 'accessControl.overview.operators.eq',
  '!=': 'accessControl.overview.operators.neq',
  '>': 'accessControl.overview.operators.gt',
  '>=': 'accessControl.overview.operators.gte',
  '<': 'accessControl.overview.operators.lt',
  '<=': 'accessControl.overview.operators.lte',
  in: 'accessControl.overview.operators.in',
  list_contains: 'accessControl.overview.operators.list_contains',
};

const NO_CONTEXT_RESOURCE_TYPE = 'com.ritense.authorization.NoContext';

export {NO_CONTEXT_RESOURCE_TYPE, OPERATOR_LABEL};
