import {HttpClient} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {ConfigService} from '@valtimo/config';
import {BehaviorSubject, catchError, Observable, of, switchMap, take} from 'rxjs';
import {DeleteRolesRequest, Role} from '../models';

@Injectable({providedIn: 'root'})
export class AccessControlService {
  public readonly roles$ = new BehaviorSubject<Role[]>([]);

  private valtimoEndpointUri: string;

  private get roleDtos$(): Observable<Role[]> {
    return this.http.get<Role[]>(`${this.valtimoEndpointUri}v1/roles`);
  }

  constructor(private readonly configService: ConfigService, private readonly http: HttpClient) {
    this.valtimoEndpointUri = `${this.configService.config.valtimoApi.endpointUri}management/`;
  }

  public addRole(role: Role): Observable<Role> {
    return this.http.post<Role>(`${this.valtimoEndpointUri}v1/roles`, role);
  }

  public deleteRoles(request: DeleteRolesRequest): Observable<null> {
    return this.http.delete<null>(`${this.valtimoEndpointUri}v1/roles`, {body: request});
  }

  public dispatchAction(actionResult: Observable<Role | null>): void {
    actionResult
      .pipe(
        switchMap(() => this.roleDtos$),
        take(1),
        catchError(error => of(error))
      )
      .subscribe({
        next: (roles: Role[]) => this.roles$.next(roles),
        error: error => {
          console.error(error);
        },
      });
  }

  public loadRoles(): void {
    this.roleDtos$.pipe(take(1)).subscribe({
      next: (items: Role[]) => {
        this.roles$.next(items);
      },
      error: error => {
        console.error(error);
      },
    });
  }

  public getRolePermissions(roleKey: string): Observable<object> {
    return this.http.get<object>(`${this.valtimoEndpointUri}v1/roles/${roleKey}/permissions`);
  }

  public updateRolePermissions(roleKey: string, updatedPermission: object): Observable<object> {
    return this.http.put<object>(
      `${this.valtimoEndpointUri}v1/roles/${roleKey}/permissions`,
      updatedPermission
    );
  }

  public updateRole(roleKey: string, request: Role): Observable<object> {
    return this.http.put<object>(`${this.valtimoEndpointUri}v1/roles/${roleKey}`, request);
  }
}
