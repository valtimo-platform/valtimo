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
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {CommonModule} from '@angular/common';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {
  ButtonModule,
  ComboBoxModule,
  IconModule,
  IconService,
  LayerModule,
  ListItem,
  ToggletipModule,
} from 'carbon-components-angular';
import {Group16, User16, UserFollow16} from '@carbon/icons';
import {BehaviorSubject, combineLatest, Observable, of, Subject, Subscription, take} from 'rxjs';
import {NamedUser, TeamResponseDto, UserIdentity} from '@valtimo/shared';
import {UserProviderService} from '@valtimo/security';
import {CdsThemeService} from '../../services/cds-theme.service';
import {RemoveClassnamesDirective} from '../../directives/remove-classnames/remove-classnames.directive';

export type AssignmentMode = 'case' | 'task';

export interface AssignmentChangeEvent {
  /** The user ID to assign. `null` means explicitly unassign the user. `undefined` means no change. */
  userId?: string | null;
  /** The team key to assign. `null` means explicitly unassign the team. `undefined` means no change. */
  teamKey?: string | null;
}

@Component({
  selector: 'valtimo-assignment',
  templateUrl: './assignment.component.html',
  styleUrls: ['./assignment.component.scss'],
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
export class AssignmentComponent implements OnInit, OnChanges, OnDestroy {
  @Input() mode: AssignmentMode = 'case';
  @Input() hasPermission = true;

  @Input() set assigneeId(value: string) {
    this._assigneeId = value || null;
  }

  @Input() set assigneeFullName(value: string) {
    this._assigneeFullName = value || null;
  }

  @Input() set assignedTeamKey(value: string) {
    this._assignedTeamKey = value || null;
  }

  @Input() set assignedTeamTitle(value: string) {
    this._assignedTeamTitle = value || null;
  }

  @Input() candidateUsers$: Observable<NamedUser[]>;
  @Input() candidateTeams$: Observable<TeamResponseDto[]>;

  @Output() readonly assignmentChanged = new EventEmitter<AssignmentChangeEvent>();
  @Output() readonly unassigned = new EventEmitter<void>();

  public _assigneeId: string | null = null;
  public _assigneeFullName: string | null = null;
  public _assignedTeamKey: string | null = null;
  public _assignedTeamTitle: string | null = null;

  public readonly userItems$ = new BehaviorSubject<ListItem[]>([]);
  public readonly teamItems$ = new BehaviorSubject<ListItem[]>([]);
  public readonly selectedUserId$ = new BehaviorSubject<string | null>(null);
  public readonly selectedTeamKey$ = new BehaviorSubject<string | null>(null);
  private initialUserId: string | null = null;
  private initialTeamKey: string | null = null;
  public readonly mouseIsOver$ = new BehaviorSubject<boolean>(false);
  public readonly editToggletipOpen$ = new BehaviorSubject<boolean>(false);
  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly open$ = new Subject<boolean>();
  public readonly showUserComboBox$ = new BehaviorSubject<boolean>(true);
  public readonly showTeamComboBox$ = new BehaviorSubject<boolean>(true);
  public readonly toggletipTheme$ = this.cdsThemeService.toggletipTheme$;
  public readonly toggletipDropdownTheme$ = this.cdsThemeService.toggletipDropdownTheme$;

  private readonly _subscriptions = new Subscription();

  get isAssigned(): boolean {
    return !!this._assigneeId || !!this._assignedTeamKey;
  }

  get assignButtonTranslationKey(): string {
    return this.mode === 'case' ? 'assignment.assignThisCase' : 'assignment.assignThisTask';
  }

  get hasEditChanges(): boolean {
    return (
      this.selectedUserId$.getValue() !== this.initialUserId ||
      this.selectedTeamKey$.getValue() !== this.initialTeamKey
    );
  }

  private currentUser: UserIdentity | null = null;

  constructor(
    private readonly cdsThemeService: CdsThemeService,
    private readonly iconService: IconService,
    private readonly userProviderService: UserProviderService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([UserFollow16, Group16, User16]);
    this._subscriptions.add(
      this.userProviderService.getUserSubject().subscribe(user => {
        this.currentUser = user;
      })
    );
  }

  public ngOnInit(): void {
    this.loadCandidates();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.candidateUsers$ || changes.candidateTeams$) {
      this.loadCandidates();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onMouseEnter(): void {
    this.mouseIsOver$.next(true);
  }

  public onMouseLeave(): void {
    this.mouseIsOver$.next(false);
  }

  public onUserSelect(event: ListItem): void {
    this.selectedUserId$.next(event?.id || null);
  }

  public onUserClear(): void {
    this.selectedUserId$.next(null);
  }

  public onTeamSelect(event: ListItem): void {
    this.selectedTeamKey$.next(event?.id || null);
  }

  public onTeamClear(): void {
    this.selectedTeamKey$.next(null);
  }

  public onConfirm(): void {
    const userId = this.selectedUserId$.getValue();
    const teamKey = this.selectedTeamKey$.getValue();
    this.disable();
    this.assignmentChanged.emit({userId: userId || undefined, teamKey: teamKey || undefined});
    this.closeToggletip();
    this.enable();
  }

  public onUpdate(): void {
    const userId = this.selectedUserId$.getValue();
    const teamKey = this.selectedTeamKey$.getValue();
    const event: AssignmentChangeEvent = {};

    if (userId !== this.initialUserId) {
      event.userId = userId ?? null;
    }
    if (teamKey !== this.initialTeamKey) {
      event.teamKey = teamKey ?? null;
    }

    this.disable();
    this.assignmentChanged.emit(event);
    this.closeToggletip();
    this.enable();
  }

  public onUnassign(): void {
    this.disable();
    this.unassigned.emit();
    this.closeToggletip();
    this.enable();
  }

  public onOpenAssignToggletip(): void {
    this.selectedUserId$.next(null);
    this.selectedTeamKey$.next(null);
    this.resetComboBoxes();
  }

  public onOpenEditToggletip(): void {
    this.editToggletipOpen$.next(true);
    this.selectedUserId$.next(this._assigneeId);
    this.selectedTeamKey$.next(this._assignedTeamKey);
    this.initialTeamKey = this._assignedTeamKey;
    this.loadCandidatesForEdit();
  }

  public onCloseEditToggletip(): void {
    this.editToggletipOpen$.next(false);
  }

  private loadCandidates(): void {
    this.loading$.next(true);

    if (this.candidateUsers$) {
      this._subscriptions.add(
        combineLatest([this.candidateUsers$, this.translateService.stream('key')]).subscribe(
          ([users]) => {
            this.userItems$.next(this.mapUsersForDropdown(users));
            this.loading$.next(false);
          }
        )
      );
    } else {
      this.loading$.next(false);
    }

    if (this.candidateTeams$) {
      this._subscriptions.add(
        this.candidateTeams$.subscribe(teams => {
          this.teamItems$.next(this.mapTeamsForDropdown(teams));
        })
      );
    }
  }

  private loadCandidatesForEdit(): void {
    const users$ = this.candidateUsers$
      ? this.candidateUsers$.pipe(take(1))
      : of([] as NamedUser[]);
    const teams$ = this.candidateTeams$
      ? this.candidateTeams$.pipe(take(1))
      : of([] as TeamResponseDto[]);

    this._subscriptions.add(
      combineLatest([users$, teams$]).subscribe(([users, teams]) => {
        // Resolve assigneeId to UUID if it's a username
        if (this._assigneeId && users?.length) {
          const match = users.find(
            u => u.id === this._assigneeId || u.userName === this._assigneeId
          );
          if (match) {
            this.selectedUserId$.next(match.id);
          }
        }

        this.initialUserId = this.selectedUserId$.getValue();
        this.userItems$.next(this.mapUsersForDropdown(users, this._assigneeId));
        this.teamItems$.next(this.mapTeamsForDropdown(teams, this._assignedTeamKey));
        this.resetComboBoxes();
      })
    );
  }

  private isCurrentUser(user: NamedUser): boolean {
    if (!this.currentUser) return false;
    return (
      (!!this.currentUser.id &&
        (user.id === this.currentUser.id || user.userName === this.currentUser.id)) ||
      (!!this.currentUser.username &&
        (user.id === this.currentUser.username || user.userName === this.currentUser.username))
    );
  }

  private mapUsersForDropdown(users: NamedUser[], selectedUserId?: string): ListItem[] {
    if (!users) return [];

    const meSuffix = ` (${this.translateService.instant('assignment.me')})`;

    return users
      .sort((a, b) => {
        const aIsMe = this.isCurrentUser(a);
        const bIsMe = this.isCurrentUser(b);
        if (aIsMe && !bIsMe) return -1;
        if (!aIsMe && bIsMe) return 1;
        if (a.lastName && b.lastName) {
          return a.lastName.localeCompare(b.lastName);
        }
        return 0;
      })
      .map(user => ({
        content: this.isCurrentUser(user) ? `${user.label}${meSuffix}` : user.label,
        id: user.id,
        selected: selectedUserId
          ? user.id === selectedUserId || user.userName === selectedUserId
          : false,
      }));
  }

  private mapTeamsForDropdown(teams: TeamResponseDto[], selectedTeamKey?: string): ListItem[] {
    if (!teams) return [];

    return teams
      .sort((a, b) => a.title.localeCompare(b.title))
      .map(team => ({
        content: team.title,
        id: team.key,
        selected: selectedTeamKey ? team.key === selectedTeamKey : false,
      }));
  }

  private resetComboBoxes(): void {
    this.showUserComboBox$.next(false);
    this.showTeamComboBox$.next(false);
    setTimeout(() => {
      this.showUserComboBox$.next(true);
      this.showTeamComboBox$.next(true);
    });
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
}
