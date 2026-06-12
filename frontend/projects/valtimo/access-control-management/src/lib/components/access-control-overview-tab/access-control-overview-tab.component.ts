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

import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {RouterModule} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {BehaviorSubject, combineLatest, map, Observable} from 'rxjs';
import {NO_CONTEXT_RESOURCE_TYPE} from '../../constants';
import {
  ContainerCondition,
  ExpressionCondition,
  FieldCondition,
  Permission,
  PermissionCondition,
} from '../../models';
import {ResourceTypeLabelPipe} from '../../pipes';
import {PermissionSchemaMetadataService} from '../../services';
import {formatField, formatOperator, formatValue} from '../../utils';

interface FormattedFieldCondition {
  kind: 'field';
  field: string;
  operator: string;
  value: string;
  customField: boolean;
}

interface FormattedExpressionCondition {
  kind: 'expression';
  field: string;
  path: string;
  operator: string;
  value: string;
  clazz: string;
  customField: boolean;
}

interface FormattedContainerCondition {
  kind: 'container';
  resourceType: string;
  conditions: PermissionCondition[];
  customResource: boolean;
}

type FormattedCondition =
  | FormattedFieldCondition
  | FormattedExpressionCondition
  | FormattedContainerCondition;

interface ActionOverview {
  action: string;
  grants: Permission[];
}

interface ResourceOverview {
  resourceType: string;
  actions: ActionOverview[];
}

@Component({
  standalone: true,
  selector: 'valtimo-access-control-overview-tab',
  templateUrl: './access-control-overview-tab.component.html',
  styleUrls: ['./access-control-overview-tab.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  preserveWhitespaces: true,
  imports: [CommonModule, RouterModule, TranslateModule, ResourceTypeLabelPipe],
})
export class AccessControlOverviewTabComponent {
  @Input() public roleKey: string | null = null;

  @Input()
  public set permissions(value: Permission[] | null) {
    this._permissions$.next(value ?? []);
  }

  private readonly _permissions$ = new BehaviorSubject<Permission[]>([]);

  public readonly overview$: Observable<ResourceOverview[]> = combineLatest([
    this._permissions$,
    this.metadataService.allResourceTypes$,
    this.metadataService.actionsByResourceType$,
  ]).pipe(
    map(([permissions, allResourceTypes, actionsByResourceType]) =>
      this.buildOverview(permissions, allResourceTypes, actionsByResourceType)
    )
  );

  constructor(
    private readonly metadataService: PermissionSchemaMetadataService,
    private readonly translateService: TranslateService
  ) {}

  public formatConditions(
    conditions: PermissionCondition[] | null | undefined,
    resourceType: string
  ): FormattedCondition[] {
    return (conditions ?? []).map(condition => this.formatCondition(condition, resourceType));
  }

  public isNoContext(contextResourceType: string | null | undefined): boolean {
    return contextResourceType === NO_CONTEXT_RESOURCE_TYPE;
  }

  private buildOverview(
    permissions: Permission[],
    allResourceTypes: string[],
    actionsByResourceType: Record<string, string[]>
  ): ResourceOverview[] {
    const knownResourceTypes = new Set(allResourceTypes);
    const extraResourceTypes = permissions
      .map(p => p.resourceType)
      .filter(rt => !!rt && !knownResourceTypes.has(rt));
    const resourceTypes = [...allResourceTypes, ...Array.from(new Set(extraResourceTypes))];

    return resourceTypes.map(resourceType => {
      const forResource = permissions.filter(p => p.resourceType === resourceType);
      const allowedActions = actionsByResourceType[resourceType] ?? [];
      const allowedSet = new Set(allowedActions);
      const extraActions = forResource
        .flatMap(p => [...(p.actions ?? []), ...(p.action ? [p.action] : [])])
        .filter(a => !!a && !allowedSet.has(a));
      const actions = [...allowedActions, ...Array.from(new Set(extraActions))];

      return {
        resourceType,
        actions: actions.map(action => ({
          action,
          grants: forResource.filter(p => this.permissionGrants(p, action)),
        })),
      };
    });
  }

  private permissionGrants(permission: Permission, action: string): boolean {
    if (permission.action === action) return true;
    return (permission.actions ?? []).includes(action);
  }

  private formatCondition(
    condition: PermissionCondition,
    resourceType: string
  ): FormattedCondition {
    if (condition.type === 'container') {
      return this.formatContainer(condition);
    }
    if (condition.type === 'expression') {
      return this.formatExpression(condition, resourceType);
    }
    return this.formatField(condition, resourceType);
  }

  private formatField(condition: FieldCondition, resourceType: string): FormattedFieldCondition {
    return {
      kind: 'field',
      field: formatField(this.translateService, resourceType, condition.field),
      operator: formatOperator(this.translateService, condition.operator),
      value: formatValue(this.translateService, condition.value),
      customField: !this.metadataService.isFieldKnown(resourceType, condition.field),
    };
  }

  private formatExpression(
    condition: ExpressionCondition,
    resourceType: string
  ): FormattedExpressionCondition {
    return {
      kind: 'expression',
      field: formatField(this.translateService, resourceType, condition.field),
      path: condition.path,
      operator: formatOperator(this.translateService, condition.operator),
      value: formatValue(this.translateService, condition.value),
      clazz: condition.clazz,
      customField: !this.metadataService.isFieldKnown(resourceType, condition.field),
    };
  }

  private formatContainer(condition: ContainerCondition): FormattedContainerCondition {
    return {
      kind: 'container',
      resourceType: condition.resourceType,
      conditions: condition.conditions ?? [],
      customResource: !this.metadataService.isResourceTypeKnown(condition.resourceType),
    };
  }
}
