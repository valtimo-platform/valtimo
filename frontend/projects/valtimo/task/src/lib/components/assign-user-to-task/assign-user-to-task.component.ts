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
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import {CdsThemeService, RemoveClassnamesDirective} from '@valtimo/components';
import {BehaviorSubject, combineLatest, Observable, Subject, Subscription, take, tap} from 'rxjs';
import {TaskService} from '../../services';
import {NamedUser, UserIdentity} from '@valtimo/shared';
import {CommonModule} from '@angular/common';
import {TranslateModule} from '@ngx-translate/core';
import {
  ButtonModule,
  ComboBoxModule,
  IconModule,
  IconService,
  LayerModule,
  ListItem,
  ToggletipModule,
} from 'carbon-components-angular';
import {Edit16, UserFollow16, UserRole16} from '@carbon/icons';
import {filter, map} from 'rxjs/operators';
import {UserProviderService} from '@valtimo/security';

@Component({
  selector: 'valtimo-assign-user-to-task',
  templateUrl: './assign-user-to-task.component.html',
  styleUrls: ['./assign-user-to-task.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ButtonModule,
    ToggletipModule,
    IconModule,
    LayerModule,
    ComboBoxModule,
    RemoveClassnamesDirective,
  ],
})
export class AssignUserToTaskComponent implements OnInit, OnChanges, OnDestroy {
  private _taskId: string;

  @Input() public set taskId(value: string) {
    if (this._taskId === value) return;
    this._taskId = value;
    this.fetchCandidateUsers(value);
  }

  @Input() public readonly assigneeId: string;
  @Output() public readonly assignmentOfTaskChanged = new EventEmitter();

  public readonly canAssignUserToTaskSet$ = new BehaviorSubject<boolean>(false);
  public readonly canAssignUserToTask$ = new BehaviorSubject<boolean>(false);

  @Input() public set canAssignUserToTask(value: boolean) {
    this.canAssignUserToTaskSet$.next(true);
    this.canAssignUserToTask$.next(value);
  }

  public readonly assignedIdOnServer$ = new BehaviorSubject<string | null>(null);
  private readonly _assignedUserFullName$ = new BehaviorSubject<string | null>(null);
  public readonly assignedUserFullName$: Observable<string> = this._assignedUserFullName$.pipe(
    map(fullName => `${fullName?.trim()}`)
  );

  private readonly _candidateUsersForTask$ = new BehaviorSubject<NamedUser[] | undefined>(
    undefined
  );
  private readonly _selectedUserId$ = new BehaviorSubject<string | null>(null);
  public readonly selectedUserId$ = this._selectedUserId$.asObservable();

  public readonly candidateUsersForTask$ = this._candidateUsersForTask$.pipe(
    map(users => this.mapUsersForDropdown(users))
  );

  public readonly editCandidateUsersForTask$ = combineLatest([
    this._candidateUsersForTask$,
    this.assignedIdOnServer$,
  ]).pipe(map(([users, assignedId]) => this.mapUsersForDropdown(users, assignedId)));

  public readonly toggletipView$ = new BehaviorSubject<'choice' | 'dropdown'>('choice');
  public readonly editToggletipOpen$ = new BehaviorSubject<boolean>(false);
  public readonly mouseIsOverAssignee$ = new BehaviorSubject<boolean>(false);
  public readonly showComboBox$ = new BehaviorSubject<boolean>(true);
  public readonly open$ = new Subject<boolean>();
  public readonly disabled$ = new BehaviorSubject<boolean>(true);
  public readonly toggletipTheme$ = this.cdsThemeService.toggletipTheme$;
  public readonly toggletipDropdownTheme$ = this.cdsThemeService.toggletipDropdownTheme$;

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly taskService: TaskService,
    private readonly cdsThemeService: CdsThemeService,
    private readonly iconService: IconService,
    private readonly elementRef: ElementRef,
    private readonly renderer2: Renderer2,
    private readonly userProviderService: UserProviderService
  ) {
    this.iconService.registerAll([UserFollow16, UserRole16, Edit16]);
  }

  public ngOnInit(): void {
    this.openHideElementSubscription();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    this._candidateUsersForTask$.pipe(take(1)).subscribe(candidateUsers => {
      const currentUserId = changes.assigneeId?.currentValue || this.assigneeId;
      const resolvedId = candidateUsers?.length
        ? this.resolveUserId(candidateUsers, currentUserId)
        : currentUserId;
      this.assignedIdOnServer$.next(resolvedId || null);
      this._selectedUserId$.next(resolvedId || null);
      this._assignedUserFullName$.next(
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
      this._candidateUsersForTask$,
      this.taskService.assignTask(this._taskId, {assignee: userId}),
    ])
      .pipe(take(1))
      .subscribe({
        next: ([candidateUsers]) => {
          this._selectedUserId$.next(userId);
          this.assignedIdOnServer$.next(userId);
          this._assignedUserFullName$.next(this.getAssignedUserName(candidateUsers ?? [], userId));
          this.closeToggletip();
          this.emitChange();
          this.enable();
        },
        error: () => {
          this.enable();
        },
      });
  }

  public unassignTask(): void {
    this.disable();
    this.taskService
      .unassignTask(this._taskId)
      .pipe(
        tap(() => {
          this.closeToggletip();
          this.emitChange();
          this.enable();
          this.resetState();
        })
      )
      .subscribe();
  }

  public getAssignedUserName(users: NamedUser[], userId: string): string {
    if (users && userId) {
      const findUser = this.findUserByIdOrUsername(users, userId);
      return findUser ? findUser.label : userId;
    }
    return userId || '-';
  }

  public onMouseEnterAssignee(): void {
    this.mouseIsOverAssignee$.next(true);
  }

  public onMouseLeaveAssignee(): void {
    this.mouseIsOverAssignee$.next(false);
  }

  public onSubmitButtonClick(): void {
    this.assignTask(this._selectedUserId$.getValue());
  }

  public onUserSelect(event: ListItem): void {
    if (!event?.id) return;
    this._selectedUserId$.next(event.id);
  }

  public onComboBoxClear(): void {
    this._selectedUserId$.next(null);
  }

  public onAssignToMe(): void {
    this.userProviderService
      .getUserSubject()
      .pipe(take(1))
      .subscribe((currentUser: UserIdentity) => {
        if (currentUser?.id) {
          this.assignTask(currentUser.id);
        }
      });
  }

  public onAssignToOtherUser(): void {
    this.toggletipView$.next('dropdown');
    this._selectedUserId$.next(null);
  }

  public onOpenAssignToggletip(): void {
    this.toggletipView$.next('choice');
    this._selectedUserId$.next(null);
  }

  public onOpenEditToggletip(): void {
    this.editToggletipOpen$.next(true);
    this._selectedUserId$.next(null);
    this.resetComboBox();
  }

  public onCloseEditToggletip(): void {
    this.editToggletipOpen$.next(false);
  }

  public resetState(): void {
    this.assignedIdOnServer$.next(null);
    this._selectedUserId$.next(null);
    this._assignedUserFullName$.next(null);
    this.toggletipView$.next('choice');
  }

  private findUserByIdOrUsername(users: NamedUser[], identifier: string): NamedUser | undefined {
    return (
      users.find(user => user.id === identifier) || users.find(user => user.userName === identifier)
    );
  }

  private resolveUserId(users: NamedUser[], identifier: string): string {
    const user = this.findUserByIdOrUsername(users, identifier);
    return user ? user.id : identifier;
  }

  private mapUsersForDropdown(users: NamedUser[], selectedUserId?: string): ListItem[] {
    if (!users) return [];

    return this.sortUsersWithCurrentUserFirst(users).map(user => ({
      content: user.label,
      id: user.id,
      selected: selectedUserId ? user.id === selectedUserId : false,
    }));
  }

  private sortUsersWithCurrentUserFirst(users: NamedUser[]): NamedUser[] {
    let currentUserId: string | null = null;

    this.userProviderService
      .getUserSubject()
      .pipe(take(1))
      .subscribe((user: UserIdentity) => {
        currentUserId = user?.id || null;
      });

    return users
      .map(user => ({...user, lastName: user.lastName?.split(' ').splice(-1)[0] || ''}))
      .sort((a, b) => {
        if (currentUserId) {
          if (a.id === currentUserId) return -1;
          if (b.id === currentUserId) return 1;
        }
        return a.lastName.localeCompare(b.lastName);
      });
  }

  private resetComboBox(): void {
    this.showComboBox$.next(false);
    setTimeout(() => this.showComboBox$.next(true));
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

  private closeToggletip(): void {
    this.editToggletipOpen$.next(false);
    this.open$.next(true);
    setTimeout(() => this.open$.next(false));
  }

  private fetchCandidateUsers(taskId: string): void {
    this.disable();

    this.canAssignUserToTask$
      .pipe(
        filter(allowed => !!allowed),
        take(1)
      )
      .subscribe(() => {
        this.taskService.getCandidateUsers(taskId).subscribe(candidateUsers => {
          this._candidateUsersForTask$.next(candidateUsers);
          if (this.assigneeId) {
            const resolvedId = this.resolveUserId(candidateUsers, this.assigneeId);
            this.assignedIdOnServer$.next(resolvedId);
            this._selectedUserId$.next(resolvedId);
            this._assignedUserFullName$.next(
              this.getAssignedUserName(candidateUsers, this.assigneeId)
            );
          }
          this.enable();
        });
      });
  }

  private openHideElementSubscription(): void {
    this._subscriptions.add(
      combineLatest([this.assignedIdOnServer$, this.canAssignUserToTask$]).subscribe(
        ([idOnServer, canAssignUserToTask]) => {
          if (!canAssignUserToTask && idOnServer === null) {
            this.renderer2.setStyle(this.elementRef.nativeElement, 'display', 'none');
          } else {
            this.renderer2.removeStyle(this.elementRef.nativeElement, 'display');
          }
        }
      )
    );
  }
}
