import {Inject, Injectable, Optional} from '@angular/core';
import {IKO_TOKEN, MenuItem} from '@valtimo/shared';
import {Observable, of} from 'rxjs';

@Injectable({providedIn: 'root'})
export class IkoMenuService {
  constructor(@Optional() @Inject(IKO_TOKEN) private readonly ikoEnabled: boolean) {}

  public appendIkoMenuItems(menuItems: MenuItem[]): Observable<MenuItem[]> {
    const ikoAlreadyExists = menuItems.some(item => item.title === 'IKO');

    if (!ikoAlreadyExists && this.ikoEnabled) {
      const ikoMenu: MenuItem = {
        title: 'IKO',
        iconClass: 'icon mdi mdi-account',
        show: true,
        sequence: this.getIkoSequenceAfterCases(menuItems),
        children: [
          {
            link: ['/iko/person'],
            title: 'Person',
            sequence: 0,
            show: true,
          },
          {
            link: ['/iko/object'],
            title: 'Object',
            sequence: 1,
            show: true,
          },
        ],
      };

      menuItems.push(ikoMenu);
      menuItems.sort((a, b) => a.sequence - b.sequence);
    }

    return of(menuItems);
  }

  private getIkoSequenceAfterCases(menuItems: MenuItem[]): number {
    const casesItem = menuItems.find(item => item.title === 'Cases' || item.title === 'Dossiers');
    const casesSequence = Number(casesItem?.sequence) ?? 0;

    return casesSequence + 0.5;
  }
}
