export interface DashboardItem {
  description: string;
  key: string;
  title: string;
  roles?: Array<string>;
  createdBy?: string;
  createdOn?: string;
}
