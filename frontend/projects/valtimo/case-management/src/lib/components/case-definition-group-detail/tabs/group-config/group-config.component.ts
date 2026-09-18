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

import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {DialogModule} from 'carbon-components-angular';
import {Add16} from '@carbon/icons';
import {CarbonListModule, SelectItem, SelectModule} from '@valtimo/components';
import {DocumentService, DocumentDefinition} from '@valtimo/document';
import {
  ButtonModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  LayerModule,
  PlaceholderModule,
  TableModule,
} from 'carbon-components-angular';
import {GlobalNotificationService} from '@valtimo/shared';
import {BehaviorSubject, combineLatest, filter, forkJoin, map, startWith, Subscription, switchMap} from 'rxjs';
import {CaseDefinitionGroupManagementService} from '../../../../services';
import {CaseDefinitionGroupWithMembersResponse, GroupMember} from '../../../../models';

interface MemberListItem {
  caseDefinitionKey: string;
  name: string;
  version: string;
  order: number;
}

const COLOR_SWATCHES = [
  '#da1e28', '#ff8389', '#fa4d56', '#ff7eb6', '#ee538b', '#d12771',
  '#6929c4', '#8a3ffc', '#a56eff', '#d4bbff',
  '#0043ce', '#1192e8', '#33b1ff', '#82cfff',
  '#005d5d', '#009d9a', '#3ddbd9',
  '#0e6027', '#24a148', '#42be65',
  '#b28600', '#f1c21b',
  '#570408', '#002d9c',
  '#525252', '#8d8d8d', '#161616',
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
    ReactiveFormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    IconModule,
    InputModule,
    LayerModule,
    PlaceholderModule,
    TableModule,
    CarbonListModule,
    SelectModule,
  ],
})
export class GroupConfigComponent implements OnInit, OnDestroy {
  public readonly COLOR_SWATCHES = COLOR_SWATCHES;

  @ViewChild('addWrapper') addWrapperRef: ElementRef<HTMLElement>;

  private readonly _subscriptions = new Subscription();
  private readonly _group$ = new BehaviorSubject<CaseDefinitionGroupWithMembersResponse | null>(
    null
  );
  public readonly group$ = this._group$.asObservable();

  private readonly _members$ = new BehaviorSubject<MemberListItem[]>([]);
  public readonly members$ = this._members$.asObservable();

  public readonly searchControl = new FormControl('');
  public readonly filteredMembers$ = combineLatest([
    this._members$,
    this.searchControl.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([members, search]) => {
      if (!search) return members;
      const term = search.toLowerCase();
      return members.filter(
        m =>
          m.name.toLowerCase().includes(term) ||
          m.caseDefinitionKey.toLowerCase().includes(term)
      );
    })
  );

  private readonly _availableCaseDefinitions$ = new BehaviorSubject<SelectItem[]>([]);
  public readonly availableCaseDefinitions$ = this._availableCaseDefinitions$.asObservable();

  public selectedColor = '';
  public customColor = '';
  public selectedCaseDefinitionKey: string | null = null;
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
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  @HostListener('document:click', ['$event'])
  public onPageClick(event: MouseEvent): void {
    if (!this.showAddPanel || !this.addWrapperRef) return;

    const target = event.target as HTMLElement;
    const clickedInside = this.addWrapperRef.nativeElement.contains(target);
    const clickedOnDropdown = target.closest('.cds--list-box__menu, .cds--list-box__menu-item');
    if (!clickedInside && !clickedOnDropdown) {
      this.showAddPanel = false;
      this.selectedCaseDefinitionKey = null;
      this.cdr.markForCheck();
    }
  }

  public onColorSwatchClick(color: string): void {
    this.selectedColor = color;
    this.customColor = color;
    this._saveColor(color);
  }

  public onNativeColorChange(event: Event): void {
    const color = (event.target as HTMLInputElement).value;
    this.selectedColor = color;
    this.customColor = color;
    this._saveColor(color);
  }

  public toggleAddPanel(): void {
    this.showAddPanel = !this.showAddPanel;
    if (!this.showAddPanel) {
      this.selectedCaseDefinitionKey = null;
    }
  }

  public onCaseDefinitionSelected(value: string | number): void {
    this.selectedCaseDefinitionKey = value ? String(value) : null;
  }

  public addMember(): void {
    if (!this.selectedCaseDefinitionKey) return;

    const groupKey = this.route.parent?.snapshot.params['groupKey'];
    if (!groupKey) return;

    this.groupService
      .addMember(groupKey, {caseDefinitionKey: this.selectedCaseDefinitionKey})
      .subscribe({
        next: () => {
          this.selectedCaseDefinitionKey = null;
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
          const available: SelectItem[] = definitions.content
            .filter(def => !memberKeys.has(def.id.name))
            .map(def => ({
              id: def.id.name,
              text: def.schema?.title ?? def.id.name,
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
