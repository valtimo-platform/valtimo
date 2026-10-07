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

import {ChevronRight16, Pin16, PinFilled16} from '@carbon/icons';
import {CommonModule} from '@angular/common';
import {ChangeDetectionStrategy, Component, computed, Signal, signal} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {RouterModule} from '@angular/router';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {CaseDefinition, CaseDefinitionGroup, DocumentService} from '@valtimo/document';
import {GlobalNotificationService} from '@valtimo/shared';
import {CASE_OVERVIEW_TEST_IDS} from '../../constants';
import {PinnedItemType} from '../../models';
import {PinnedItemsService} from '../../services';
import {
  IconModule,
  IconService,
  Notification,
  NotificationContent,
  NotificationModule,
  SearchModule,
  TilesModule,
} from 'carbon-components-angular';
import {catchError, map, Observable, of, shareReplay, switchMap} from 'rxjs';

const PIN_INFO_DISMISSED_KEY = 'caseOverviewPinInfoDismissed';

@Component({
  templateUrl: './case-overview.component.html',
  styleUrls: ['./case-overview.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    IconModule,
    NotificationModule,
    RouterModule,
    SearchModule,
    TilesModule,
    TranslateModule,
  ],
})
export class CaseOverviewComponent {
  public readonly PINNED_ITEM_TYPE = PinnedItemType;

  protected readonly testIds = CASE_OVERVIEW_TEST_IDS;

  public readonly $searchQuery = signal<string>('');
  public readonly $pinInfoVisible = signal<boolean>(!this.isPinInfoDismissed());

  private _pinToast: Notification | null = null;

  // Reloaded when the set of pinned items changes; sorting happens in the signals below.
  public readonly caseDefinitionGroups$: Observable<CaseDefinitionGroup[]> =
    this.pinnedItemsService.pinnedItemKeys$.pipe(
      switchMap(() => this.documentService.getCaseDefinitionGroups()),
      catchError(() => of([])),
      shareReplay(1)
    );

  // The same endpoint the Cases menu used for its case list items.
  public readonly caseTypes$: Observable<CaseDefinition[]> =
    this.pinnedItemsService.pinnedItemKeys$.pipe(
      switchMap(() => this.documentService.getCaseDefinitions({active: true})),
      catchError(() => of([])),
      shareReplay(1)
    );

  // Null while the groups are still loading, so the section only appears once they are in.
  private readonly _$caseDefinitionGroups: Signal<CaseDefinitionGroup[] | null> = toSignal(
    this.caseDefinitionGroups$,
    {initialValue: null}
  );

  public readonly $filteredGroups: Signal<CaseDefinitionGroup[] | null> = computed(() => {
    const loadedGroups = this._$caseDefinitionGroups();
    const query = this.$searchQuery().trim().toLowerCase();

    if (!loadedGroups) return null;

    const groups = this.sortPinnedFirst(
      loadedGroups,
      PinnedItemType.CASE_DEFINITION_GROUP,
      group => group.key,
      group => group.title
    );

    if (!query) return groups;

    return groups.filter(
      group =>
        group.title?.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query)
    );
  });

  private readonly _$caseTypes: Signal<CaseDefinition[] | null> = toSignal(this.caseTypes$, {
    initialValue: null,
  });

  private readonly _$pinnedItems = toSignal(this.pinnedItemsService.pinnedItems$, {
    initialValue: [],
  });

  public readonly $filteredCaseTypes: Signal<CaseDefinition[] | null> = computed(() => {
    const loadedCaseTypes = this._$caseTypes();
    const query = this.$searchQuery().trim().toLowerCase();

    if (!loadedCaseTypes) return null;

    const caseTypes = this.sortPinnedFirst(
      loadedCaseTypes,
      PinnedItemType.CASE_DEFINITION,
      caseType => caseType.caseDefinitionKey,
      caseType => caseType.name
    );

    if (!query) return caseTypes;

    return caseTypes.filter(caseType => caseType.name?.toLowerCase().includes(query));
  });

  // `type:key`, so a group and a case type sharing a key stay distinct.
  private readonly _$pinnedKeys: Signal<Set<string>> = computed(
    () => new Set(this._$pinnedItems().map(item => `${item.itemType}:${item.itemKey}`))
  );

  public readonly pinInfoNotification$: Observable<NotificationContent> = this.translateService
    .stream('key')
    .pipe(
      map(() => ({
        type: 'info',
        lowContrast: true,
        title: this.translateService.instant('case.overview.pinInfo.title'),
        message: this.translateService.instant('case.overview.pinInfo.message'),
        showClose: true,
      }))
    );

  constructor(
    private readonly documentService: DocumentService,
    private readonly iconService: IconService,
    private readonly globalNotificationService: GlobalNotificationService,
    private readonly pinnedItemsService: PinnedItemsService,
    private readonly translateService: TranslateService
  ) {
    this.iconService.registerAll([ChevronRight16, Pin16, PinFilled16]);
  }

  public onSearch(query: string): void {
    this.$searchQuery.set(query ?? '');
  }

  public onPinInfoClose(): void {
    this.$pinInfoVisible.set(false);

    try {
      localStorage.setItem(PIN_INFO_DISMISSED_KEY, 'true');
    } catch {
      // Storage blocked: tip returns on next load.
    }
  }

  public isPinned(itemType: PinnedItemType, itemKey: string): boolean {
    return this._$pinnedKeys().has(`${itemType}:${itemKey}`);
  }

  public onTogglePin(itemType: PinnedItemType, itemKey: string, name: string): void {
    const pinning = !this.isPinned(itemType, itemKey);

    this.pinnedItemsService.togglePinnedItem(itemType, itemKey);

    // One pin toast at a time: replace the previous one.
    if (this._pinToast && !this._pinToast.componentRef?.hostView.destroyed) {
      this.globalNotificationService.close(this._pinToast);
    }

    const section = itemType === PinnedItemType.CASE_DEFINITION_GROUP ? 'groups' : 'types';

    this._pinToast = this.globalNotificationService.showToast({
      type: 'success',
      title: this.translateService.instant(
        `case.overview.${section}.${pinning ? 'pinnedToast' : 'unpinnedToast'}`,
        {name}
      ),
    });
  }

  // Pinned first, then the rest; both alphabetical.
  private sortPinnedFirst<T>(
    items: T[],
    itemType: PinnedItemType,
    getKey: (item: T) => string,
    getName: (item: T) => string | undefined
  ): T[] {
    const isPinned = (item: T): boolean => this.isPinned(itemType, getKey(item));

    return [...items].sort(
      (left, right) =>
        Number(isPinned(right)) - Number(isPinned(left)) ||
        (getName(left) ?? '').localeCompare(getName(right) ?? '', undefined, {
          sensitivity: 'base',
        })
    );
  }

  private isPinInfoDismissed(): boolean {
    try {
      return localStorage.getItem(PIN_INFO_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
