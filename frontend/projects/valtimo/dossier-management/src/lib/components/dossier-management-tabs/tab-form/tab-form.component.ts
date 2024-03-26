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
import {ChangeDetectionStrategy, Component, Input, OnInit} from '@angular/core';
import {FormGroup, FormGroupDirective} from '@angular/forms';
import {ApiTabType} from '@valtimo/dossier';
import {ListItem} from 'carbon-components-angular';
import {combineLatest, map, startWith} from 'rxjs';
import {TabService} from '../../../services';

@Component({
  selector: 'valtimo-tab-form',
  templateUrl: './tab-form.component.html',
  styleUrls: ['./tab-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabFormComponent implements OnInit {
  @Input() tabType: ApiTabType;

  public readonly listItems$ = combineLatest([
    this.tabService.configuredContentKeys$,
    this.tabService.formDefinitions$,
    this.tabService.defaultTabs$,
    this.tabService.customComponentKeys$,
  ]).pipe(
    map(([tabKeys, formDefinitions, defaultTabs, customComponentKeys]) => {
      switch (this.tabType) {
        case ApiTabType.STANDARD:
          return this.getListItems(defaultTabs, tabKeys);
        case ApiTabType.CUSTOM:
          return this.getListItems(customComponentKeys, tabKeys);
        case ApiTabType.FORMIO:
          return this.getListItems(formDefinitions, tabKeys);
      }
    }),
    startWith([])
  );
  public form!: FormGroup;

  private _searchActive: boolean;

  constructor(
    private readonly tabService: TabService,
    private readonly formGroupDirective: FormGroupDirective
  ) {}

  public ngOnInit(): void {
    this.form = this.formGroupDirective.control;
  }

  public onSearch(): void {
    if (this._searchActive) {
      return;
    }

    this._searchActive = true;
    this.form.get('contentKey')?.reset('');
  }

  public onSelected(): void {
    this._searchActive = false;
  }

  private getListItems(tabItems: ListItem[], configuredContentKeys: string[]): ListItem[] {
    return tabItems
      .filter(
        (tabItem: ListItem) =>
          !configuredContentKeys.includes(tabItem.contentKey) ||
          this.form?.get('contentKey')?.value === tabItem.contentKey
      )
      .map((tabItem: ListItem) => ({
        ...tabItem,
        selected: this.form?.get('contentKey')?.value === tabItem.contentKey,
      }));
  }
}
