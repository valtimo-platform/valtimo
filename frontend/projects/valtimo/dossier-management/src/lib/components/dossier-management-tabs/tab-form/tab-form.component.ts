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
import {ChangeDetectionStrategy, Component, Input, OnDestroy, OnInit, signal} from '@angular/core';
import {AbstractControl, FormGroup, FormGroupDirective} from '@angular/forms';
import {ApiTabType, DefaultTabs} from '@valtimo/dossier';
import {ListItem} from 'carbon-components-angular';
import {combineLatest, map, startWith, Subscription} from 'rxjs';
import {TabService} from '../../../services';
import {ConfigService} from '@valtimo/config';

@Component({
  selector: 'valtimo-tab-form',
  templateUrl: './tab-form.component.html',
  styleUrls: ['./tab-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabFormComponent implements OnInit, OnDestroy {
  @Input() public tabType: ApiTabType;

  public disableTaskListVisibleToggle = signal(false);

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
        case ApiTabType.WIDGETS:
          return [];
      }
    }),
    startWith([])
  );

  public form!: FormGroup;

  public showTasks!: AbstractControl<boolean>;

  private _searchActive: boolean;

  private _subscriptions = new Subscription();

  constructor(
    private readonly configService: ConfigService,
    private readonly tabService: TabService,
    private readonly formGroupDirective: FormGroupDirective
  ) {}

  public ngOnInit(): void {
    this.form = this.formGroupDirective.control;
    this.showTasks = this.form.get('showTasks');
    this.openTaskListToggleSubscription();

    if (this.tabType == ApiTabType.WIDGETS) {
      this.form.get('contentKey')?.disable();
    } else {
      this.form.get('contentKey')?.enable();
    }
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public isKeyError(): boolean {
    return this.form.get('key')?.hasError('uniqueKey') || this.form.get('key')?.hasError('pattern');
  }

  public getKeyErrorMessage(): string {
    if (this.form.get('key')?.hasError('uniqueKey'))
      return 'dossierManagement.tabManagement.addModal.uniqueKeyError';
    if (this.form.get('key')?.hasError('pattern'))
      return 'dossierManagement.tabManagement.addModal.invalidKeyError';
    return '';
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

  public toggleCheckedChange(event: boolean): void {
    this.showTasks?.patchValue(!!event);
  }

  private openTaskListToggleSubscription(): void {
    this.form.get('contentKey').valueChanges.subscribe(contentKey => {
      const summarySelected = contentKey === DefaultTabs.summary;

      if (summarySelected) {
        this.toggleCheckedChange(true);
        this.disableTaskListVisibleToggle.set(true);
      } else {
        this.disableTaskListVisibleToggle.set(false);
      }
    });
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
