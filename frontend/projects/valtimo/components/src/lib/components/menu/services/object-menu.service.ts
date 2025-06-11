import {Injectable} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs';
import {MenuItem} from '@valtimo/shared';

@Injectable({providedIn: 'root'})
export class ObjectMenuService {
  public appendObjectsSubMenuItems(
    menuItems: MenuItem[],
    apiBaseUrl: string,
    http: HttpClient
  ): Observable<MenuItem[]> {
    return new Observable(subscriber => {
      this.getObjects(apiBaseUrl, http).subscribe(objects => {
        const visibleObjects = objects.filter(obj => obj?.showInDataMenu !== false);

        const objectItems: MenuItem[] = visibleObjects.map((obj, index) => ({
          link: ['/objects/' + obj.id],
          title: obj.title,
          iconClass: 'icon mdi mdi-dot-circle',
          sequence: index,
          show: true,
        }));

        const index = menuItems.findIndex(i => i.title === 'Objects');
        if (index >= 0) {
          menuItems[index].children = objectItems;
        }

        subscriber.next(menuItems);
      });
    });
  }

  private getObjects(apiBaseUrl: string, http: HttpClient): Observable<any[]> {
    const url = `${apiBaseUrl}v1/object/management/configuration`;
    return http.get<any[]>(url);
  }
}
