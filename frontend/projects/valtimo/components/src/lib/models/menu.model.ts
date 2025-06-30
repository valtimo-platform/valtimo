import {MenuItem} from '@valtimo/shared';
import {Observable} from 'rxjs';

type AppendMenuItemsFunction = (items: MenuItem[]) => Observable<MenuItem[]>;

export {AppendMenuItemsFunction};
