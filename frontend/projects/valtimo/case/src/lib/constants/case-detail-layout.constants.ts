import {FormDisplayType, FormSize} from '@valtimo/process-link';
import {RightPanelMinWidths} from '../models';

const CASE_DETAIL_GUTTER_SIZE = 32;

const CASE_DETAIL_TASK_LIST_WIDTH = 412;

const CASE_DETAIL_LEFT_PANEL_MIN_WIDTH = 320;

const CASE_DETAIL_RIGHT_PANEL_MIN_WIDTHS: RightPanelMinWidths = {
  extraSmall: 240,
  small: 320,
  medium: 480,
  large: 640,
};

const CASE_DETAIL_DEFAULT_DISPLAY_TYPE: FormDisplayType = 'modal';
const CASE_DETAIL_DEFAULT_DISPLAY_SIZE: FormSize = 'medium';

const CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH = {
  small: 250,
  medium: 350,
  large: 450,
};

export {
  CASE_DETAIL_GUTTER_SIZE,
  CASE_DETAIL_LEFT_PANEL_MIN_WIDTH,
  CASE_DETAIL_RIGHT_PANEL_MIN_WIDTHS,
  CASE_DETAIL_TASK_LIST_WIDTH,
  CASE_DETAIL_DEFAULT_DISPLAY_TYPE,
  CASE_DETAIL_DEFAULT_DISPLAY_SIZE,
  CASE_DETAIL_START_PROCESS_DROPDOWN_WIDTH,
};
