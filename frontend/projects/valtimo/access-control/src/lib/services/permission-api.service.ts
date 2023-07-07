import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {map, Observable} from 'rxjs';
import {
  PermissionRequest,
  PermissionRequestQueue,
  PermissionResponse,
  ResolvedPermissions,
} from '../models';
import {getPermissionRequestKey} from '../utils/permission.utils';
import {NGXLogger} from 'ngx-logger';

@Injectable({
  providedIn: 'root',
})
export class PermissionApiService {
  private valtimoEndpointUri: string;

  constructor(
    private readonly http: HttpClient,
    private readonly configService: ConfigService,
    private readonly logger: NGXLogger
  ) {
    this.valtimoEndpointUri = this.configService.config.valtimoApi.endpointUri;
  }

  public resolvePermissionRequestQueue(
    permissionRequestQueue: PermissionRequestQueue
  ): Observable<ResolvedPermissions> {
    this.logger.debug('Permissions: request to resolve permission queue', permissionRequestQueue);

    return this.requestPermission(permissionRequestQueue).pipe(
      map((res: PermissionResponse[]) => {
        const keys: string[] = permissionRequestQueue.map(permissionRequest =>
          getPermissionRequestKey(permissionRequest)
        );

        return res.reduce(
          (acc: ResolvedPermissions, curr: PermissionResponse, index: number) => ({
            ...acc,
            [keys[index]]: curr.available,
          }),
          {}
        );
      })
    );
  }

  public requestPermission(request: PermissionRequest[]): Observable<PermissionResponse[]> {
    return this.http.post<PermissionResponse[]>(
      `${this.valtimoEndpointUri}v1/permissions`,
      request
    );
  }
}
