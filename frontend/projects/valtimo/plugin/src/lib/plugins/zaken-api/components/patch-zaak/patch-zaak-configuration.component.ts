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

import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, filter, map, Observable, of, Subscription, switchMap, take} from 'rxjs';
import {IconService} from 'carbon-components-angular';
import {Add16, TrashCan16} from '@carbon/icons';
import {PatchZaakConfig, PropertyFormField} from '../../models';
import {PatchZaakProperties, PatchZaakPropertyOptions} from '../../models/patch-zaak-properties';
import {GEOMETRY_TYPES} from '../../models/geometry-types';
import {PAYMENT_INDICATION_TYPES} from '../../models/payment-indication-types';
import {CONFIDENTIALITY_TYPES} from '../../models/confidentiality-types';
import {ARCHIVE_NOMINATION_TYPES} from '../../models/archive-nomination-types';
import {ARCHIVE_STATUS_TYPES} from '../../models/archive-status-types';
import {PluginTranslatePipe} from '../../../../pipes';

@Component({
  standalone: false,
  selector: 'valtimo-patch-zaak-configuration',
  templateUrl: './patch-zaak-configuration.component.html',
  styleUrl: './patch-zaak-configuration.component.scss',
  providers: [PluginTranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatchZaakConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() save$: Observable<void>;
  @Input() prefillConfiguration$: Observable<PatchZaakConfig>;
  @Output() valid: EventEmitter<boolean> = new EventEmitter<boolean>();
  @Output() configuration: EventEmitter<PatchZaakConfig> = new EventEmitter<PatchZaakConfig>();

  private readonly LINKED_FIELD_GROUPS: Record<string, string[]> = {
    caseGeometryType: ['caseGeometryCoordinates'],
    verlenging: ['extensionReason', 'extensionDuration'],
    opschorting: ['suspensionIndication', 'suspensionReason'],
    processObject: [
      'processObjectDateAttribute',
      'processObjectIdentification',
      'processObjectObjectType',
      'processObjectRegistration',
    ],
  };

  private readonly GROUP_TRIGGERS = new Set(['verlenging', 'opschorting', 'processObject']);

  private readonly _allLinkedFollowers: string[] = Object.values(this.LINKED_FIELD_GROUPS).flat();

  public readonly menuPropertyOptions: string[] = [
    ...PatchZaakPropertyOptions.filter(p => !this._allLinkedFollowers.includes(p)),
    ...Object.keys(this.LINKED_FIELD_GROUPS).filter(k => this.GROUP_TRIGGERS.has(k)),
  ];

  public readonly propertyList: Array<PropertyFormField> = [];

  public readonly pluginId$ = new BehaviorSubject<string>('');
  private readonly _propertyListChanged$ = new BehaviorSubject<void>(undefined);
  public readonly sortedPropertyList$: Observable<PropertyFormField[]> = combineLatest([
    this.pluginId$.pipe(filter(Boolean)),
    this._propertyListChanged$,
  ]).pipe(
    switchMap(([pluginId]) => {
      if (this.propertyList.length === 0) return of([]);
      return combineLatest(
        this.propertyList.map(p =>
          this.pluginTranslatePipe.transform(p.translationKey, pluginId).pipe(
            map(label => ({key: p.name, label}))
          )
        )
      ).pipe(
        map(labeledItems => {
          const labelMap = new Map(labeledItems.map(i => [i.key, i.label]));
          return this.sortPropertyListByLabel(this.propertyList, labelMap);
        })
      );
    })
  );
  public readonly sortedPropertyListGroups$: Observable<PropertyFormField[][]> =
    this.sortedPropertyList$.pipe(
      map(list => {
        const groups: PropertyFormField[][] = [];
        for (const property of list) {
          if (!this.isLinkedFollower(property.name)) {
            groups.push([property]);
          } else {
            groups[groups.length - 1].push(property);
          }
        }
        return groups;
      })
    );
  public readonly sortedMenuPropertyOptions$: Observable<string[]> = this.pluginId$.pipe(
    filter(pluginId => !!pluginId),
    switchMap(pluginId =>
      combineLatest(
        this.menuPropertyOptions.map(p =>
          this.pluginTranslatePipe.transform(this.translationKeyFor(p), pluginId).pipe(
            map(label => ({key: p, label}))
          )
        )
      )
    ),
    map(items => [...items].sort((a, b) => a.label.localeCompare(b.label)).map(item => item.key))
  );

  private readonly _formValue$ = new BehaviorSubject<PatchZaakConfig>({});
  private readonly _properties = new Map<PatchZaakProperties, string>();
  private _saveSubscription!: Subscription;
  private readonly _valid$ = new BehaviorSubject<boolean>(false);

  constructor(
    private readonly iconService: IconService,
    private readonly pluginTranslatePipe: PluginTranslatePipe
  ) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  public ngOnInit(): void {
    this.pluginId$.next(this.pluginId);
    this.openSaveSubscription();

    this.prefillConfiguration$
      .pipe(
        filter((prefill): prefill is PatchZaakConfig => !!prefill),
        take(1)
      )
      .subscribe(prefill => {
        for (const [trigger, followers] of Object.entries(this.LINKED_FIELD_GROUPS)) {
          if (this.GROUP_TRIGGERS.has(trigger) && followers.some(f => !!prefill[f])) {
            this.addProperty(trigger);
          }
        }
        const allFollowers = Object.values(this.LINKED_FIELD_GROUPS).flat();
        PatchZaakPropertyOptions.filter(p => !allFollowers.includes(p) && !!prefill[p]).forEach(
          p => this.addProperty(p)
        );
      });
  }

  public ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public onFormValueChanged(formValue: PatchZaakConfig): void {
    this._properties.forEach((value, key) => (formValue[key] = value));
    this._formValue$.next(formValue);
    this.handleValid(formValue);
  }

  public onPropertyChanged(property: PatchZaakProperties, value: any): void {
    this._properties.set(property, value);
    this._formValue$
      .pipe(take(1))
      .subscribe(formValue => {
        this.onFormValueChanged(formValue);
      });
  }

  public addProperty(property: string): void {
    if (!this.GROUP_TRIGGERS.has(property)) {
      if (!this.hasPropertyBeenAdded(property)) {
        this.propertyList.push(this.propertyFormFieldFor(property as PatchZaakProperties));
        this.onPropertyChanged(property as PatchZaakProperties, undefined);
      }
    }
    const linked = this.LINKED_FIELD_GROUPS[property];
    if (linked) {
      linked.forEach(p => this.addProperty(p));
    }
    this._propertyListChanged$.next();
  }

  public removeProperty(property: string): void {
    if (!this.GROUP_TRIGGERS.has(property)) {
      if (this.hasPropertyBeenAdded(property)) {
        this.propertyList.splice(
          this.propertyList.findIndex(item => item.name === property),
          1
        );
        this.onPropertyChanged(property as PatchZaakProperties, undefined);
      }
    }
    const linked = this.LINKED_FIELD_GROUPS[property];
    if (linked) {
      linked.forEach(p => this.removeProperty(p));
    }
    this._propertyListChanged$.next();
  }

  public hasPropertyBeenAdded(property: string): boolean {
    if (this.GROUP_TRIGGERS.has(property)) {
      return this.LINKED_FIELD_GROUPS[property]?.some(p => this.hasPropertyBeenAdded(p)) ?? false;
    }
    return this.propertyList.findIndex(item => item.name === property) !== -1;
  }

  public isLinkedFollower(property: string): boolean {
    for (const [trigger, followers] of Object.entries(this.LINKED_FIELD_GROUPS)) {
      if (followers.includes(property)) {
        if (this.GROUP_TRIGGERS.has(trigger)) {
          return followers[0] !== property;
        }
        return true;
      }
    }
    return false;
  }

  public groupTriggerFor(property: string): string | null {
    for (const [trigger, followers] of Object.entries(this.LINKED_FIELD_GROUPS)) {
      if (this.GROUP_TRIGGERS.has(trigger) && followers[0] === property) {
        return trigger;
      }
    }
    return null;
  }

  public prefillValueFor(property: PatchZaakProperties, prefill: PatchZaakConfig): string | null {
    return prefill != null ? (prefill[property] ?? null) : null;
  }

  public translationKeyFor(property: string): string {
    if (property === 'description') return 'omschrijving';
    if (property === 'caseGeometryType') return 'caseGeometry';
    return property;
  }

  private propertyFormFieldFor(property: PatchZaakProperties): PropertyFormField {
    return {
      name: property,
      translationKey: this.translationKeyFor(property),
      tooltipTranslationKey: this.tooltipTranslationKeyFor(property),
      presetOptions: this.presetOptionsForProperty(property),
    };
  }

  private tooltipTranslationKeyFor(property: string): string | null {
    if (property.toLowerCase().includes('date')) {
      return 'dateformatTooltip';
    }
    if (property === 'caseGeometryCoordinates') {
      return 'caseGeometryCoordinatesTooltip';
    }
    return null;
  }

  private presetOptionsForProperty(property: string): string[] {
    switch (property) {
      case 'caseGeometryType':
        return GEOMETRY_TYPES;
      case 'paymentIndication':
        return PAYMENT_INDICATION_TYPES;
      case 'confidentiality':
        return CONFIDENTIALITY_TYPES;
      case 'archiveNomination':
        return ARCHIVE_NOMINATION_TYPES;
      case 'archiveStatus':
        return ARCHIVE_STATUS_TYPES;
      case 'suspensionIndication':
        return ['true', 'false'];
      default:
        return [];
    }
  }

  private followersForHead(property: string): string[] {
    if (this.LINKED_FIELD_GROUPS[property] && !this.GROUP_TRIGGERS.has(property)) {
      return this.LINKED_FIELD_GROUPS[property];
    }
    for (const [trigger, followers] of Object.entries(this.LINKED_FIELD_GROUPS)) {
      if (this.GROUP_TRIGGERS.has(trigger) && followers[0] === property) {
        return followers.slice(1);
      }
    }
    return [];
  }

  private sortPropertyListByLabel(
    list: PropertyFormField[],
    labels: Map<string, string>
  ): PropertyFormField[] {
    const propertyMap = new Map(list.map(p => [p.name, p]));
    const heads = list.filter(p => !this.isLinkedFollower(p.name));
    heads.sort((a, b) => (labels.get(a.name) ?? '').localeCompare(labels.get(b.name) ?? ''));
    return heads.flatMap(head => {
      const followers = this.followersForHead(head.name)
        .map(n => propertyMap.get(n))
        .filter((p): p is PropertyFormField => !!p);
      return [head, ...followers];
    });
  }

  private handleValid(formValue: PatchZaakConfig): void {
    const isPropertyInvalid = this.propertyList.some(property => !!!formValue[property.name]);
    const valid = !isPropertyInvalid;
    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$?.subscribe(() => {
      combineLatest([this._formValue$, this._valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (valid) {
            const payload: PatchZaakConfig = {};
            this.propertyList.forEach(property => (payload[property.name] = formValue[property.name]));
            this.configuration.emit(payload);
          }
        });
    });
  }
}
