import {Injector} from '@angular/core';
import {FormioCustomComponentInfo, registerCustomFormioComponent} from '../../../modules';
import {FormioDummyComponent} from './dummy.component';

const COMPONENT_OPTIONS: FormioCustomComponentInfo = {
  type: 'dummy',
  selector: 'valtimo-dummy',
  title: 'Dummy',
  group: 'none',
  icon: 'bank',
  schema: {
    hidden: true,
    label: 'Dummy component',
    key: 'dummy',
    hideLabel: false,
    tableView: true,
  },
};

export function enableCustomFormioComponents(injector: Injector) {
  registerCustomFormioComponent(COMPONENT_OPTIONS, FormioDummyComponent, injector);
}
