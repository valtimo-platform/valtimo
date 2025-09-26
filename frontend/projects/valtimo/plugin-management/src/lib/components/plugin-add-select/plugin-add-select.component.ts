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
import {BehaviorSubject, combineLatest, Observable, Subscription} from 'rxjs';
import {ConnectorProperties, ConnectorType} from '@valtimo/config';
import {take, map} from 'rxjs/operators';
import {AlertService} from '@valtimo/components';
import {TranslateService} from '@ngx-translate/core';
import {PluginManagementStateService} from '../../services';
import {PluginManagementService, PluginDefinition} from '@valtimo/plugin';

@Component({
  selector: 'valtimo-plugin-add-select',
  templateUrl: './plugin-add-select.component.html',
  styleUrls: ['./plugin-add-select.component.scss'],
})
export class PluginAddSelectComponent implements OnInit, OnDestroy {
  readonly selectedPluginDefinition$ = this.stateService.selectedPluginDefinition$;
  readonly disabled$ = this.stateService.inputDisabled$;
  readonly pluginDefinitionsWithLogos$ = this.stateService.pluginDefinitionsWithLogos$;

  private refreshSubscription!: Subscription;

  constructor(
    private readonly pluginManagementService: PluginManagementService,
    private readonly stateService: PluginManagementStateService,
    private readonly translateService: TranslateService
  ) {}

  ngOnInit(): void {
    this.openRefreshSubscription();
    this.getPluginDefinitions();
  }

  ngOnDestroy(): void {
    this.refreshSubscription?.unsubscribe();
  }

  selectPluginDefinition(pluginDefinition: PluginDefinition): void {
    this.stateService.selectPluginDefinition(pluginDefinition);
  }

  deselectPluginDefinition(): void {
    this.stateService.clearSelectedPluginDefinition();
  }

  private getPluginDefinitions(): void {
    this.pluginManagementService.getPluginDefinitions().subscribe(pluginDefinitions => {
      this.stateService.setPluginDefinitions(pluginDefinitions);
    });
  }

  private openRefreshSubscription(): void {
    this.refreshSubscription = combineLatest([
      this.stateService.showModal$,
      this.stateService.refresh$,
    ]).subscribe(() => {
      this.stateService.clearSelectedPluginDefinition();
    });
  }
}
