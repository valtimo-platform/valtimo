enum CaseWidgetDisplayTypeKey {
  TEXT = 'text',
  BOOLEAN = 'boolean',
  CURRENCY = 'currency',
  DATE = 'date',
  ENUM = 'enum',
  NUMBER = 'number',
  PERCENT = 'percent',
}

interface CaseWidgetBooleanDisplayType {
  type: CaseWidgetDisplayTypeKey.BOOLEAN;
}

interface CaseWidgetCurrencyDisplayType {
  type: CaseWidgetDisplayTypeKey.CURRENCY;
  currencyCode?: string;
  display?: string;
  digitsInfo?: string;
}

interface CaseWidgetDateDisplayType {
  type: CaseWidgetDisplayTypeKey.DATE;
  format?: string;
}

interface CaseWidgetEnumDisplayType {
  type: CaseWidgetDisplayTypeKey.ENUM;
  values: {
    [key: string]: string;
  };
}

interface CaseWidgetNumberDisplayType {
  type: CaseWidgetDisplayTypeKey.NUMBER;
  digitsInfo?: string;
}

interface CaseWidgetPercentDisplayType {
  type: CaseWidgetDisplayTypeKey.PERCENT;
  digitsInfo?: string;
}

type CaseWidgetDisplayType =
  | CaseWidgetBooleanDisplayType
  | CaseWidgetCurrencyDisplayType
  | CaseWidgetDateDisplayType
  | CaseWidgetEnumDisplayType
  | CaseWidgetNumberDisplayType
  | CaseWidgetPercentDisplayType;

export {
  CaseWidgetDisplayTypeKey,
  CaseWidgetDisplayType,
  CaseWidgetBooleanDisplayType,
  CaseWidgetCurrencyDisplayType,
  CaseWidgetDateDisplayType,
  CaseWidgetEnumDisplayType,
  CaseWidgetNumberDisplayType,
  CaseWidgetPercentDisplayType,
};
