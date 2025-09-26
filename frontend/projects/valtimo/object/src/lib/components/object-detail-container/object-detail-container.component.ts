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
import {map, Observable, Subscription} from 'rxjs';
import {ConfigService} from '@valtimo/config';
import {ObjectStateService} from '../../services/object-state.service';
import {ObjectService} from '../../services/object.service';
import {TabEnum} from '../../services/tab.enum';
import {TabService} from '../../services/tab.service';

@Component({
  selector: 'valtimo-object-detail-container',
  templateUrl: './object-detail-container.component.html',
  styleUrls: ['./object-detail-container.component.scss'],
})
export class ObjectDetailContainerComponent implements OnInit, OnDestroy {
  public currentTab: TabEnum;
  public caseListColumn!: boolean;

  private tabSubscription: Subscription;

  readonly TabEnum = TabEnum;

  readonly objectManagementId$: Observable<string> = this.route.params.pipe(
    map(params => params.objectManagementId)
  );

  constructor(
    private readonly objectState: ObjectStateService,
    private readonly objectService: ObjectService,
    private readonly route: ActivatedRoute,
    private readonly configService: ConfigService,
    private readonly tabService: TabService
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
