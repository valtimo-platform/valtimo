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
import {CommonModule} from '@angular/common';
import {Component, OnDestroy, OnInit} from '@angular/core';
import {
  CARBON_CONSTANTS,
  CarbonListModule,
  ColumnConfig,
  PageTitleService,
  SelectItem,
  SelectModule,
  ValtimoCdsModalDirective,
} from '@valtimo/components';
import {IkoManagementApiService} from '../../services';
import {
  BehaviorSubject,
  combineLatest,
  filter,
  Observable,
  Subject,
  Subscription,
  switchMap,
  tap,
} from 'rxjs';
import {Router} from '@angular/router';
import {map} from 'rxjs/operators';
import {
  ButtonModule,
  IconModule,
  InputModule,
  LayerModule,
  ModalModule,
  TabsModule,
} from 'carbon-components-angular';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {IkoRepositoryConfigListResponse, PropertyField} from '../../models';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'valtimo-iko-management-api',
  standalone: true,
  templateUrl: './iko-management-api.component.html',
  imports: [
    CommonModule,
    CarbonListModule,
    TabsModule,
    TranslateModule,
    ModalModule,
    ButtonModule,
    IconModule,
    FormsModule,
    InputModule,
    ReactiveFormsModule,
    ValtimoCdsModalDirective,
    LayerModule,
    SelectModule,
  ],
  styleUrl: './iko-management-api.component.scss',
})
export class IkoManagementApiComponent implements OnInit, OnDestroy {
  public readonly openModal$: BehaviorSubject<boolean> = new BehaviorSubject(false);

  public readonly disabled$ = new BehaviorSubject(true);
  public readonly loading$ = new BehaviorSubject<boolean>(true);
  private readonly _reload$ = new BehaviorSubject<null>(null);

  public readonly apiConfigs$ = this._reload$.pipe(
    switchMap(() => this.ikoManagementApiService.getIkoRepositoryConfigs()),
    map(res => res.content),
    tap(() => this.loading$.next(false))
  );

  public readonly FIELDS: ColumnConfig[] = [
    {
      key: 'title',
      label: 'ikoManagement.title',
    },
  ];

  public readonly form = this.formBuilder.group({
    title: this.formBuilder.control('', [Validators.required]),
    key: this.formBuilder.control('', [Validators.required]),
    type: this.formBuilder.control('', [Validators.required]),
    pluginId: this.formBuilder.control('', [Validators.required]),
  });

  public readonly clearTypeSelection$ = new Subject<null>();
  private readonly _ikoRepositoryTypes$ = this.ikoManagementApiService.getIkoRepositoryTypes();
  public readonly ikoRepositoryTypeSelectItems$: Observable<SelectItem[]> =
    this._ikoRepositoryTypes$.pipe(
      map(types => Object.keys(types).map(typeKey => ({id: typeKey, text: types[typeKey]}))),
      tap(() => {
        this.disabled$.next(false);
      })
    );

  public readonly clearPluginIdSelection$ = new Subject<null>();
  public readonly pluginSelectItems$: Observable<SelectItem[]> = this.form
    .get('type')
    .valueChanges.pipe(
      filter(type => !!type),
      tap(() => this.clearPluginIdSelection$.next(null)),
      switchMap(type =>
        combineLatest([
          this.ikoManagementApiService.getIkoRepositoryConfigPropertyFields(type),
          this.translateService.stream('key'),
        ])
      ),
      map(
        ([res]) =>
          (res as PropertyField[])?.reduce((acc, curr) => {
            return [
              ...acc,
              ...curr.dropdownList.map(field => ({
                id: field.first,
                text: field.second,
              })),
            ];
          }, []) || []
      ),
      tap(() => {
        this.disabled$.next(false);
      })
    );

  private readonly _subscriptions = new Subscription();

  constructor(
    private readonly ikoManagementApiService: IkoManagementApiService,
    private readonly pageTitleService: PageTitleService,
    private readonly router: Router,
    private readonly formBuilder: FormBuilder,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this.pageTitleService.disableReset();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this.pageTitleService.enableReset();
  }

  public onRowClicked(event: IkoRepositoryConfigListResponse): void {
    this.router.navigate(['iko-management', event.key]);
  }

  public openModal(): void {
    this.openModal$.next(true);
  }

  public closeModal(): void {
    this.openModal$.next(false);

    setTimeout(() => {
      this.form.reset();
      this.clearPluginIdSelection$.next(null);
      this.clearPluginIdSelection$.next(null);
    }, CARBON_CONSTANTS.modalAnimationMs);
  }

  public getControlInvalid(controlKey: string): boolean {
    const control: AbstractControl | null = this.form.get(controlKey);

    if (!control) {
      return true;
    }

    return !control.valid && !control.pristine;
  }

  public onPluginIdSelect(pluginId: string): void {
    this.form.patchValue({
      pluginId,
    });
  }

  public onTypeSelect(type: string): void {
    this.form.patchValue({
      type,
    });
  }

  public createApiConfig(): void {
    const formValue = this.form.getRawValue();

    this.disable();

    this.ikoManagementApiService
      .createIkoRepositoryConfig(formValue.key, {
        title: formValue.title,
        key: formValue.key,
        type: formValue.type,
        properties: {
          pluginConfiguration: formValue.pluginId,
        },
      })
      .subscribe({
        next: () => {
          this.enable();
          this.closeModal();
          this.reload();
        },
        error: () => this.enable(),
      });
  }

  private disable(): void {
    this.disabled$.next(true);
    this.form.disable();
  }

  private enable(): void {
    this.disabled$.next(false);
    this.form.enable();
  }

  private reload(): void {
    this.loading$.next(true);
    this._reload$.next(null);
  }
}
