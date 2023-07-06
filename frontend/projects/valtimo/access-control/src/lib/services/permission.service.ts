import {Injectable} from '@angular/core';
import jwt_decode from 'jwt-decode';
import {KeycloakService} from 'keycloak-angular';
import {NGXLogger} from 'ngx-logger';
import {Observable, of, Subject, take, timer} from 'rxjs';
import {fromPromise} from 'rxjs/internal/observable/innerFrom';
import {
  CachedResolvedPermissions,
  PendingPermissions,
  PermissionContext,
  PermissionRequestCollection,
  ResolvedPermissions,
} from '../models';
import {PermissionApiService} from './permission-api.service';

@Injectable({
  providedIn: 'root',
})
export class PermissionService {
  private readonly _cachedResolvedPermissions: CachedResolvedPermissions = {};
  private readonly _pendingPermissions: PendingPermissions = {};

  constructor(
    private readonly keyCloakService: KeycloakService,
    private readonly logger: NGXLogger,
    private readonly permissionApiService: PermissionApiService
  ) {}

  public requestPermission(
    permissionRequestCollection: PermissionRequestCollection,
    permissionRequestCollectionKey: number,
    context: PermissionContext
  ): Observable<boolean> {
    const collectionKey: string = this.getCollectionKey(permissionRequestCollection);
    const cachedResolvedPermissionCollection: {[permissionRequestCollectionKey: string]: boolean} =
      this._cachedResolvedPermissions[collectionKey];
    const pendingPermissionCollection: {
      [permissionRequestCollectionKey: string]: Subject<boolean>;
    } = this._pendingPermissions[collectionKey];

    if (cachedResolvedPermissionCollection) {
      this.logger.debug(
        'cached permissions',
        permissionRequestCollection[permissionRequestCollectionKey]
      );

      return of(cachedResolvedPermissionCollection[permissionRequestCollectionKey]);
    }

    if (pendingPermissionCollection) {
      this.logger.debug(
        'existing pending permissions',
        permissionRequestCollection[permissionRequestCollectionKey]
      );

      return pendingPermissionCollection[permissionRequestCollectionKey];
    }

    this._pendingPermissions[collectionKey] = Object.keys(permissionRequestCollection).reduce(
      (acc: {[key: string]: Subject<boolean>}, key: string) => ({
        ...acc,
        [key]: new Subject<boolean>(),
      }),
      {}
    );

    permissionRequestCollection[permissionRequestCollectionKey] = {
      ...permissionRequestCollection[permissionRequestCollectionKey],
      context,
    };
    this.requestPermissions(permissionRequestCollection, collectionKey);

    this.logger.debug(
      'new pending permission',
      permissionRequestCollection[permissionRequestCollectionKey]
    );

    return this._pendingPermissions[collectionKey][permissionRequestCollectionKey].asObservable();
  }

  private requestPermissions(collection: PermissionRequestCollection, collectionKey: string): void {
    this.permissionApiService
      .resolvePermissionRequestCollection(collection)
      .pipe(take(1))
      .subscribe((resolvedCollection: ResolvedPermissions) => {
        Object.keys(resolvedCollection).forEach((collectionPermissionKey: string) => {
          this._pendingPermissions[collectionKey][collectionPermissionKey].next(
            resolvedCollection[collectionPermissionKey]
          );
        });

        this.cacheResolvedPermissions(collectionKey, resolvedCollection);
      });
  }

  private cacheResolvedPermissions(
    collectionKey: string,
    resolvedPermissions: ResolvedPermissions
  ): void {
    this._cachedResolvedPermissions[collectionKey] = resolvedPermissions;
    this.openClearCacheSubscription(collectionKey);
  }

  private openClearCacheSubscription(collectionKey): void {
    fromPromise(this.keyCloakService.getToken())
      .pipe(take(1))
      .subscribe(token => {
        const tokenExp = (jwt_decode(token) as any).exp * 1000;
        const expiryTime = tokenExp - Date.now() - 1000;

        timer(expiryTime)
          .pipe(take(1))
          .subscribe(() => {
            if (this._cachedResolvedPermissions[collectionKey]) {
              delete this._cachedResolvedPermissions[collectionKey];
              delete this._pendingPermissions[collectionKey];
            }
          });
      });
  }

  private getCollectionKey(requestCollection: PermissionRequestCollection): string {
    const input = JSON.stringify(requestCollection);
    const len = input.length;

    let hash = 0;

    for (let i = 0; i < len; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0; // to 32bit integer
    }
    return `${hash}`;
  }
}
