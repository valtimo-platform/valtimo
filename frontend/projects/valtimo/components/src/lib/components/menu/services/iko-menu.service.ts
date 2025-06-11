import {Inject, Injectable, Optional} from '@angular/core';
import {IKO_TOKEN, MenuItem} from '@valtimo/shared';
import {Observable, of} from 'rxjs';
import {IkoMenuItem} from '../../../models';
import {delay, map} from 'rxjs/operators';

const mockIkoMenuItems: IkoMenuItem[] = [
  {
    title: 'Person',
    profile: {
      url: 'https://iko.example.com/person/profile',
      identifierColumn: 'personId',
    },
    queryParams: [
      {
        placeholder: 'Enter BSN or name',
        title: 'Search by BSN or name',
        key: 'bsn',
      },
    ],
  },
  {
    title: 'Object',
    profile: {
      url: 'https://iko.example.com/object/details',
      identifierColumn: 'objectCode',
    },
    queryParams: [
      {
        placeholder: 'Enter object code',
        title: 'Search by object code',
        key: 'code',
      },
      {
        placeholder: 'Enter postcode',
        title: 'Search by postcode',
        key: 'postcode',
      },
    ],
  },
  {
    title: 'Company',
    profile: {
      url: 'https://iko.example.com/company/info',
      identifierColumn: 'kvkNumber',
    },
    queryParams: [
      {
        placeholder: 'Enter KvK number',
        title: 'Search by KvK number',
        key: 'kvk',
      },
      {
        placeholder: 'Enter company name',
        title: 'Search by company name',
        key: 'name',
      },
    ],
  },
];

@Injectable({providedIn: 'root'})
export class IkoMenuService {
  constructor(@Optional() @Inject(IKO_TOKEN) private readonly ikoEnabled: boolean) {}

  public appendIkoMenuItems(menuItems: MenuItem[]): Observable<MenuItem[]> {
    const ikoAlreadyExists = menuItems.some(item => item.title === 'IKO');
    const shouldAdd = !ikoAlreadyExists && this.ikoEnabled;

    if (!shouldAdd) return of(menuItems);

    return this.getIkoMenuItems().pipe(
      map(ikoItems => {
        const ikoSubMenu: MenuItem[] = ikoItems.map((item, index) => ({
          link: ['/iko', this.valueToBase64(item.profile.url)],
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

        menuItems.push(ikoMenu);
        menuItems.sort((a, b) => a.sequence - b.sequence);

        return menuItems;
      })
    );
  }

  private getIkoSequenceAfterCases(menuItems: MenuItem[]): number {
    const casesItem = menuItems.find(item => item.title === 'Cases' || item.title === 'Dossiers');
    const casesSequence = Number(casesItem?.sequence ?? 0);
    return casesSequence + 0.5;
  }

  private getIkoMenuItems(): Observable<IkoMenuItem[]> {
    return of(mockIkoMenuItems).pipe(delay(500));
  }

  private valueToBase64(value: object | string): string {
    const json =
      typeof value === 'string' ? JSON.stringify({__string: value}) : JSON.stringify(value);
    return btoa(json);
  }

  private base64ToValue<T = any>(base64: string): T | string {
    const parsed = JSON.parse(atob(base64));
    return parsed && typeof parsed === 'object' && '__string' in parsed ? parsed.__string : parsed;
  }
}
