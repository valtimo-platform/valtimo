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

import {Component, EventEmitter, Input, Output} from '@angular/core';
import {AbstractControl, FormBuilder, FormControl, Validators} from '@angular/forms';
import {BehaviorSubject, combineLatest, map, Observable, startWith, Subject} from 'rxjs';
import {CompatiblePluginProcessLinks, ProcessLink} from '../../models';
import {ProcessLinkService} from '../../services';
import {IconService, ListItem} from 'carbon-components-angular';
import {Upload16} from '@carbon/icons';
import {CdsThemeService} from '@valtimo/components';

@Component({
  selector: 'valtimo-import-plugin-configuration',
  templateUrl: './import-plugin-configuration.component.html',
  styleUrls: ['./import-plugin-configuration.component.scss'],
})
export class ImportPluginConfigurationComponent {
  @Input() public set pluginActionKey(value: string) {
    this.importPluginForm.reset();
    this.fetchCompatiblePluginProcessLinks(value);
  }

  @Output() public readonly configurationEvent = new EventEmitter<
    ProcessLink['actionProperties']
  >();

  public readonly open$ = new Subject<boolean>();

  private readonly _compatiblePluginProcessLinksSubject$ = new BehaviorSubject<
    CompatiblePluginProcessLinks[]
  >([]);

  public readonly compatiblePluginProcessLinks$ =
    this._compatiblePluginProcessLinksSubject$.asObservable();

  public readonly importPluginForm = this.formBuilder.group({
    process: new FormControl('', Validators.required),
    version: new FormControl('', Validators.required),
    activity: new FormControl('', Validators.required),
  });

  public get process(): AbstractControl<string> {
    return this.importPluginForm.get('process');
  }

  public readonly processListItems$: Observable<ListItem[]> = combineLatest([
    this._compatiblePluginProcessLinksSubject$,
    this.process.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(
      ([compatibleProcessLinks, processValue]) =>
        compatibleProcessLinks?.map(compatibleProcessLink => ({
          content: compatibleProcessLink.processDefinitionKey,
          selected: processValue === compatibleProcessLink.processDefinitionKey,
        })) || []
    )
  );

  public get version(): AbstractControl<string> {
    return this.importPluginForm.get('version');
  }

  public readonly versionListItems$: Observable<ListItem[]> = combineLatest([
    this._compatiblePluginProcessLinksSubject$,
    this.process.valueChanges.pipe(startWith('')),
    this.version.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([compatibleProcessLinks, processValue, versionValue]) =>
      !processValue
        ? []
        : compatibleProcessLinks
            .find(compatibleLinks => compatibleLinks.processDefinitionKey === processValue)
            ?.versions.sort((a, b) => Number(b.version) - Number(a.version))
            .map(versionItem => ({
              content: versionItem.version,
              selected: versionItem.version === versionValue,
            })) || []
    )
  );

  public get activity(): AbstractControl<string> {
    return this.importPluginForm.get('activity');
  }

  public readonly activityListItems$: Observable<ListItem[]> = combineLatest([
    this._compatiblePluginProcessLinksSubject$,
    this.process.valueChanges.pipe(startWith('')),
    this.version.valueChanges.pipe(startWith('')),
    this.activity.valueChanges.pipe(startWith('')),
  ]).pipe(
    map(([compatibleProcessLinks, processValue, versionValue, activityValue]) =>
      !processValue || !versionValue
        ? []
        : compatibleProcessLinks
            .find(compatibleLinks => compatibleLinks.processDefinitionKey === processValue)
            .versions.find(versionItem => versionItem.version === versionValue)
            .processLinks.map(processLinkItem => ({
              content: processLinkItem.activityId,
              selected: processLinkItem.activityId === activityValue,
            }))
    )
  );

  public readonly toggletipTheme$ = this.cdsThemeService.toggletipTheme$;

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly processLinkService: ProcessLinkService,
    private readonly iconService: IconService,
    private readonly cdsThemeService: CdsThemeService
  ) {
    this.iconService.register(Upload16);
  }

  public onSubmit(): void {
    this.configurationEvent.emit(
      this._compatiblePluginProcessLinksSubject$
        .getValue()
        .find(
          compatiblePluginProcessLinks =>
            compatiblePluginProcessLinks.processDefinitionKey === this.process.value
        )
        .versions.find(versionItem => versionItem.version === this.version.value)
        .processLinks.find(processLinkItem => processLinkItem.activityId === this.activity.value)
        .actionProperties
    );

    // needed to reliably trigger toggle tip closure
    this.open$.next(true);
    setTimeout(() => this.open$.next(false));

    this.importPluginForm.reset();
  }

  private fetchCompatiblePluginProcessLinks(pluginActionKey: string): void {
    this.processLinkService
      .getCompatiblePluginProcessLinks(pluginActionKey)
      .subscribe(res => this._compatiblePluginProcessLinksSubject$.next(res));
  }

  public processSelected(event: {item: ListItem}): void {
    this.process.setValue(event?.item?.content);
    this.version.setValue('');
    this.activity.setValue('');
  }

  public versionSelected(event: {item: ListItem}): void {
    this.version.setValue(event?.item?.content);
    this.activity.setValue('');
  }

  public activitySelected(event: {item: ListItem}): void {
    this.activity.setValue(event?.item?.content);
  }
}
