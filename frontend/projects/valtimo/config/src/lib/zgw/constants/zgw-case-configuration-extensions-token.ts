import {InjectionToken, Type} from '@angular/core';

const ZGW_CASE_CONFIGURATION_EXTENSIONS_TOKEN = new InjectionToken<Type<any>[]>(
  'Specify components to display on on the case management configuration page.'
);

export {ZGW_CASE_CONFIGURATION_EXTENSIONS_TOKEN};
