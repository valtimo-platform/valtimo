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

type ConditionOperator = '==' | '!=' | '>' | '>=' | '<' | '<=' | 'in' | 'list_contains';

interface FieldCondition {
  type: 'field';
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

interface ExpressionCondition {
  type: 'expression';
  field: string;
  path: string;
  operator: ConditionOperator;
  value: unknown;
  clazz: string;
}

interface ContainerCondition {
  type: 'container';
  resourceType: string;
  conditions: PermissionCondition[];
}

type PermissionCondition = FieldCondition | ExpressionCondition | ContainerCondition;

interface Permission {
  resourceType: string;
  action?: string;
  actions?: string[];
  roleKey: string;
  conditions?: PermissionCondition[];
  contextResourceType?: string;
  contextConditions?: PermissionCondition[];
}

interface ResourcePermissionGroup {
  resourceType: string;
  permissions: Permission[];
}

export {
  ConditionOperator,
  ContainerCondition,
  ExpressionCondition,
  FieldCondition,
  Permission,
  PermissionCondition,
  ResourcePermissionGroup,
};
