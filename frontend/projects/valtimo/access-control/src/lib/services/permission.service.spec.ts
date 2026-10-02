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

import {fakeAsync, TestBed, tick} from '@angular/core/testing';
import {KeycloakService} from 'keycloak-angular';
import {NGXLogger} from 'ngx-logger';
import {of} from 'rxjs';
import {PermissionRequest, PermissionRequestQueue, ResolvedPermissions} from '../models';
import {getPermissionRequestKey} from '../utils';
import {PermissionApiService} from './permission-api.service';
import {PermissionService} from './permission.service';

describe('PermissionService', () => {
  const TASK_RESOURCE = 'com.ritense.valtimo.operaton.domain.OperatonTask';
  const DOCUMENT_RESOURCE = 'com.ritense.document.domain.impl.JsonSchemaDocument';
  const CAN_ASSIGN_TASK_PERMISSION: PermissionRequest = {
    action: 'assign',
    resource: TASK_RESOURCE,
  };
  const CAN_VIEW_DOCUMENT_PERMISSION: PermissionRequest = {
    action: 'view',
    resource: DOCUMENT_RESOURCE,
  };

  let service: PermissionService;
  let permissionApiService: jasmine.SpyObj<PermissionApiService>;
  let permissionResult: (permissionRequest: PermissionRequest) => boolean;

  beforeEach(() => {
    permissionResult = () => true;
    permissionApiService = jasmine.createSpyObj('PermissionApiService', [
      'resolvePermissionRequestQueue',
    ]);
    permissionApiService.resolvePermissionRequestQueue.and.callFake(
      (permissionRequestQueue: PermissionRequestQueue) =>
        of(
          permissionRequestQueue.reduce(
            (acc: ResolvedPermissions, permissionRequest: PermissionRequest) => ({
              ...acc,
              [getPermissionRequestKey(permissionRequest)]: permissionResult(permissionRequest),
            }),
            {}
          )
        )
    );

    TestBed.configureTestingModule({
      providers: [
        PermissionService,
        // the token promise never resolves, keeping the token expiry cache timer out of the tests
        {provide: KeycloakService, useValue: {getToken: () => new Promise<string>(() => {})}},
        {provide: NGXLogger, useValue: jasmine.createSpyObj('NGXLogger', ['debug', 'error'])},
        {provide: PermissionApiService, useValue: permissionApiService},
      ],
    });

    service = TestBed.inject(PermissionService);
  });

  const requestPermission = (
    permissionRequest: PermissionRequest,
    resource: string,
    identifier: string
  ): boolean | undefined => {
    let result: boolean | undefined;
    service
      .requestPermission(permissionRequest, {resource, identifier})
      .subscribe(allowed => (result = allowed));
    tick(20);
    return result;
  };

  const requestAssignTaskPermission = (taskId: string): boolean | undefined =>
    requestPermission(CAN_ASSIGN_TASK_PERMISSION, TASK_RESOURCE, taskId);

  it('resolves permissions through the api and caches the result', fakeAsync(() => {
    expect(requestAssignTaskPermission('task-1')).toBeTrue();
    expect(permissionApiService.resolvePermissionRequestQueue).toHaveBeenCalledTimes(1);

    expect(requestAssignTaskPermission('task-1')).toBeTrue();
    expect(permissionApiService.resolvePermissionRequestQueue).toHaveBeenCalledTimes(1);
  }));

  it('re-evaluates a permission after the resource instance is invalidated', fakeAsync(() => {
    expect(requestAssignTaskPermission('task-1')).toBeTrue();

    permissionResult = () => false;
    service.invalidateResource(TASK_RESOURCE, 'task-1');

    expect(requestAssignTaskPermission('task-1')).toBeFalse();
    expect(permissionApiService.resolvePermissionRequestQueue).toHaveBeenCalledTimes(2);
  }));

  it('keeps cached permissions of other resource instances on invalidation', fakeAsync(() => {
    expect(requestAssignTaskPermission('task-1')).toBeTrue();
    expect(requestAssignTaskPermission('task-2')).toBeTrue();
    expect(permissionApiService.resolvePermissionRequestQueue).toHaveBeenCalledTimes(2);

    service.invalidateResource(TASK_RESOURCE, 'task-1');

    expect(requestAssignTaskPermission('task-2')).toBeTrue();
    expect(permissionApiService.resolvePermissionRequestQueue).toHaveBeenCalledTimes(2);
  }));

  it('invalidates all permissions for a resource when no identifier is provided', fakeAsync(() => {
    expect(requestAssignTaskPermission('task-1')).toBeTrue();
    expect(requestAssignTaskPermission('task-2')).toBeTrue();

    permissionResult = () => false;
    service.invalidateResource(TASK_RESOURCE);

    expect(requestAssignTaskPermission('task-1')).toBeFalse();
    expect(requestAssignTaskPermission('task-2')).toBeFalse();
  }));

  it('keeps cached permissions of other resources on invalidation', fakeAsync(() => {
    expect(
      requestPermission(CAN_VIEW_DOCUMENT_PERMISSION, DOCUMENT_RESOURCE, 'document-1')
    ).toBeTrue();

    service.invalidateResource(TASK_RESOURCE);

    expect(
      requestPermission(CAN_VIEW_DOCUMENT_PERMISSION, DOCUMENT_RESOURCE, 'document-1')
    ).toBeTrue();
    expect(permissionApiService.resolvePermissionRequestQueue).toHaveBeenCalledTimes(1);
  }));
});
