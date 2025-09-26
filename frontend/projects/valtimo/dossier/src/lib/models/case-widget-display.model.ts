enum CaseWidgetDisplayTypeKey {
  TEXT = 'text',
  BOOLEAN = 'boolean',
  CURRENCY = 'currency',
  DATE = 'date',
  DATE_TIME = 'datetime',
  ENUM = 'enum',
  NUMBER = 'number',
  PERCENT = 'percent',
}

interface CaseWidgetTextDisplayType {
  type: CaseWidgetDisplayTypeKey.TEXT;
  ellipsisCharacterLimit: number;
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

interface CaseWidgetDateTimeDisplayType {
  type: CaseWidgetDisplayTypeKey.DATE_TIME;
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
  | CaseWidgetTextDisplayType
  | CaseWidgetBooleanDisplayType
  | CaseWidgetCurrencyDisplayType
  | CaseWidgetDateDisplayType
  | CaseWidgetDateTimeDisplayType
  | CaseWidgetEnumDisplayType
  | CaseWidgetNumberDisplayType
  | CaseWidgetPercentDisplayType;

export {
  CaseWidgetBooleanDisplayType,
  CaseWidgetCurrencyDisplayType,
  CaseWidgetDateDisplayType,
  CaseWidgetDateTimeDisplayType,
  CaseWidgetDisplayType,
  CaseWidgetDisplayTypeKey,
  CaseWidgetEnumDisplayType,
  CaseWidgetNumberDisplayType,
  CaseWidgetPercentDisplayType,
  CaseWidgetTextDisplayType,
};
