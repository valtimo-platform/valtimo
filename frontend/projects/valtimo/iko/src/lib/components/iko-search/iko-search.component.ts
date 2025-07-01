import {Component, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {combineLatest, filter, map, Observable, of, switchMap} from 'rxjs';
import {PageTitleService} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, InputModule} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Search16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';
import {IkoApiService} from '../../services';
import {IkoDataRequestUser} from '../../models';

@Component({
  selector: 'valtimo-iko-search',
  standalone: true,
  templateUrl: './iko-search.component.html',
  styleUrls: ['./iko-search.component.scss'],
  imports: [
    CommonModule,
    InputModule,
    ButtonModule,
    IconModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class IkoSearchComponent implements OnDestroy {
  public readonly formValues: Record<string, string> = {};

  private readonly _key$ = this.route.params.pipe(
    map(params => params?.key),
    filter(key => !!key)
  );

  public readonly dataRequests$: Observable<IkoDataRequestUser[]> = this._key$.pipe(
    switchMap(key =>
      combineLatest([
        of(key),
        this.ikoApiService.cachedMenuItems$,
        this.ikoApiService.getIkoDataRequests(key),
      ])
    ),
    map(([key, menuItems, dataRequests]) => {
      const currentMenuItem = menuItems.find(item => item.key === key);

      if (currentMenuItem && currentMenuItem?.title) {
        this.pageTitleService.setCustomPageTitle(currentMenuItem.title, true);
      }

      return dataRequests;
    })
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly pageTitleService: PageTitleService,
    private readonly iconService: IconService,
    private readonly ikoApiService: IkoApiService
  ) {
    this.iconService.register(Search16);
  }

  public ngOnDestroy(): void {
    this.pageTitleService.enableReset();
  }

  public hasAnyInput(params: {key: string}[]): boolean {
    return params.some(param => !!this.formValues[param.key]);
  }

  public isQueryGroup(param: any): param is {group: true; fields: any[]} {
    return param && param.group === true && Array.isArray(param.fields);
  }

  public searchGroup(params: {key: string}[]): void {
    const query: Record<string, string> = {};
    for (const param of params) {
      const value = this.formValues[param.key];
      if (value) {
        query[param.key] = value;
      }
    }

    console.log('Search triggered with:', query);
    // Actual search logic goes here
  }
}
