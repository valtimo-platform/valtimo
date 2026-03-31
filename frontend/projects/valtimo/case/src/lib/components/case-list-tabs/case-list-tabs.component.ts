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
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {AssigneeFilter, CaseListTab, ConfigService} from '@valtimo/shared';
import {Tab, Tabs} from 'carbon-components-angular';
import {BehaviorSubject} from 'rxjs';
import {DEFAULT_CASE_LIST_TABS} from '../../constants';
import {TeamsApiService} from '@valtimo/teams';

@Component({
  standalone: false,
  selector: 'valtimo-case-list-tabs',
  templateUrl: './case-list-tabs.component.html',
  styleUrls: ['./case-list-tabs.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CaseListTabsComponent implements OnInit {
  @ViewChild(Tabs) tabsComponent: Tabs;

  @Input() public assigneeFilter: AssigneeFilter | null = null;
  @Input() public selectedRowCount = 0;

  @Output() public tabChangeEvent = new EventEmitter<CaseListTab>();

  public activeTab: CaseListTab | null = null;
  public visibleCaseTabs: Array<CaseListTab> | null = null;
  public readonly defaultTabs = DEFAULT_CASE_LIST_TABS;
  public readonly showChangeTabModal$ = new BehaviorSubject<boolean>(false);
  public readonly tabChange$ = new BehaviorSubject<CaseListTab | null>(null);

  constructor(
    private readonly configService: ConfigService,
    private readonly teamsApiService: TeamsApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  public ngOnInit(): void {
    const tabs = this.configService.config?.visibleCaseListTabs || this.defaultTabs;
    this.visibleCaseTabs = tabs;

    this.teamsApiService.getCurrentUserTeams().subscribe(teams => {
      this.visibleCaseTabs =
        teams.length > 0 ? tabs : tabs.filter(tab => tab !== CaseListTab.TEAM);
      this.cdr.markForCheck();
    });
  }

  public trackByIndex(index: number): number {
    return index;
  }

  public tabChange(tab: CaseListTab): void {
    if (!this.activeTab) {
      this.activeTab = tab;
      return;
    }

    if (this.activeTab.toLowerCase() === tab.toLowerCase()) return;

    if (this.selectedRowCount > 0) {
      this.showChangeTabModal$.next(true);
      this.tabChange$.next(tab);
      return;
    }

    this.confirmTabChange(tab);
  }

  public onChangeTabCancel(): void {
    if (!this.tabsComponent) return;

    const prevTab: Tab | undefined = this.tabsComponent.tabs.find(
      (tab: Tab) => tab.id === this.activeTab
    );

    if (!prevTab) return;

    const tab = this.tabsComponent.tabs.find((tab: Tab) => tab.active);
    if (!tab) return;

    tab.active = false;
    prevTab.active = true;
  }

  public onChangeTabConfirm(tab: CaseListTab): void {
    this.confirmTabChange(tab);
  }

  private confirmTabChange(tab: CaseListTab): void {
    this.activeTab = tab;
    this.tabChangeEvent.emit(tab);
  }
}
