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

import {Injectable} from '@angular/core';
import {CASES_MENU_ITEM_ID, ConfigService, isCasesMenuItem, MenuItem} from '@valtimo/shared';
import {CaseDefinition, DocumentService, OpenDocumentCount} from '@valtimo/document';
import {SseService} from '@valtimo/sse';
import {merge, Observable, of} from 'rxjs';
import {map, shareReplay, startWith, switchMap} from 'rxjs/operators';
import {MenuService} from '@valtimo/components';
import {CASE_MENU_TEST_IDS} from '../constants/case.test-ids';
import {PINNED_ITEM_FALLBACK_COLOR} from '../constants/pinned-item.constants';
import {PinnedItem, PinnedItemType} from '../models';
import {PinnedItemsService} from './pinned-items.service';

const CASES_OVERVIEW_LINK = ['/cases-overview'];
// Case and group pages belong to Cases even when the item is not pinned to the menu.
const CASES_SECTION_LINKS = ['/cases', '/groups'];

@Injectable({providedIn: 'root'})
export class CaseMenuService {
  // Shared by every case definition menu item, so one request refreshes all counts.
  private readonly _openCaseCounts$: Observable<Map<string, number>> = this.configService
    .getFeatureToggleObservable('disableCaseCount')
    .pipe(
      switchMap(disableCaseCount =>
        disableCaseCount
          ? of(new Map<string, number>())
          : this.sseService
              .getSseMessagesObservableByEventType([
                'CASE_UNASSIGNED',
                'CASE_ASSIGNED',
                'CASE_CREATED',
              ])
              .pipe(
                startWith(null),
                switchMap(() => this.documentService.getOpenDocumentCount()),
                map(
                  (counts: OpenDocumentCount[]) =>
                    new Map(
                      counts.map(count => [count.documentDefinitionName, count.openDocumentCount])
                    )
                )
              )
      ),
      shareReplay({bufferSize: 1, refCount: true})
    );

  constructor(
    private readonly menuService: MenuService,
    private readonly configService: ConfigService,
    private readonly documentService: DocumentService,
    private readonly pinnedItemsService: PinnedItemsService,
    private readonly sseService: SseService
  ) {
    this.menuService.registerAppendMenuItemsFunction(this.appendCaseMenuItems.bind(this));
  }

  // Kept subscribed on purpose: pinning or flipping the toggle emits, which re-emits the menu items.
  public appendCaseMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> =>
    this.configService.getFeatureToggleObservable('enableGenericCaseList').pipe(
      switchMap(showAllCaseDefinitions =>
        showAllCaseDefinitions
          ? this.getCaseDefinitionMenuItems()
          : this.pinnedItemsService.pinnedItems$.pipe(
              map((pinnedItems: PinnedItem[]) => this.toMenuItems(pinnedItems))
            )
      ),
      map((children: MenuItem[]) => {
        const index = this.getCasesIndex(menuItems);

        if (index >= 0) {
          menuItems[index].id = CASES_MENU_ITEM_ID;
          menuItems[index].testId = CASE_MENU_TEST_IDS.casesMenu;
          menuItems[index].titleLink = CASES_OVERVIEW_LINK;
          menuItems[index].sectionLinks = CASES_SECTION_LINKS;
          menuItems[index].children = children;
        }

        return menuItems;
      })
    );

  private getCasesIndex(menuItems: MenuItem[]): number {
    return menuItems.findIndex(isCasesMenuItem);
  }

  /** Every case definition the user may see, sorted alphabetically by name. */
  private getCaseDefinitionMenuItems(): Observable<MenuItem[]> {
    return this.documentService.getCaseDefinitions({active: true}).pipe(
      map((caseDefinitions: CaseDefinition[]) =>
        [...caseDefinitions]
          .sort((left: CaseDefinition, right: CaseDefinition) =>
            (left.name ?? '').localeCompare(right.name ?? '', undefined, {sensitivity: 'base'})
          )
          .map((caseDefinition: CaseDefinition, index: number) => ({
            link: ['/cases/' + caseDefinition.caseDefinitionKey],
            title: caseDefinition.name,
            iconClass: 'icon mdi mdi-dot-circle',
            sequence: index,
            show: true,
            count$: this._openCaseCounts$.pipe(
              map(counts => counts.get(caseDefinition.caseDefinitionKey) ?? 0)
            ),
            testId: CASE_MENU_TEST_IDS.caseDefinitionItem,
          }))
      )
    );
  }

  /**
   * Built straight from the pinned items: the backend already resolved the name and colour, and
   * left out what the user may no longer see. Sorted alphabetically by name.
   */
  private toMenuItems(pinnedItems: PinnedItem[]): MenuItem[] {
    const menuItems: MenuItem[] = pinnedItems
      .filter((pinnedItem: PinnedItem) => !!pinnedItem.displayName)
      .sort((left: PinnedItem, right: PinnedItem) =>
        (left.displayName as string).localeCompare(right.displayName as string, undefined, {
          sensitivity: 'base',
        })
      )
      .map((pinnedItem: PinnedItem, index: number) => ({
        link:
          pinnedItem.itemType === PinnedItemType.CASE_DEFINITION_GROUP
            ? ['/groups/' + pinnedItem.itemKey]
            : ['/cases/' + pinnedItem.itemKey],
        title: pinnedItem.displayName as string,
        iconClass: 'icon mdi mdi-dot-circle',
        color: pinnedItem.color || PINNED_ITEM_FALLBACK_COLOR,
        sequence: index,
        show: true,
        testId: CASE_MENU_TEST_IDS.pinnedItem,
      }));

    return menuItems.length > 0 ? menuItems : [this.getPlaceholderMenuItem()];
  }

  private getPlaceholderMenuItem(): MenuItem {
    return {
      link: CASES_OVERVIEW_LINK,
      title: 'case.menu.pinPlaceholder',
      iconClass: 'icon mdi mdi-pin',
      sequence: 0,
      show: true,
      testId: CASE_MENU_TEST_IDS.pinPlaceholder,
    };
  }
}
