import {Component, OnDestroy} from '@angular/core';
import {BehaviorSubject, combineLatest, Observable, of, Subscription} from 'rxjs';
import {FormDisplayType, FormSize} from '../../models';
import {TranslateService} from '@ngx-translate/core';
import {ProcessLinkStateService} from '../../services';
import {ListItem} from 'carbon-components-angular';
import {map} from 'rxjs/operators';

@Component({
  selector: 'valtimo-form-display-configuration',
  templateUrl: './form-display-configuration.component.html',
})
export class FormDisplayConfigurationComponent implements OnDestroy {
  public formDisplayValue$ = new BehaviorSubject<FormDisplayType | null>(null);
  public formSizeValue$ = new BehaviorSubject<FormSize | null>(null);

  private readonly _DISPLAY_TYPE_OPTIONS: FormDisplayType[] = ['modal', 'panel'];
  private readonly _FORM_SIZE_OPTIONS: FormSize[] = ['extraSmall', 'small', 'medium', 'large'];
  private readonly _subscriptions = new Subscription();

  public readonly formDisplayTypeListItems$: Observable<ListItem[]> = combineLatest([
    of(this._DISPLAY_TYPE_OPTIONS),
    this.translateService.stream('key'),
  ]).pipe(
    map(([displayTypeOptions]) =>
      displayTypeOptions.map(key => ({
        content: this.translateService.instant(`processLinkSteps.displayType.options.${key}`),
        key: key,
        selected: false,
      }))
    )
  );

  public readonly formSizeListItems$: Observable<ListItem[]> = combineLatest([
    of(this._FORM_SIZE_OPTIONS),
    this.translateService.stream('key'),
  ]).pipe(
    map(([formSizeOptions]) =>
      formSizeOptions.map(key => ({
        content: this.translateService.instant(`processLinkSteps.formSize.options.${key}`),
        key: key,
        selected: false,
      }))
    )
  );

  constructor(
    private readonly stateService: ProcessLinkStateService,
    private readonly translateService: TranslateService
  ) {}

  public ngOnInit(): void {
    this._subscriptions.add(
      this.stateService.selectedProcessLink$.subscribe(selectedProcessLink => {
        if (selectedProcessLink) {
          this.formDisplayValue$.next(selectedProcessLink.formDisplayType);
          this.formSizeValue$.next(selectedProcessLink.formSize);
        }
      })
    );
  }

  public ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  public selectFormDisplayType(event): void {
    if (event.id) {
      this.formDisplayValue$.next(event.id);
    } else {
      this.formDisplayValue$.next(null);
    }
  }

  public selectFormSize(event): void {
    if (event.id) {
      this.formSizeValue$.next(event.id);
    } else {
      this.formSizeValue$.next(null);
    }
  }
}
