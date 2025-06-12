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
        group: true,
        fields: [
          {placeholder: 'Enter first name', title: 'First name', key: 'firstName'},
          {placeholder: 'Enter last name', title: 'Last name', key: 'lastName'},
        ],
      },
      {
        placeholder: 'Enter BSN',
        title: 'BSN',
        key: 'bsn',
      },
      {
        placeholder: 'Enter birth date',
        title: 'Birth date',
        key: 'birthDate',
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
        title: 'KvK number',
        key: 'kvk',
      },
      {
        group: true,
        fields: [
          {placeholder: 'Enter company name', title: 'Company name', key: 'companyName'},
          {placeholder: 'Enter contact email', title: 'Contact email', key: 'email'},
        ],
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

  public base64ToValue<T = any>(encoded: string): T | string {
    try {
      const json = atob(encoded); // No decodeURIComponent
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' && '__string' in parsed
        ? parsed.__string
        : parsed;
    } catch {
      return encoded;
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
