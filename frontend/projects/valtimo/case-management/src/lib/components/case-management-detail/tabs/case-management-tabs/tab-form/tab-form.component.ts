/*
 * Copyright 2015-2025 Ritense BV, the Netherlands.
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
import {ApiTabType, DefaultTabs} from '@valtimo/case';
import {ListItem} from 'carbon-components-angular';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  shareReplay,
  startWith,
  Subscription,
} from 'rxjs';
import {TabService} from '../../../../../services';
import {ExternalPluginTabConfigOption} from '../../../../../models';
import {ConfigService} from '@valtimo/shared';
import {ActivatedRoute} from '@angular/router';

@Component({
  standalone: false,
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
    this.tabService.getFormDefinitions(this.route),
    this.tabService.defaultTabs$,
    this.tabService.customComponentKeys$,
    this.tabService.getExternalPluginTabItems(),
  ]).pipe(
    map(([tabKeys, formDefinitions, defaultTabs, customComponentKeys, externalPluginItems]) => {
      switch (this.tabType) {
        case ApiTabType.STANDARD:
          return this.getListItems(defaultTabs, tabKeys);
        case ApiTabType.CUSTOM:
          return this.getListItems(customComponentKeys, tabKeys);
        case ApiTabType.FORMIO:
          return this.getListItems(formDefinitions, tabKeys);
        case ApiTabType.EXTERNAL_PLUGIN:
          return this.getListItems(externalPluginItems, tabKeys);
        case ApiTabType.WIDGETS:
          return [];
        default:
          return [];
      }
    }),
    startWith([])
  );

  public form!: FormGroup;

  public showTasks!: AbstractControl<boolean>;

  // External-plugin tabs are configured with two dropdowns: configuration, then tab (bundle).
  public readonly TabType = ApiTabType;
  private readonly _externalPluginConfigs$ = this.tabService
    .getExternalPluginConfigs()
    .pipe(shareReplay({bufferSize: 1, refCount: true}));
  private readonly _selectedConfigId$ = new BehaviorSubject<string | null>(null);
  private readonly _selectedBundleKey$ = new BehaviorSubject<string | null>(null);
  private _configs: ExternalPluginTabConfigOption[] = [];

  public readonly selectedConfigId$ = this._selectedConfigId$.asObservable();

  public readonly configItems$: Observable<ListItem[]> = combineLatest([
    this._externalPluginConfigs$,
    this._selectedConfigId$,
  ]).pipe(
    map(([configs, selectedConfigId]) =>
      configs.map(config => ({
        content: config.label,
        configId: config.configId,
        selected: config.configId === selectedConfigId,
      }))
    )
  );

  public readonly bundleItems$: Observable<ListItem[]> = combineLatest([
    this._externalPluginConfigs$,
    this._selectedConfigId$,
    this._selectedBundleKey$,
  ]).pipe(
    map(([configs, selectedConfigId, selectedBundleKey]) => {
      const config = configs.find(item => item.configId === selectedConfigId);
      return (config?.bundles ?? []).map(bundle => ({
        content: bundle.title,
        bundleKey: bundle.key,
        selected: bundle.key === selectedBundleKey,
      }));
    })
  );

  private _searchActive: boolean;

  private _subscriptions = new Subscription();

  constructor(
    private readonly configService: ConfigService,
    private readonly tabService: TabService,
    private readonly formGroupDirective: FormGroupDirective,
    private readonly route: ActivatedRoute
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

    if (this.tabType === ApiTabType.EXTERNAL_PLUGIN) {
      this._subscriptions.add(
        this._externalPluginConfigs$.subscribe(configs => (this._configs = configs))
      );
      this.preselectExternalPlugin();
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
      return 'caseManagement.tabManagement.addModal.uniqueKeyError';
    if (this.form.get('key')?.hasError('pattern'))
      return 'caseManagement.tabManagement.addModal.invalidKeyError';
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

  public onConfigSelected(item: ListItem & {configId?: string}): void {
    const configId = item?.configId ?? null;
    this._selectedConfigId$.next(configId);
    this._selectedBundleKey$.next(null);

    const config = this._configs.find(candidate => candidate.configId === configId);
    // A configuration with a single bundle needs no second choice — resolve the contentKey now.
    if (config && config.bundles.length === 1) {
      const bundle = config.bundles[0];
      this._selectedBundleKey$.next(bundle.key);
      this.setExternalPluginContentKey(configId, bundle.key);
    } else {
      // Multiple bundles: clear the contentKey so the form stays invalid until a tab is picked.
      this.form.get('contentKey')?.setValue('');
    }
  }

  public onBundleSelected(item: ListItem & {bundleKey?: string | null}): void {
    const bundleKey = item?.bundleKey ?? null;
    this._selectedBundleKey$.next(bundleKey);
    this.setExternalPluginContentKey(this._selectedConfigId$.value, bundleKey);
  }

  private setExternalPluginContentKey(configId: string | null, bundleKey: string | null): void {
    if (!configId) return;
    const contentKey = bundleKey ? `${configId}:${bundleKey}` : configId;
    this.form.get('contentKey')?.setValue(contentKey);
  }

  private preselectExternalPlugin(): void {
    const contentKey = this.form.get('contentKey')?.value as string | undefined;
    if (!contentKey) return;
    const separatorIndex = contentKey.indexOf(':');
    const configId = separatorIndex >= 0 ? contentKey.substring(0, separatorIndex) : contentKey;
    const bundleKey = separatorIndex >= 0 ? contentKey.substring(separatorIndex + 1) : null;
    this._selectedConfigId$.next(configId);
    this._selectedBundleKey$.next(bundleKey);
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
