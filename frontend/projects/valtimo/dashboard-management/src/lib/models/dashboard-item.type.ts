export interface DashboardItem {
  description: string;
  key: string;
  title?: string;
  name: string;
  roles: Array<string>;
  createdBy?: string;
  createdOn?: string;
}
