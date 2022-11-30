import {Pipe, PipeTransform} from '@angular/core';
import {MenuItem} from '@valtimo/config';
import {combineLatest, map, Observable} from 'rxjs';
import {TranslateService} from '@ngx-translate/core';

@Pipe({name: 'menuItemTranslate'})
export class MenuItemTranslationPipe implements PipeTransform {
  constructor(private readonly translateService: TranslateService) {}

  transform(menuItem: MenuItem): Observable<string> {
    const pageTranslationKey = 'pages.' + menuItem.title.toLowerCase() + '.title';
    const titleTranslationKey = menuItem.title;

    return combineLatest([
      this.translateService.stream(pageTranslationKey),
      this.translateService.stream(titleTranslationKey),
    ]).pipe(
      map(([pageTranslation, menuItemTitleTranslation]) => {
        if (pageTranslation !== pageTranslationKey) {
          return pageTranslation;
        } else if (menuItemTitleTranslation !== titleTranslationKey) {
          return menuItemTitleTranslation;
        } else {
          return menuItem.title;
        }
      })
    );
  }
}
