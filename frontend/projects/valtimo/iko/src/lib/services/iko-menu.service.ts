import {Injectable} from '@angular/core';
import {Observable, of} from 'rxjs';
import {map} from 'rxjs/operators';
import {MenuItem} from '@valtimo/shared';
import {IkoApiService} from './iko-api.service';

@Injectable({providedIn: 'root'})
export class IkoMenuService {
  constructor(private readonly ikoApiService: IkoApiService) {}

  public appendIkoMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    const ikoExists = menuItems.some(item => item.title === 'IKO');
    if (ikoExists) return of(menuItems);

    return this.ikoApiService.getIkoDataAggregates().pipe(
      map(ikoItems => {
        this.ikoApiService.setCachedMenuItems(ikoItems.content);

        const ikoSubMenu: MenuItem[] = ikoItems.content.map((item, index) => ({
          link: ['/iko', item.key],
          title: item.title,
          sequence: index,
          show: true,
        }));

        const ikoMenu: MenuItem = {
          title: 'IKO',
          iconClass: 'icon mdi mdi-account',
          show: true,
          sequence: this.getIkoSequenceAfterCases(menuItems),
          children: ikoSubMenu,
        };

        return [...menuItems, ikoMenu].sort((a, b) => a.sequence - b.sequence);
      })
    );
  };

  private getIkoSequenceAfterCases(menuItems: MenuItem[]): number {
    const casesItem = menuItems.find(item => item.title === 'Cases' || item.title === 'Dossiers');
    const casesSequence = Number(casesItem?.sequence ?? 0);
    return casesSequence + 0.5;
  }
}
