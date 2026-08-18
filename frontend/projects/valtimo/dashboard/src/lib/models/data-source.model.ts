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

import {Type} from '@angular/core';
import {ExpressionOperator} from '@valtimo/shared';
import {DataSourceConfigurationComponent} from './configuration.model';

interface DataSourceSpecification {
  dataSourceKey: string;
  configurationComponent?: Type<DataSourceConfigurationComponent>;
  translations: {
    [langKey: string]: {
      title: string;
      [translationKey: string]: string;
    };
  };
}

interface QueryCondition {
  queryPath: string;
  queryOperator: string;
  queryValue: string;
}

/**
 * A single condition as the configuration UI writes it: canonical keys and a scalar value.
 */
interface ConditionLeaf {
  path: string;
  operator: ExpressionOperator;
  value: string;
}

interface AndConditionGroup {
  and: ConditionNode[];
}

interface OrConditionGroup {
  or: ConditionNode[];
}

type ConditionGroup = AndConditionGroup | OrConditionGroup;

type ConditionNode = ConditionLeaf | ConditionGroup;

/**
 * A condition tree in the shape it can actually arrive in from the backend: leaves may use the
 * legacy [[QueryCondition]] aliases, values may be arrays (for the `in` operator) and operators
 * may be ones the configuration UI has no input for. Narrow to [[ConditionNode]] before relying
 * on a leaf's contents; nodes that cannot be narrowed are passed through unchanged.
 */
interface WireConditionLeaf {
  path?: string;
  operator?: string;
  value?: unknown;
  queryPath?: string;
  queryOperator?: string;
  queryValue?: unknown;
}

interface WireAndConditionGroup {
  and: WireConditionNode[];
}

interface WireOrConditionGroup {
  or: WireConditionNode[];
}

type WireConditionGroup = WireAndConditionGroup | WireOrConditionGroup;

type WireConditionNode = WireConditionLeaf | WireConditionGroup;

export {
  DataSourceSpecification,
  QueryCondition,
  ConditionLeaf,
  AndConditionGroup,
  OrConditionGroup,
  ConditionGroup,
  ConditionNode,
  WireConditionLeaf,
  WireAndConditionGroup,
  WireOrConditionGroup,
  WireConditionGroup,
  WireConditionNode,
};
