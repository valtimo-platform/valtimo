import { InjectionToken } from "@angular/core";
import { IQuickSearchService } from "../interfaces";

export const QUICK_SEARCH_SERVICE = new InjectionToken<IQuickSearchService<any>>(
  'QUICK_SEARCH_SERVICE'
)