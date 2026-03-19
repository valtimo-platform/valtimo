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
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  HostBinding,
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
import {AssignmentChangeEvent, AssignmentMode} from '../../models/assignment.model';

@Component({
  selector: 'valtimo-assignment',
  templateUrl: './assignment.component.html',
  styleUrls: ['./assignment.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  @HostBinding('style.display')
  public get hostDisplay(): string | null {
    return !this.hasPermission && !this.isAssigned ? 'none' : null;
  }

  @Input() public mode: AssignmentMode = 'case';
  @Input() public hasPermission = true;

  @Input() public set assigneeId(value: string) {
    this._assigneeId = value || null;
  }

  @Input() public set assigneeFullName(value: string) {
    this._assigneeFullName = value || null;
  }

  @Input() public set assignedTeamKey(value: string) {
    this._assignedTeamKey = value || null;
  }

  @Input() public set assignedTeamTitle(value: string) {
    this._assignedTeamTitle = value || null;
  }

  @Input() public candidateUsers$: Observable<NamedUser[]>;
  @Input() public candidateTeams$: Observable<TeamResponseDto[]>;

  @Output() public readonly assignmentChangedEvent = new EventEmitter<AssignmentChangeEvent>();
  @Output() public readonly unassignedEvent = new EventEmitter<void>();

  public _assigneeId: string | null = null;
  public _assigneeFullName: string | null = null;
  public _assignedTeamKey: string | null = null;
  public _assignedTeamTitle: string | null = null;

  public readonly disabled$ = new BehaviorSubject<boolean>(false);
  public readonly editToggletipOpen$ = new BehaviorSubject<boolean>(false);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  public readonly mouseIsOver$ = new BehaviorSubject<boolean>(false);
  public readonly open$ = new Subject<boolean>();
  public readonly selectedTeamKey$ = new BehaviorSubject<string | null>(null);
  public readonly selectedUserId$ = new BehaviorSubject<string | null>(null);
  public readonly showTeamComboBox$ = new BehaviorSubject<boolean>(true);
  public readonly showUserComboBox$ = new BehaviorSubject<boolean>(true);
  public readonly teamItems$ = new BehaviorSubject<ListItem[]>([]);
  public readonly toggletipDropdownTheme$ = this._cdsThemeService.toggletipDropdownTheme$;
  public readonly toggletipTheme$ = this._cdsThemeService.toggletipTheme$;
  public readonly userItems$ = new BehaviorSubject<ListItem[]>([]);

  private _currentUser: UserIdentity | null = null;
  private _initialTeamKey: string | null = null;
  private _initialUserId: string | null = null;

  private readonly _subscriptions = new Subscription();

  public get assignButtonTranslationKey(): string {
    return this.mode === 'case' ? 'assignment.assignThisCase' : 'assignment.assignThisTask';
  }

  public get hasEditChanges(): boolean {
    return (
      this.selectedUserId$.getValue() !== this._initialUserId ||
      this.selectedTeamKey$.getValue() !== this._initialTeamKey
    );
  }

  public get isAssigned(): boolean {
    return !!this._assigneeId || !!this._assignedTeamKey;
  }

  constructor(
    private readonly _cdsThemeService: CdsThemeService,
    private readonly _iconService: IconService,
    private readonly _translateService: TranslateService,
    private readonly _userProviderService: UserProviderService
  ) {
    this._iconService.registerAll([UserFollow16, Group16, User16]);
    this._subscriptions.add(
      this._userProviderService.getUserSubject().subscribe(user => {
        this._currentUser = user;
      })
    );
  }

  public ngOnInit(): void {
    if (this.hasPermission) {
      this.loadCandidates();
    }
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.hasPermission && this.hasPermission) {
      this.loadCandidates();
    } else if (this.hasPermission && (changes.candidateUsers$ || changes.candidateTeams$)) {
      this.loadCandidates();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onConfirm(): void {
    const userId = this.selectedUserId$.getValue();
    const teamKey = this.selectedTeamKey$.getValue();
    this.disable();
    this.assignmentChangedEvent.emit({userId: userId || undefined, teamKey: teamKey || undefined});
    this.closeToggletip();
    this.enable();
  }

  public onCloseEditToggletip(): void {
    this.editToggletipOpen$.next(false);
  }

  public onMouseEnter(): void {
    this.mouseIsOver$.next(true);
  }

  public onMouseLeave(): void {
    this.mouseIsOver$.next(false);
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
    this._initialTeamKey = this._assignedTeamKey;
    this.loadCandidatesForEdit();
  }

  public onTeamClear(): void {
    this.selectedTeamKey$.next(null);
  }

  public onTeamSelect(event: ListItem): void {
    this.selectedTeamKey$.next(event?.id || null);
  }

  public onUnassign(): void {
    this.disable();
    this.unassignedEvent.emit();
    this.closeToggletip();
    this.enable();
  }

  public onUpdate(): void {
    const userId = this.selectedUserId$.getValue();
    const teamKey = this.selectedTeamKey$.getValue();
    const event: AssignmentChangeEvent = {};

    if (userId !== this._initialUserId) {
      event.userId = userId ?? null;
    }
    if (teamKey !== this._initialTeamKey) {
      event.teamKey = teamKey ?? null;
    }

    this.disable();
    this.assignmentChangedEvent.emit(event);
    this.closeToggletip();
    this.enable();
  }

  public onUserClear(): void {
    this.selectedUserId$.next(null);
  }

  public onUserSelect(event: ListItem): void {
    this.selectedUserId$.next(event?.id || null);
  }

  private closeToggletip(): void {
    this.editToggletipOpen$.next(false);
    this.open$.next(true);
    setTimeout(() => this.open$.next(false));
  }

  private disable(): void {
    this.disabled$.next(true);
  }

  private enable(): void {
    this.disabled$.next(false);
  }

  private isCurrentUser(user: NamedUser): boolean {
    if (!this._currentUser) return false;
    return (
      (!!this._currentUser.id &&
        (user.id === this._currentUser.id || user.userName === this._currentUser.id)) ||
      (!!this._currentUser.username &&
        (user.id === this._currentUser.username || user.userName === this._currentUser.username))
    );
  }

  private loadCandidates(): void {
    this.loading$.next(true);

    if (this.candidateUsers$) {
      this._subscriptions.add(
        combineLatest([this.candidateUsers$, this._translateService.stream('key')]).subscribe(
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
        if (this._assigneeId && users?.length) {
          const match = users.find(
            u => u.id === this._assigneeId || u.userName === this._assigneeId
          );
          if (match) {
            this.selectedUserId$.next(match.id);
          }
        }

        this._initialUserId = this.selectedUserId$.getValue();
        this.userItems$.next(this.mapUsersForDropdown(users, this._assigneeId));
        this.teamItems$.next(this.mapTeamsForDropdown(teams, this._assignedTeamKey));
        this.resetComboBoxes();
      })
    );
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

  private mapUsersForDropdown(users: NamedUser[], selectedUserId?: string): ListItem[] {
    if (!users) return [];

    const meSuffix = ` (${this._translateService.instant('assignment.me')})`;

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

  private resetComboBoxes(): void {
    this.showUserComboBox$.next(false);
    this.showTeamComboBox$.next(false);
    setTimeout(() => {
      this.showUserComboBox$.next(true);
      this.showTeamComboBox$.next(true);
    });
  }
}
