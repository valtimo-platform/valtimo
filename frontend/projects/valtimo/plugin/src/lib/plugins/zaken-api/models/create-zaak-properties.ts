export const ExtraPropertiesOptions = ['description', 'plannedEndDate', 'finalDeliveryDate'] as const;
export type ExtraProperties = typeof ExtraPropertiesOptions[number];
