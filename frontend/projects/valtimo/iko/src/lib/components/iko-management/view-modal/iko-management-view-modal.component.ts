import {CommonModule} from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import {AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {TranslateModule} from '@ngx-translate/core';
import {CARBON_CONSTANTS, ValtimoCdsModalDirective, runAfterCarbonModalClosed, AutoKeyInputComponent,} from '@valtimo/components';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
  ModalModule,
} from 'carbon-components-angular';
import {BehaviorSubject, filter, Observable, switchMap, take} from 'rxjs';
import {
  PropertyField,
  IkoDataAggregateResponse,
  IkoRepositoryConfigResponse,
} from '../../../models';
import {IkoManagementApiService} from '../../../services';
import {PropertiesFormComponent} from '../../iko-management-properties/iko-management-properties.component';
import {ModalMode} from '@valtimo/shared';

@Component({
  selector: 'valtimo-iko-management-view-modal',
  templateUrl: './iko-management-view-modal.component.html',
  styleUrl: './iko-management-view-modal.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    TranslateModule,
    ModalModule,
    ValtimoCdsModalDirective,
    InputModule,
    ReactiveFormsModule,
    ButtonModule,
    IconModule,
    PropertiesFormComponent,
    LayerModule,
    AutoKeyInputComponent
  ],
})
export class IkoManagementViewModalComponent {
  private readonly _open$ = new BehaviorSubject<boolean>(false);

  @Input() public set open(value: boolean) {
    this._open$.next(value);

    value ? (this.showAutoKey = true) : this.resetForm();
  }

  public get open$(): Observable<boolean> {
    return this._open$.asObservable();
  }

  private readonly _apiKey$ = new BehaviorSubject<string | null>(null);

  @Input() public set apiKey(value: string | null) {
    if (!value) return;

    this._apiKey$.next(value);
  }

  public readonly $prefillData = signal<IkoDataAggregateResponse | null>(null);
  public readonly $selectedKey = signal<string>('');

  @Input() public set prefillData(value: IkoDataAggregateResponse | null) {
    this.$prefillData.set(value);
    if (!value) return;

    this.$selectedKey.set(value.key);
    this.$modalMode.set('edit');
    this.formGroup.patchValue(value);
    this.formGroup.get('key')?.disable();
  }

  @Input() public usedKeys: string[] = [];

  @Output() public readonly modalClose = new EventEmitter<any | null>();

  public get title(): AbstractControl<string> {
    return this.formGroup.get('title') as AbstractControl<string>;
  }

  public readonly $modalMode = signal<ModalMode>('add');
  public showAutoKey = true;

  public readonly propertyFields$: Observable<PropertyField[]> = this.open$.pipe(
    filter((open: boolean) => !!open),
    switchMap(() => this._apiKey$),
    switchMap((repositoryKey: string | null) =>
      this.ikoManagementApiService.getIkoDataAggregateType(repositoryKey ?? '')
    ),
    switchMap((repository: IkoRepositoryConfigResponse) =>
      this.ikoManagementApiService.getIkoDataAggregatePropertyFields(repository.type)
    )
  );

  public formGroup = this.fb.group({
    title: this.fb.control('', Validators.required),
    key: this.fb.control('', Validators.required),
    properties: this.fb.group({}, Validators.required),
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly ikoManagementApiService: IkoManagementApiService,
  ) {}

  public get properties(): FormGroup | null {
    const properties = this.formGroup.get('properties');
    return !properties ? null : (properties as FormGroup);
  }

  public onCancel(): void {
    this.modalClose.emit(null);
    runAfterCarbonModalClosed(() => {
      this.$modalMode.set('add');
      this.showAutoKey = false;
    });
  }

  public onSave(): void {
    this.propertyFields$.pipe(take(1)).subscribe(fields => {
      const formData = this.formGroup.getRawValue();
      fields.forEach(field => {
        if (formData.properties[field.key] && field.type === 'keyValueList') {
          formData.properties[field.key] = Array.isArray(formData.properties[field.key])
            ? formData.properties[field.key].reduce((acc: Record<string, any>, cur: any) => {
                if (cur.key) {
                  acc[cur.key] = cur.value;
                }
                return acc;
              }, {})
            : {};
        }
      });
      this.modalClose.emit(formData);
      this.$modalMode.set('add');
      this.showAutoKey = false;
    });
  }

  private resetForm(): void {
    setTimeout(() => {
      this.formGroup.reset({
        title: '',
        key: '',
        properties: {},
      });
      this.formGroup.get('key')?.enable();
    }, CARBON_CONSTANTS.modalAnimationMs);
  }
}
