import {Injectable} from '@angular/core';
import {NamedUser} from '@valtimo/config';
import {of, map, Observable, BehaviorSubject, startWith, debounceTime} from 'rxjs';
import {COLLABORATORS} from '../mocks';
import {Collaborator} from '../models';

@Injectable({
  providedIn: 'root',
})
export class CaseCollaboratorsService {
  private readonly _collaborators$ = new BehaviorSubject<NamedUser[]>(COLLABORATORS);

  public readonly collaborators$: Observable<Collaborator[] | null> = this._collaborators$.pipe(
    debounceTime(1000),
    map((users: NamedUser[]) =>
      users.map((user: NamedUser) => ({...user, fullName: `${user.firstName} ${user.lastName}`}))
    ),
    startWith(null)
  );
}
