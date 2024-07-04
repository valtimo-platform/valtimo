/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
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
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {DropdownItem} from '@valtimo/components';
import {BehaviorSubject, combineLatest, Subscription, take, tap} from 'rxjs';
import {TaskService} from '../../services';
import {NamedUser} from '@valtimo/config';

@Component({
  selector: 'valtimo-assign-user-to-task',
  templateUrl: './assign-user-to-task.component.html',
  styleUrls: ['./assign-user-to-task.component.scss'],
})
export class AssignUserToTaskComponent implements OnInit, OnChanges, OnDestroy {
  @Input() taskId: string;
  @Input() assigneeId: string;
  @Output() assignmentOfTaskChanged = new EventEmitter();

  public assignedIdOnServer$ = new BehaviorSubject<string | null>(null);
  public assignedUserFullName$ = new BehaviorSubject<string | null>(null);
  public candidateUsersForTask$ = new BehaviorSubject<NamedUser[] | undefined>(undefined);
  public disabled$ = new BehaviorSubject<boolean>(true);
  public userIdToAssign: string | null = null;
  private _subscriptions = new Subscription();

  constructor(private taskService: TaskService) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.taskService.getCandidateUsers(this.taskId).subscribe(candidateUsers => {
        this.candidateUsersForTask$.next(candidateUsers);
        if (this.assigneeId) {
          this.assignedIdOnServer$.next(this.assigneeId);
          this.userIdToAssign = this.assigneeId;
          this.assignedUserFullName$.next(
            this.getAssignedUserName(candidateUsers, this.assigneeId)
          );
        }
        this.enable();
      })
    );
  }

  public ngOnChanges(changes: SimpleChanges): void {
    this.candidateUsersForTask$.pipe(take(1)).subscribe(candidateUsers => {
      const currentUserId = changes.assigneeId?.currentValue || this.assigneeId;
      this.assignedIdOnServer$.next(currentUserId || null);
      this.userIdToAssign = currentUserId || null;
      this.assignedUserFullName$.next(
        this.getAssignedUserName(candidateUsers ?? [], currentUserId)
      );
    });
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public assignTask(userId: string): void {
    this.disable();
    combineLatest([
      this.candidateUsersForTask$,
      this.taskService.assignTask(this.taskId, {assignee: userId}),
    ])
      .pipe(
        take(1),
        tap(([candidateUsers]) => {
          this.userIdToAssign = userId;
          this.assignedIdOnServer$.next(userId);
          this.assignedUserFullName$.next(this.getAssignedUserName(candidateUsers ?? [], userId));
          this.emitChange();
          this.enable();
        })
      )
      .subscribe();
  }

  public unassignTask(): void {
    this.disable();
    this.taskService
      .unassignTask(this.taskId)
      .pipe(
        tap(() => {
          this.clear();
          this.emitChange();
          this.enable();
        })
      )
      .subscribe();
  }

  public getAssignedUserName(users: NamedUser[], userId: string): string {
    if (users && userId) {
      const findUser = users.find(user => user.id === userId);
      return findUser ? findUser.label : userId;
    }
    return userId || '-';
  }

  public mapUsersForDropdown(users: NamedUser[]): DropdownItem[] {
    return (
      users &&
      users
        .map(user => ({...user, lastName: user.lastName?.split(' ').splice(-1)[0] || ''}))
        .sort((a, b) => a.lastName.localeCompare(b.lastName))
        .map(user => ({text: user.label, id: user.id}))
    );
  }

  private clear(): void {
    this.assignedIdOnServer$.next(null);
    this.userIdToAssign = null;
  }

  private emitChange(): void {
    this.assignmentOfTaskChanged.emit();
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private disable(): void {
    this.disabled$.next(true);
  }
}
