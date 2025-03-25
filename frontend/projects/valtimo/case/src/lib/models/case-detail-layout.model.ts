import {FormSize} from '@valtimo/process-link';

type CaseDetailLayoutUnit = 'pixel' | 'percent';

interface CaseDetailLayout {
  unit: CaseDetailLayoutUnit;
  widthAdjustable: boolean;
  showRightPanel?: boolean;
  leftPanelWidth?: number | '*';
  leftPanelMinWidth?: number;
  leftPanelMaxWidth?: number;
  rightPanelWidth?: number | '*';
  rightPanelMinWidth?: number;
  rightPanelMaxWidth?: number;
}

type RightPanelMinWidths = {
  [key in FormSize]: number;
};

export {CaseDetailLayout, CaseDetailLayoutUnit, RightPanelMinWidths};
