import {Injectable} from '@angular/core';
import {BehaviorSubject, Observable, of} from 'rxjs';
import {delay, map, tap} from 'rxjs/operators';
import {MenuItem} from '@valtimo/shared';
import {IkoMenuItem} from '../models';

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

  /**
   * Appends IKO menu items to the provided list, if not already present.
   */
  public appendIkoMenuItems = (menuItems: MenuItem[]): Observable<MenuItem[]> => {
    const ikoExists = menuItems.some(item => item.title === 'IKO');
    if (ikoExists) return of(menuItems);

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

        return [...menuItems, ikoMenu].sort((a, b) => a.sequence - b.sequence);
      })
    );
  };

  /**
   * Simulates an async API call for IKO menu items.
   */
  private getIkoMenuItems(): Observable<IkoMenuItem[]> {
    return of(mockIkoMenuItems).pipe(
      delay(1500), // Simulate API delay
      tap(items => this._cachedMenuItems$.next(items))
    );
  }

  private getIkoSequenceAfterCases(menuItems: MenuItem[]): number {
    const casesItem = menuItems.find(item => item.title === 'Cases' || item.title === 'Dossiers');
    const casesSequence = Number(casesItem?.sequence ?? 0);
    return casesSequence + 0.5;
  }

  public valueToBase64(value: object | string): string {
    let json: string;

    if (typeof value === 'string') {
      try {
        const decoded = this.base64UrlDecode(value);
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object' && '__string' in parsed) {
          return value;
        }
      } catch {}
      json = JSON.stringify({__string: value});
    } else {
      json = JSON.stringify(value);
    }

    return this.base64UrlEncode(json);
  }

  public base64ToValue<T = any>(encoded: string): T | string {
    try {
      let decoded = this.base64UrlDecode(encoded);
      let parsed = JSON.parse(decoded);

      if (parsed && typeof parsed === 'object') {
        return '__string' in parsed ? parsed.__string : parsed;
      }

      return parsed;
    } catch {
      return encoded;
    }
  }

  private base64UrlEncode(value: string): string {
    return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private base64UrlDecode(value: string): string {
    let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    return atob(base64);
  }
}
