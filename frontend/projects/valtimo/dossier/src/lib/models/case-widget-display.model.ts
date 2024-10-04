enum CaseWidgetDisplayTypeKey {
  TEXT = 'text',
  BOOLEAN = 'boolean',
  CODE_LIST = 'codeList',
  CURRENCY = 'currency',
  DATE = 'date',
  DATE_TIME = 'datetime',
  ENUM = 'enum',
  NUMBER = 'number',
  PERCENT = 'percent',
}

interface CaseWidgetBooleanDisplayType {
  type: CaseWidgetDisplayTypeKey.BOOLEAN;
}

interface CaseWidgetCodeListDisplayType {
  type: CaseWidgetDisplayTypeKey.CODE_LIST;
  providerName: string;
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
  | CaseWidgetBooleanDisplayType
  | CaseWidgetCodeListDisplayType
  | CaseWidgetCurrencyDisplayType
  | CaseWidgetDateDisplayType
  | CaseWidgetDateTimeDisplayType
  | CaseWidgetEnumDisplayType
  | CaseWidgetNumberDisplayType
  | CaseWidgetPercentDisplayType;

export {
  CaseWidgetDisplayTypeKey,
  CaseWidgetDisplayType,
  CaseWidgetBooleanDisplayType,
  CaseWidgetCodeListDisplayType,
  CaseWidgetCurrencyDisplayType,
  CaseWidgetDateDisplayType,
  CaseWidgetDateTimeDisplayType,
  CaseWidgetEnumDisplayType,
  CaseWidgetNumberDisplayType,
  CaseWidgetPercentDisplayType,
};
