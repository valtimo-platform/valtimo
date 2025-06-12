import {Inject, Injectable, Optional} from '@angular/core';
import {IKO_TOKEN, MenuItem} from '@valtimo/shared';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {IkoMenuItem} from '../../../models';
import {delay, map, tap} from 'rxjs/operators';

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
  private readonly _cachedMenuItems$ = new BehaviorSubject<IkoMenuItem[]>([]);

  public get cachedMenuItems$(): Observable<IkoMenuItem[]> {
    return this._cachedMenuItems$.asObservable();
  }

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

  public valueToBase64(value: object | string): string {
    const json =
      typeof value === 'string' ? JSON.stringify({__string: value}) : JSON.stringify(value);
    return btoa(json);
  }

  public base64ToValue<T = any>(base64: string): T | string {
    try {
      const decodedBase64 = decodeURIComponent(base64);
      const jsonString = atob(decodedBase64);
      const parsed = JSON.parse(jsonString);
      return parsed && typeof parsed === 'object' && '__string' in parsed
        ? parsed.__string
        : parsed;
    } catch {
      return base64;
    }
  }

  private getIkoSequenceAfterCases(menuItems: MenuItem[]): number {
    const casesItem = menuItems.find(item => item.title === 'Cases' || item.title === 'Dossiers');
    const casesSequence = Number(casesItem?.sequence ?? 0);
    return casesSequence + 0.5;
  }

  private getIkoMenuItems(): Observable<IkoMenuItem[]> {
    return of(mockIkoMenuItems).pipe(
      delay(1500),
      tap(items => this._cachedMenuItems$.next(items))
    );
  }
}
