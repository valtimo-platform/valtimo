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

import {Injectable} from '@angular/core';
import {map, Observable, shareReplay} from 'rxjs';
import {PermissionSchema} from '../models';
import {AccessControlService} from './access-control.service';

interface SchemaAllOfBranch {
  if?: {properties?: {resourceType?: {const?: string}}};
  then?: {properties?: {action?: {enum?: string[]}}};
}

interface SchemaShape {
  items?: {allOf?: SchemaAllOfBranch[]};
}

@Injectable({providedIn: 'root'})
export class PermissionSchemaMetadataService {
  public readonly schema$: Observable<PermissionSchema> = this.accessControlService
    .getPermissionSchema()
    .pipe(shareReplay({bufferSize: 1, refCount: false}));

  public readonly actionsByResourceType$: Observable<Record<string, string[]>> =
    this.schema$.pipe(map(schema => this.extractActionsByResourceType(schema)));

  public readonly allResourceTypes$: Observable<string[]> = this.actionsByResourceType$.pipe(
    map(actions => Object.keys(actions))
  );

  constructor(private readonly accessControlService: AccessControlService) {}

  private extractActionsByResourceType(schema: PermissionSchema): Record<string, string[]> {
    const branches = (schema as SchemaShape)?.items?.allOf ?? [];
    const result: Record<string, string[]> = {};
    for (const branch of branches) {
      const resourceType = branch?.if?.properties?.resourceType?.const;
      const actions = branch?.then?.properties?.action?.enum;
      if (resourceType && Array.isArray(actions)) {
        result[resourceType] = [...actions];
      }
    }
    return result;
  }
}
