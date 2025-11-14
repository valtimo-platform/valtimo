import {Component, EventEmitter, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {FunctionConfigurationComponent} from '../../../../models';
import {BehaviorSubject, combineLatest, Observable, Subscription, take} from 'rxjs';
import {PatchZaakBesluitConfig} from '../../models';
import {Add16, TrashCan16} from '@carbon/icons';
import {
  PatchBesluitProperties,
  PatchBesluitPropertyOptions,
} from '../../models/patch-besluit-properties';
import {IconService} from 'carbon-components-angular';

@Component({
  standalone: false,
  selector: 'valtimo-patch-zaak-besluit-configuration',
  templateUrl: './patch-zaak-besluit-configuration.component.html',
  styleUrls: ['./patch-zaak-besluit-configuration.component.scss'],
})
export class PatchZaakBesluitConfigurationComponent
  implements FunctionConfigurationComponent, OnInit, OnDestroy
{
  @Input() save$: Observable<void>;
  @Input() disabled$: Observable<boolean>;
  @Input() pluginId: string;
  @Input() prefillConfiguration$: Observable<PatchZaakBesluitConfig>;
  @Output() valid = new EventEmitter<boolean>();
  @Output() configuration = new EventEmitter<PatchZaakBesluitConfig>();

  public readonly propertyOptions: PatchBesluitProperties[] = [...PatchBesluitPropertyOptions];
  public propertyList: PatchBesluitProperties[] = [];

  private readonly _formValue$ = new BehaviorSubject<PatchZaakBesluitConfig | null>(null);
  private readonly _properties = new Map<PatchBesluitProperties, string>();
  private readonly _valid$ = new BehaviorSubject<boolean>(false);
  private _saveSubscription!: Subscription;
  private _prefillConfig: PatchZaakBesluitConfig | null = null;

  constructor(private readonly iconService: IconService) {
    this.iconService.registerAll([Add16, TrashCan16]);
  }

  ngOnInit(): void {
    this.openSaveSubscription();

    this.prefillConfiguration$.pipe(take(1)).subscribe(prefill => {
      if (!prefill) return;

      this._prefillConfig = prefill;

      const prefilledProperties = this.propertyOptions.filter(
        property => !!this.prefillValueFor(property, prefill)
      );

      this.propertyList = [...prefilledProperties];
    });
  }

  ngOnDestroy(): void {
    this._saveSubscription?.unsubscribe();
  }

  public onFormValueChanged(formValue: PatchZaakBesluitConfig): void {
    this._formValue$.next(formValue);
    this.handleValid(formValue);
  }

  public onPropertyChanged(property: PatchBesluitProperties, value: any): void {
    this._properties.set(property, value);

    const formValue = this._formValue$.value;
    if (!formValue) return;

    this._properties.forEach((propValue, key) => {
      formValue[key] = propValue;
    });

    this.onFormValueChanged(formValue);
  }

  public prefillValueFor(property: string, prefill: PatchZaakBesluitConfig): string | null {
    return prefill ? ((prefill as any)[property] ?? null) : null;
  }

  public translationKeyFor(property: string): string {
    return property === 'description' ? 'omschrijving' : property;
  }

  public translationKeyForPropertyList(property: string): string {
    return this.translationKeyFor(property);
  }

  public addProperty(property: PatchBesluitProperties): void {
    if (!this.propertyList.includes(property)) {
      this.propertyList = [...this.propertyList, property];
      const formValue = this._formValue$.value;
      if (formValue) this.handleValid(formValue);
    }
  }

  public removeProperty(property: PatchBesluitProperties): void {
    if (this.propertyList.includes(property)) {
      this.propertyList = this.propertyList.filter(p => p !== property);
      this._properties.delete(property);

      const formValue = this._formValue$.value;
      if (formValue) {
        (formValue as any)[property] = undefined;
        this.handleValid(formValue);
      }
    }
  }

  public hasPropertyBeenAdded(property: PatchBesluitProperties): boolean {
    return this.propertyList.includes(property);
  }

  private handleValid(formValue: PatchZaakBesluitConfig): void {
    const combined: any = {
      ...((this._prefillConfig as any) || {}),
      ...(formValue as any),
    };

    const besluitUrlValid = !!combined.besluitUrl;
    const dynamicValid = this.propertyList.every(p => !!combined[p]);
    const valid = besluitUrlValid && dynamicValid;

    this._valid$.next(valid);
    this.valid.emit(valid);
  }

  private openSaveSubscription(): void {
    this._saveSubscription = this.save$?.subscribe(() => {
      combineLatest([this._formValue$, this._valid$])
        .pipe(take(1))
        .subscribe(([formValue, valid]) => {
          if (!valid || !formValue) return;

          const combined: any = {
            ...((this._prefillConfig as any) || {}),
            ...(formValue as any),
          };

          const payload: PatchZaakBesluitConfig = {
            besluitUrl: combined.besluitUrl,
          };

          this.propertyList.forEach(property => {
            (payload as any)[property] = combined[property];
          });

          this.configuration.emit(payload);
        });
    });
  }
}
