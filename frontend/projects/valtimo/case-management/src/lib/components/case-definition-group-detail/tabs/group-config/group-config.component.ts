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

import {ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {FormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {DialogModule} from 'carbon-components-angular';
import {Add16} from '@carbon/icons';
import {CarbonListModule, ColumnConfig} from '@valtimo/components';
import {DocumentService, DocumentDefinition} from '@valtimo/document';
import {
  ButtonModule,
  ComboBoxModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  PlaceholderModule,
} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, filter, forkJoin, map, Subscription, switchMap} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../../../services';
import {CaseDefinitionGroupWithMembersResponse, GroupMember} from '../../../../models';

interface MemberListItem {
  caseDefinitionKey: string;
  name: string;
  version: string;
  order: number;
}

interface CaseDefinitionOption {
  key: string;
  name: string;
  content: string;
}

const COLOR_SWATCHES = [
  '#0043ce',
  '#6929c4',
  '#9f1853',
  '#fa4d56',
  '#ff832b',
  '#f1c21b',
  '#198038',
  '#009d9a',
  '#1192e8',
  '#002d9c',
];

@Component({
  standalone: true,
  selector: 'valtimo-group-config',
  templateUrl: './group-config.component.html',
  styleUrl: './group-config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    ButtonModule,
    ComboBoxModule,
    DialogModule,
    DropdownModule,
    IconModule,
    InputModule,
    LayerModule,
    PlaceholderModule,
    CarbonListModule,
  ],
})
export class GroupConfigComponent implements OnInit, OnDestroy {
  public readonly COLOR_SWATCHES = COLOR_SWATCHES;

  private readonly _subscriptions = new Subscription();
  private readonly _group$ = new BehaviorSubject<CaseDefinitionGroupWithMembersResponse | null>(
    null
  );
  public readonly group$ = this._group$.asObservable();

  private readonly _members$ = new BehaviorSubject<MemberListItem[]>([]);
  public readonly members$ = this._members$.asObservable();

  private readonly _availableCaseDefinitions$ = new BehaviorSubject<CaseDefinitionOption[]>([]);
  public readonly availableCaseDefinitions$ = this._availableCaseDefinitions$.asObservable();
  public comboBoxItems: CaseDefinitionOption[] = [];

  public selectedColor = '';
  public customColor = '';
  public selectedCaseDefinition: CaseDefinitionOption | null = null;
  public showAddPanel = false;

  public readonly groupKey$ = this.route.parent?.params.pipe(
    map(params => params['groupKey'] as string)
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly groupService: CaseDefinitionGroupManagementService,
    private readonly documentService: DocumentService,
    private readonly translateService: TranslateService,
    private readonly notificationService: GlobalNotificationService,
    private readonly iconService: IconService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.iconService.registerAll([Add16]);
  }

  public ngOnInit(): void {
    this._loadGroupAndMembers();
    this._loadAvailableCaseDefinitions();
    this._subscriptions.add(
      this.availableCaseDefinitions$.subscribe(items => {
        setTimeout(() => {
          this.comboBoxItems = items;
          this.cdr.markForCheck();
        }, 100);
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public onColorSwatchClick(color: string): void {
    this.selectedColor = color;
    this.customColor = color;
    this._saveColor(color);
  }

  public onCustomColorChange(color: string): void {
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      this.selectedColor = color;
      this._saveColor(color);
    }
  }

  public toggleAddPanel(): void {
    this.showAddPanel = !this.showAddPanel;
    if (!this.showAddPanel) {
      this.selectedCaseDefinition = null;
    }
  }

  public addMember(): void {
    if (!this.selectedCaseDefinition) return;

    const groupKey = this.route.parent?.snapshot.params['groupKey'];
    if (!groupKey) return;

    this.groupService
      .addMember(groupKey, {caseDefinitionKey: this.selectedCaseDefinition.key})
      .subscribe({
        next: () => {
          this.selectedCaseDefinition = null;
          this.showAddPanel = false;
          this._loadGroupAndMembers();
          this._loadAvailableCaseDefinitions();
        },
        error: () => {
          this.notificationService.showToast({
            type: 'error',
            title: this.translateService.instant('caseManagement.groups.config.addMemberError'),
          });
        },
      });
  }

  public removeMember(member: MemberListItem): void {
    const groupKey = this.route.parent?.snapshot.params['groupKey'];
    if (!groupKey) return;

    this.groupService.removeMember(groupKey, member.caseDefinitionKey).subscribe({
      next: () => {
        this._loadGroupAndMembers();
        this._loadAvailableCaseDefinitions();
      },
    });
  }

  private _loadGroupAndMembers(): void {
    this._subscriptions.add(
      this.groupKey$
        ?.pipe(
          filter(key => !!key),
          switchMap(key => this.groupService.getGroup(key))
        )
        .subscribe(group => {
          this._group$.next(group);
          this.selectedColor = group.color ?? '';
          this.customColor = group.color ?? '';
          this._loadMemberDetails(group.members);
        })
    );
  }

  private _loadMemberDetails(members: GroupMember[]): void {
    if (members.length === 0) {
      this._members$.next([]);
      return;
    }

    forkJoin(
      members.map(m =>
        this.documentService.getDocumentDefinitionForManagement(m.caseDefinitionKey).pipe(
          map(def => ({
            caseDefinitionKey: m.caseDefinitionKey,
            name: def.schema?.title ?? m.caseDefinitionKey,
            version: def.id?.blueprintId?.blueprintVersionTag ?? '-',
            order: m.order,
          }))
        )
      )
    ).subscribe(memberItems => {
      this._members$.next(memberItems.sort((a, b) => a.order - b.order));
    });
  }

  private _loadAvailableCaseDefinitions(): void {
    this._subscriptions.add(
      combineLatest([this.documentService.getAllDefinitions(), this._members$]).subscribe(
        ([definitions, members]) => {
          const memberKeys = new Set(members.map(m => m.caseDefinitionKey));
          const available = definitions.content
            .filter(def => !memberKeys.has(def.id.name))
            .map(def => ({
              key: def.id.name,
              name: def.schema?.title ?? def.id.name,
              content: def.schema?.title ?? def.id.name,
            }));
          this._availableCaseDefinitions$.next(available);
        }
      )
    );
  }

  private _saveColor(color: string): void {
    const group = this._group$.value;
    if (!group) return;

    this.groupService
      .updateGroup(group.key, {
        title: group.title,
        description: group.description,
        color,
      })
      .subscribe();
  }
}
