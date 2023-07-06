import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {map, Observable} from 'rxjs';
import {
  PermissionRequest,
  PermissionRequestCollection,
  PermissionResponse,
  ResolvedPermissions,
} from '../models';

@Injectable({
  providedIn: 'root',
})
export class PermissionApiService {
  private valtimoEndpointUri: string;

  constructor(private readonly http: HttpClient, private readonly configService: ConfigService) {
    this.valtimoEndpointUri = this.configService.config.valtimoApi.endpointUri;
  }

  public resolvePermissionRequestCollection(
    permissionRequestCollection: PermissionRequestCollection
  ): Observable<ResolvedPermissions> {
    return this.requestPermission(Object.values(permissionRequestCollection)).pipe(
      map((res: PermissionResponse[]) => {
        const keys: string[] = Object.keys(permissionRequestCollection);

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
