import {Component, OnDestroy} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ActivatedRoute} from '@angular/router';
import {combineLatest, filter, map, Observable, tap} from 'rxjs';
import {IkoMenuItem, IkoMenuService, MenuService, PageTitleService} from '@valtimo/components';
import {ButtonModule, IconModule, IconService, InputModule} from 'carbon-components-angular';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {Search16} from '@carbon/icons';
import {TranslateModule} from '@ngx-translate/core';

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

  private readonly _profileUrl$ = this.route.params.pipe(
    map(params => params?.profileUrl),
    filter(url => !!url),
    map(url => this.ikoMenuService.base64ToValue(url))
  );

  public readonly ikoMenuItem$: Observable<IkoMenuItem> = combineLatest([
    this._profileUrl$,
    this.ikoMenuService.cachedMenuItems$,
  ]).pipe(
    map(([profileUrl, cachedMenuItems]) =>
      cachedMenuItems.find(item => item.profile.url === profileUrl)
    ),
    tap(menuItem => {
      if (menuItem?.title) {
        this.pageTitleService.setCustomPageTitle(menuItem.title, true);
      }

      this.menuService.reload();
    })
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly ikoMenuService: IkoMenuService,
    private readonly pageTitleService: PageTitleService,
    private readonly iconService: IconService,
    private readonly menuService: MenuService
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
