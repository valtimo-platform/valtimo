export interface CarbonPaginationConfig {
  itemsPerPageOptions?: number[];
  showPageInput?: boolean;
}

const defaultPaginationConfig: CarbonPaginationConfig = {
  itemsPerPageOptions: [10, 20, 30, 40, 50],
  showPageInput: true,
};

export const createPaginationConfig = (
  config?: CarbonPaginationConfig
): CarbonPaginationConfig => ({
  ...defaultPaginationConfig,
  ...config,
});
