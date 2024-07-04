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

import {Component, OnDestroy, OnInit} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {combineLatest, filter, map, Observable, Subscription, switchMap} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {TabService} from '../../services/tab.service';
import {TabEnum} from '../../services/tab.enum';
import {ObjectManagementService} from '../../services/object-management.service';
import {ObjectManagementStateService} from '../../services/object-management-state.service';
import {PageTitleService} from '@valtimo/components';
import {tap} from 'rxjs/operators';

@Component({
  selector: 'valtimo-object-management-detail-container',
  templateUrl: './object-management-detail-container.component.html',
  styleUrls: ['./object-management-detail-container.component.css'],
})
export class ObjectManagementDetailContainerComponent implements OnInit, OnDestroy {
  public currentTab: TabEnum;
  public caseListColumn!: boolean;

  private tabSubscription: Subscription;

  readonly TabEnum = TabEnum;

  readonly objectId$: Observable<string> = this.route.params.pipe(
    map(params => params.id || ''),
    filter(id => !!id)
  );

  readonly object$ = combineLatest([this.objectId$, this.objectManagementState.refresh$]).pipe(
    switchMap(([object]) => this.objectManagementService.getObjectById(object)),
    tap(object => {
      this.pageTitleService.setCustomPageTitle(object.title);
    })
  );

  constructor(
    private readonly objectManagementState: ObjectManagementStateService,
    private readonly objectManagementService: ObjectManagementService,
    private readonly route: ActivatedRoute,
    private readonly configService: ConfigService,
    private readonly tabService: TabService,
    private readonly pageTitleService: PageTitleService
  ) {
    this.caseListColumn = this.configService.config.featureToggles?.caseListColumn ?? true;
  }

  ngOnInit(): void {
    this.openCurrentTabSubscription();
  }

  displayBodyComponent(tab: TabEnum): void {
    this.tabService.currentTab = tab;
  }

  openCurrentTabSubscription(): void {
    this.tabSubscription = this.tabService.currentTab$.subscribe(
      value => (this.currentTab = value)
    );
  }

  ngOnDestroy(): void {
    this.tabService.currentTab = TabEnum.GENERAL;
    this.tabSubscription?.unsubscribe();
  }
}
