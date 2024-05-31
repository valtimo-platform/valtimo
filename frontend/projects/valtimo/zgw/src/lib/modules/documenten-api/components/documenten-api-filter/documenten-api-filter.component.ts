import {CommonModule} from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import {FormBuilder, ReactiveFormsModule} from '@angular/forms';
import {ActivatedRoute, ParamMap} from '@angular/router';
import {TrashCan16} from '@carbon/icons';
import {TranslateModule, TranslateService} from '@ngx-translate/core';
import {ConfidentialityLevel} from '@valtimo/components';
import {DocumentService, DocumentType} from '@valtimo/document';
import {
  ButtonModule,
  DatePicker,
  DatePickerInputModule,
  DatePickerModule,
  DropdownModule,
  IconModule,
  IconService,
  InputModule,
  ListItem,
} from 'carbon-components-angular';
import flatpickr from 'flatpickr';
import {
  combineLatest,
  debounceTime,
  filter,
  map,
  Observable,
  startWith,
  Subscription,
  switchMap,
} from 'rxjs';
import {DocumentenApiFilterModel} from '../../models';
import {DocumentenApiTag} from '../../models/documenten-api-tag.model';
import {DocumentenApiTagService} from '../../services';

@Component({
  selector: 'valtimo-dossier-detail-tab-documenten-api-filter',
  templateUrl: './documenten-api-filter.component.html',
  styleUrls: ['./documenten-api-filter.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ButtonModule,
    DatePickerInputModule,
    DatePickerModule,
    DropdownModule,
    IconModule,
    InputModule,
    TranslateModule,
    ReactiveFormsModule,
  ],
})
export class DocumentenApiFilterComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('creationDateFrom') public readonly creationDateFromPicker: DatePicker;
  @ViewChild('creationDateTo') public readonly creationDateToPicker: DatePicker;
  @Output() public filterEvent = new EventEmitter<DocumentenApiFilterModel>();

  private readonly _subscriptions = new Subscription();
  private readonly _confidentialityLevels: Array<ConfidentialityLevel> = [
    'openbaar',
    'beperkt_openbaar',
    'intern',
    'zaakvertrouwelijk',
    'vertrouwelijk',
    'confidentieel',
    'geheim',
    'zeer_geheim',
  ];

  private readonly _filter$ = this.route.queryParamMap.pipe(
    map(queryParams => {
      let {sort, ...filter} = queryParams['params'];
      if (this.formGroup) {
        if (!!filter.trefwoorden) {
          filter = {...filter, trefwoorden: this.convertTrefwoordenParam(filter.trefwoorden)};
        }
        this.formGroup.patchValue(filter, {emitEvent: false});
      }
      return filter;
    })
  );

  public readonly confidentialityLevels$: Observable<ListItem[]> = combineLatest([
    this._filter$,
    this.translateService.stream('key'),
  ]).pipe(
    map(([filter]) =>
      this._confidentialityLevels.map((confidentialityLevel: ConfidentialityLevel) => ({
        content: this.translateService.instant(`document.${confidentialityLevel}`),
        selected: filter?.vertrouwelijkheidaanduiding === confidentialityLevel,
        id: confidentialityLevel,
      }))
    ),
    startWith([])
  );

  public readonly informationObjectTypes$: Observable<ListItem[]> = this.route.paramMap.pipe(
    filter((paramMap: ParamMap) => !!paramMap.get('documentDefinitionName')),
    switchMap((paramMap: ParamMap) =>
      combineLatest([
        this.documentService.getDocumentTypes(paramMap.get('documentDefinitionName') ?? ''),
        this._filter$,
      ])
    ),
    map(([types, filter]) =>
      types.map((type: DocumentType) => ({
        content: type.name,
        selected: filter?.informatieobjecttype === type.url,
        id: type.url,
      }))
    ),
    startWith([])
  );

  public readonly tags$: Observable<ListItem[]> = this.route.paramMap.pipe(
    filter((paramMap: ParamMap) => !!paramMap.get('documentDefinitionName')),
    switchMap((paramMap: ParamMap) =>
      combineLatest([
        this.documentenApiTagService.getTags(paramMap.get('documentDefinitionName') ?? ''),
        this.route.queryParamMap,
      ])
    ),
    map(([tags, queryParamMap]) => {
      const selectedTags = this.convertTrefwoordenParam(queryParamMap['params']?.trefwoorden).map(
        (item: ListItem) => item.content
      );
      return tags.map((tag: DocumentenApiTag) => ({
        content: tag.value,
        selected: selectedTags.includes(tag.value),
      }));
    }),
    startWith([])
  );

  public readonly formGroup = this.fb.group({
    auteur: this.fb.control(''),
    vertrouwelijkHeidaanduiding: this.fb.control({}),
    creatiedatumFrom: this.fb.control(''),
    creatiedatumTo: this.fb.control(''),
    informatieObjectType: this.fb.control({}),
    trefwoorden: this.fb.control([]),
    titel: this.fb.control(''),
  });

  constructor(
    private readonly documentService: DocumentService,
    private readonly fb: FormBuilder,
    private readonly iconService: IconService,
    private readonly route: ActivatedRoute,
    private readonly translateService: TranslateService,
    private readonly documentenApiTagService: DocumentenApiTagService
  ) {
    this.iconService.register(TrashCan16);
  }

  public ngOnInit(): void {
    this.openFormValueSubscription();
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public ngAfterViewInit(): void {
    const creationDateFromControlValue = this.formGroup.get('creatiedatumFrom')?.value;
    const creationDateToControlValue = this.formGroup.get('creatiedatumTo')?.value;

    if (!!creationDateFromControlValue) {
      this.creationDateFromPicker.writeValue([
        flatpickr.formatDate(new Date(creationDateFromControlValue), 'd-m-Y'),
      ]);
    }

    if (!!creationDateToControlValue) {
      this.creationDateToPicker.writeValue([
        flatpickr.formatDate(new Date(creationDateToControlValue), 'd-m-Y'),
      ]);
    }
  }

  public resetFilter(): void {
    this.creationDateFromPicker.writeValue([]);
    this.creationDateToPicker.writeValue([]);
    this.formGroup.reset();
  }

  public onDateSelected(control: 'createdTo' | 'createdFrom', event: any): void {
    if (control === 'createdFrom') {
      this.formGroup.get('creatiedatumFrom')?.patchValue(event);
      return;
    }

    this.formGroup.get('creatiedatumTo')?.patchValue(event);
  }

  private openFormValueSubscription(): void {
    this._subscriptions.add(
      this.formGroup.valueChanges.pipe(debounceTime(500)).subscribe(formValue => {
        this.filterEvent.emit({
          ...(!!formValue.auteur && {auteur: formValue.auteur}),
          ...(!!formValue.titel && {titel: formValue.titel}),
          ...(!!formValue.creatiedatumFrom && {
            creatiedatumFrom: flatpickr.formatDate(new Date(formValue.creatiedatumFrom), 'Y-m-d'),
          }),
          ...(!!formValue.creatiedatumTo && {
            creatiedatumTo: flatpickr.formatDate(new Date(formValue.creatiedatumTo), 'Y-m-d'),
          }),
          ...(!!(formValue.vertrouwelijkHeidaanduiding as ListItem)?.id && {
            vertrouwelijkheidaanduiding: (formValue.vertrouwelijkHeidaanduiding as ListItem).id,
          }),
          ...(!!(formValue.informatieObjectType as ListItem)?.id && {
            informatieobjecttype: (formValue.informatieObjectType as ListItem).id,
          }),
          ...(!!formValue.trefwoorden &&
            formValue.trefwoorden.length > 0 && {
              trefwoorden: (formValue.trefwoorden as ListItem[]).reduce(
                (acc, curr, index) => (index === 0 ? curr.content : `${acc},${curr.content}`),
                ''
              ),
            }),
        });
      })
    );
  }

  private convertTrefwoordenParam(stringArray: string | undefined): ListItem[] {
    if (!stringArray) return [];
    const array = stringArray.split(',');

    return array.map((content: string) => ({
      content,
      selected: true,
    }));
  }
}
