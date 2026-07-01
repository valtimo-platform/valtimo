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
import {
  PbacConditionTypeDto,
  PbacEntityMapperDto,
  PbacOperatorDto,
  PbacRegistryDto,
  PbacResourceDto,
} from '@valtimo/shared';
import {BehaviorSubject, map, Observable, shareReplay, tap} from 'rxjs';
import {PermissionSchema} from '../models';
import {AccessControlService} from './access-control.service';

@Injectable({providedIn: 'root'})
export class PermissionSchemaMetadataService {
  private readonly _knownResourceTypes$ = new BehaviorSubject<Set<string>>(new Set());
  private readonly _fieldsByResourceType$ = new BehaviorSubject<Record<string, Set<string>>>({});

  /**
   * The full PBAC registry served by GET /api/management/v1/pbac/registry. This is the
   * authoritative, purpose-built description of every resource type, its actions and fields,
   * the available operators and condition types, the entity-mapper pairs that define which
   * context resources a permission can be scoped to, and the configured roles. It drives both
   * the read-only overview and the form-based editor.
   */
  public readonly registry$: Observable<PbacRegistryDto> = this.accessControlService
    .getPbacRegistry()
    .pipe(
      tap(registry => {
        this._knownResourceTypes$.next(this.extractKnownResourceTypes(registry));
        this._fieldsByResourceType$.next(this.extractFieldsByResourceType(registry));
      }),
      shareReplay({bufferSize: 1, refCount: false})
    );

  public readonly resources$: Observable<PbacResourceDto[]> = this.registry$.pipe(
    map(registry => registry.resources)
  );

  public readonly resourceByType$: Observable<Record<string, PbacResourceDto>> =
    this.resources$.pipe(
      map(resources =>
        resources.reduce<Record<string, PbacResourceDto>>((acc, resource) => {
          acc[resource.resourceType] = resource;
          return acc;
        }, {})
      )
    );

  /**
   * Raw JSON schema served by GET /api/management/v1/permissions/schema. Drives validation and
   * autocomplete in the Monaco JSON editor.
   */
  public readonly schema$: Observable<PermissionSchema> = this.accessControlService
    .getPermissionSchema()
    .pipe(shareReplay({bufferSize: 1, refCount: false}));

  // The available actions per resource type come straight from the PBAC registry. The backend
  // discovers every ResourceActionProvider on the classpath — not only the ones registered as
  // Spring beans — so each resource's action list is complete.
  public readonly actionsByResourceType$: Observable<Record<string, string[]>> =
    this.resources$.pipe(
      map(resources =>
        resources.reduce<Record<string, string[]>>((acc, resource) => {
          acc[resource.resourceType] = [...resource.actions];
          return acc;
        }, {})
      )
    );

  public readonly allResourceTypes$: Observable<string[]> = this.resources$.pipe(
    map(resources => resources.map(resource => resource.resourceType))
  );

  public readonly operators$: Observable<PbacOperatorDto[]> = this.registry$.pipe(
    map(registry => registry.operators)
  );

  public readonly conditionTypes$: Observable<PbacConditionTypeDto[]> = this.registry$.pipe(
    map(registry => registry.conditionTypes)
  );

  public readonly entityMappers$: Observable<PbacEntityMapperDto[]> = this.registry$.pipe(
    map(registry => registry.entityMappers)
  );

  public readonly roles$: Observable<string[]> = this.registry$.pipe(
    map(registry => registry.roles)
  );

  constructor(private readonly accessControlService: AccessControlService) {}

  public isResourceTypeKnown(fqn: string): boolean {
    return this._knownResourceTypes$.value.has(fqn);
  }

  public isFieldKnown(resourceType: string, field: string): boolean {
    return this._fieldsByResourceType$.value[resourceType]?.has(field) ?? false;
  }

  private extractKnownResourceTypes(registry: PbacRegistryDto): Set<string> {
    return new Set(registry.resources.map(resource => resource.resourceType));
  }

  private extractFieldsByResourceType(registry: PbacRegistryDto): Record<string, Set<string>> {
    const result: Record<string, Set<string>> = {};
    for (const resource of registry.resources) {
      const fields = new Set<string>();
      for (const field of resource.fields) fields.add(field.name);
      for (const alias of resource.fieldAliases) fields.add(alias.alias);
      result[resource.resourceType] = fields;
    }
    return result;
  }
}
