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

import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {
  ButtonModule,
  ComboBoxModule,
  DialogModule,
  IconModule,
  IconService,
  LayerModule,
  ListItem,
} from 'carbon-components-angular';
import {OverflowMenuComponent} from '@valtimo/components';
import {TranslateModule} from '@ngx-translate/core';
import {Add16, UserFollow16} from '@carbon/icons';
import {BehaviorSubject, catchError, of, Subscription} from 'rxjs';
import {map} from 'rxjs/operators';
import {TeamsApiService, TeamDetailService} from '../../services';

@Component({
  standalone: true,
  selector: 'valtimo-team-detail-add-member',
  templateUrl: './team-detail-add-member-modal.component.html',
  styleUrls: ['./team-detail-add-member-modal.component.scss'],
  imports: [
    CommonModule,
    ButtonModule,
    ComboBoxModule,
    DialogModule,
    IconModule,
    LayerModule,
    TranslateModule,
    OverflowMenuComponent,
  ],
})
export class TeamDetailAddMemberComponent implements OnInit, OnDestroy {
  @Input() public disabled = false;

  public readonly availableUsers$ = new BehaviorSubject<ListItem[]>([]);
  public readonly noUsersAvailable$ = this.availableUsers$.pipe(map(users => users.length === 0));
  public readonly selectedUsername$ = new BehaviorSubject<string | null>(null);
  public readonly saving$ = new BehaviorSubject<boolean>(false);
  public readonly showComboBox$ = new BehaviorSubject<boolean>(true);

  private readonly subscription = new Subscription();

  constructor(
    private readonly teamsApiService: TeamsApiService,
    private readonly teamDetailService: TeamDetailService,
    private readonly iconService: IconService
  ) {
    this.iconService.registerAll([Add16, UserFollow16]);
  }

  public ngOnInit(): void {
    this.fetchCandidateUsers();
  }

  public ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  public onUserSelect(event: ListItem): void {
    if (!event?.id) return;
    this.selectedUsername$.next(event.id as string);
  }

  public onComboBoxClear(): void {
    this.selectedUsername$.next(null);
  }

  public onAddToTeam(): void {
    const username = this.selectedUsername$.getValue();
    if (!username) return;

    this.saving$.next(true);

    this.teamsApiService
      .addTeamUser(this.teamDetailService.teamKey, {username})
      .pipe(
        catchError(() => {
          this.saving$.next(false);
          return of(null);
        })
      )
      .subscribe(result => {
        if (result) {
          this.saving$.next(false);
          this.selectedUsername$.next(null);
          this.resetComboBox();
          this.teamDetailService.reloadMembers();
          this.fetchCandidateUsers();
        }
      });
  }

  public onOpenChange(open?: boolean): void {
    if (open) {
      this.fetchCandidateUsers();
      this.selectedUsername$.next(null);
      this.resetComboBox();
    }
  }

  private fetchCandidateUsers(): void {
    this.subscription.add(
      this.teamsApiService
        .getCandidateUsers(this.teamDetailService.teamKey)
        .pipe(
          map(users =>
            users.map(user => ({
              content: this.getUserLabel(user),
              id: (user as any).username ?? user.id,
              selected: false,
            }))
          )
        )
        .subscribe(items => this.availableUsers$.next(items))
    );
  }

  private getUserLabel(user: any): string {
    const firstName = user.firstName?.trim();
    const lastName = user.lastName?.trim();
    if (firstName && lastName) return `${firstName} ${lastName}`;
    if (firstName) return firstName;
    if (lastName) return lastName;
    if (user.email) return user.email;
    return user.username ?? user.id;
  }

  private resetComboBox(): void {
    this.showComboBox$.next(false);
    setTimeout(() => this.showComboBox$.next(true));
  }
}
