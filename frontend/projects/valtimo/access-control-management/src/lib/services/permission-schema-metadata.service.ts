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
import {BehaviorSubject, map, Observable, shareReplay, tap} from 'rxjs';
import {PermissionSchema, SchemaShape} from '../models';
import {AccessControlService} from './access-control.service';

@Injectable({providedIn: 'root'})
export class PermissionSchemaMetadataService {
  private readonly _knownResourceTypes$ = new BehaviorSubject<Set<string>>(new Set());
  private readonly _fieldsByResourceType$ = new BehaviorSubject<Record<string, Set<string>>>({});

  public readonly schema$: Observable<PermissionSchema> = this.accessControlService
    .getPermissionSchema()
    .pipe(
      tap(schema => {
        this._knownResourceTypes$.next(this.extractKnownResourceTypes(schema));
        this._fieldsByResourceType$.next(this.extractFieldsByResourceType(schema));
      }),
      shareReplay({bufferSize: 1, refCount: false})
    );

  public readonly actionsByResourceType$: Observable<Record<string, string[]>> =
    this.schema$.pipe(map(schema => this.extractActionsByResourceType(schema)));

  public readonly allResourceTypes$: Observable<string[]> = this.actionsByResourceType$.pipe(
    map(actions => Object.keys(actions))
  );

  constructor(private readonly accessControlService: AccessControlService) {}

  public isResourceTypeKnown(fqn: string): boolean {
    return this._knownResourceTypes$.value.has(fqn);
  }

  public isFieldKnown(resourceType: string, field: string): boolean {
    return this._fieldsByResourceType$.value[resourceType]?.has(field) ?? false;
  }

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

  private extractKnownResourceTypes(schema: PermissionSchema): Set<string> {
    const entries = (schema as SchemaShape)?.items?.properties?.resourceType?.oneOf ?? [];
    const result = new Set<string>();
    for (const entry of entries) {
      if (entry?.const) result.add(entry.const);
    }
    return result;
  }

  private extractFieldsByResourceType(schema: PermissionSchema): Record<string, Set<string>> {
    const definitions = (schema as SchemaShape)?.definitions ?? {};
    const result: Record<string, Set<string>> = {};
    for (const [key, def] of Object.entries(definitions)) {
      if (!key.startsWith('condList.')) continue;
      const resourceType = key.substring('condList.'.length);
      const fields = new Set<string>();
      for (const variant of def?.items?.oneOf ?? []) {
        for (const part of variant?.allOf ?? []) {
          for (const f of part?.properties?.field?.enum ?? []) fields.add(f);
        }
      }
      result[resourceType] = fields;
    }
    return result;
  }
}
