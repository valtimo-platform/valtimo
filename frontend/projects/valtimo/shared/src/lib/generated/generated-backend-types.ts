/* tslint:disable */
/* eslint-disable */
// Generated using typescript-generator version 3.2.1263 on 2025-11-05 09:28:48.

export interface BuildingBlockDefinitionDto {
  key: string;
  versionTag: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdDate: DateAsString | null;
  basedOnVersionTag: string | null;
  final: boolean;
}

export interface BuildingBlockProcessDefinitionDto {
  id: string;
  key: string;
  name: string | null;
  versionTag: string | null;
  main: boolean;
}

export interface BuildingBlockProcessDefinitionWithLinksDto {
  processDefinition: ProcessDefinitionWithPropertiesDto;
  processLinks: ProcessLinkResponseDto[];
  bpmn20Xml: string;
}

export interface CreateBuildingBlockDefinitionDto {
  key: string;
  versionTag: string;
  name: string;
  description: string | null;
}

export interface UpdateBuildingBlockDefinitionDto {
  name: string;
  description: string | null;
}

export interface CaseDefinitionCheckResponse {
  canUpdateGlobalConfiguration: boolean;
}

export interface CaseDefinitionDraftCreateRequest {
  caseDefinitionKey: string;
  caseDefinitionVersion: string;
  name: string | null;
  description: string | null;
  basedOnCaseDefinitionVersion: string | null;
  basedOnCaseDefinitionId: CaseDefinitionId | null;
  caseDefinitionId: CaseDefinitionId;
}

export interface CaseDefinitionQuickSearchDto {
  queryPath: string;
  title: string;
}

export interface CaseDefinitionResponseDto {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdDate: DateAsString | null;
  basedOnVersionTag: string | null;
  final: boolean;
  active: boolean;
  canHaveAssignee: boolean;
  autoAssignTasks: boolean;
  hasExternalStartForm: boolean | null;
  externalStartFormUrl: string | null;
  externalStartFormDescription: string | null;
  conflictingVersions: string | null;
}

export interface CaseDefinitionSettingsResponseDto {
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  canHaveAssignee: boolean;
  autoAssignTasks: boolean;
  hasExternalStartForm: boolean | null;
  externalStartFormUrl: string | null;
  externalStartFormDescription: string | null;
}

export interface CaseDefinitionUpdateRequest {
  name: string | null;
  description: string | null;
}

export interface CaseListColumnDto {
  title: string | null;
  key: string;
  path: string;
  displayType: any;
  sortable: boolean;
  defaultSort: ColumnDefaultSort | null;
  order: number | null;
  exportable: boolean;
}

export interface CaseListRowDto {
  id: string;
  items: CaseListItemDto[];
}

export interface CaseSettingsDto {
  canHaveAssignee: boolean | null;
  autoAssignTasks: boolean | null;
  hasExternalStartForm: boolean | null;
  externalStartFormUrl: string | null;
  externalStartFormDescription: string | null;
}

export interface CaseTabDto {
  key: string;
  name: string | null;
  type: CaseTabType;
  contentKey: string;
  showTasks: boolean;
}

export interface CaseTabUpdateDto {
  name: string | null;
  type: CaseTabType;
  contentKey: string;
  showTasks: boolean;
}

export interface CaseTabUpdateOrderDto {
  key: string;
  name: string | null;
  type: CaseTabType;
  contentKey: string;
  showTasks: boolean;
}

export interface CaseTabWithMetadataDto {
  key: string;
  name: string | null;
  type: CaseTabType;
  contentKey: string;
  createdOn: DateAsString | null;
  createdBy: string | null;
  showTasks: boolean;
}

export interface CaseVersionDto {
  versionTag: string;
  active: boolean;
  final: boolean;
}

export interface HiddenCaseListColumnDto {
  columnKey: string;
}

export interface TaskListColumnDto {
  title: string | null;
  key: string;
  path: string;
  displayType: any;
  sortable: boolean;
  defaultSort: ColumnDefaultSort | null;
  order: number | null;
}

export interface AdminWidgetConfigurationResponseDto {
  key: string;
  title: string;
  dataSourceKey: string;
  displayType: string;
  dataSourceProperties: ObjectNode;
  displayTypeProperties: ObjectNode;
  url: URI | null;
}

export interface DashboardCreateRequestDto {
  title: string;
  description: string;
}

export interface DashboardResponseDto {
  key: string;
  title: string;
  description: string;
  createdBy: string;
  createdOn: DateAsString;
}

export interface DashboardUpdateRequestDto {
  key: string;
  title: string;
  description: string;
}

export interface DashboardWidgetDataResultDto {
  key: string;
  data: any;
}

export interface DashboardWithWidgetsResponseDto {
  key: string;
  title: string;
  widgets: WidgetConfigurationResponseDto[];
}

export interface SingleWidgetConfigurationUpdateRequestDto {
  title: string;
  dataSourceKey: string;
  displayType: string;
  dataSourceProperties: ObjectNode;
  displayTypeProperties: ObjectNode;
  url: URI | null;
}

export interface WidgetConfigurationCreateRequestDto {
  title: string;
  dataSourceKey: string;
  displayType: string;
  dataSourceProperties: ObjectNode;
  displayTypeProperties: ObjectNode;
  url: URI | null;
}

export interface WidgetConfigurationResponseDto {
  key: string;
  title: string;
  displayType: string;
  displayTypeProperties: ObjectNode;
  url: URI | null;
}

export interface WidgetConfigurationUpdateRequestDto {
  key: string;
  title: string;
  dataSourceKey: string;
  displayType: string;
  dataSourceProperties: ObjectNode;
  displayTypeProperties: ObjectNode;
  url: URI | null;
}

export interface CaseTagCreateRequestDto {
  key: string;
  title: string;
  color: CaseTagColor;
}

export interface CaseTagResponseDto {
  key: string;
  caseDefinitionKey: string;
  caseDefinitionVersionTag: string;
  title: string;
  color: CaseTagColor;
  order: number;
}

export interface CaseTagUpdateRequestDto {
  key: string;
  title: string;
  color: CaseTagColor;
}

export interface InternalCaseStatusCreateRequestDto {
  key: string;
  title: string;
  visibleInCaseListByDefault: boolean;
  color: InternalCaseStatusColor;
}

export interface InternalCaseStatusResponseDto {
  key: string;
  caseDefinitionName: string;
  title: string;
  visibleInCaseListByDefault: boolean;
  order: number;
  color: InternalCaseStatusColor;
}

export interface InternalCaseStatusUpdateOrderRequestDto {
  key: string;
  title: string;
  visibleInCaseListByDefault: boolean;
  color: InternalCaseStatusColor;
}

export interface InternalCaseStatusUpdateRequestDto {
  key: string;
  title: string;
  visibleInCaseListByDefault: boolean;
  color: InternalCaseStatusColor;
}

export interface ColumnKeyResponse {
  key: string;
  sortable: boolean;
  filterable: boolean;
}

export interface ColumnResponse {
  key: string;
  sortable: boolean;
  filterable: boolean;
  defaultSort: string | null;
}

export interface DocumentSearchRequest {
  informatieobjecttype: string | null;
  titel: string | null;
  vertrouwelijkheidaanduiding: string | null;
  creatiedatumFrom: DateAsString | null;
  creatiedatumTo: DateAsString | null;
  auteur: string | null;
  trefwoorden: string[] | null;
}

export interface DocumentenApiDocumentDto {
  fileId: string;
  pluginConfigurationId: string;
  bestandsnaam: string | null;
  bestandsomvang: number | null;
  creatiedatum: DateAsString;
  auteur: string | null;
  titel: string | null;
  status: string | null;
  taal: string | null;
  identificatie: string | null;
  beschrijving: string | null;
  informatieobjecttype: string | null;
  informatieobjecttypeOmschrijving: string | null;
  trefwoorden: string[] | null;
  formaat: string | null;
  verzenddatum: DateAsString | null;
  ontvangstdatum: DateAsString | null;
  vertrouwelijkheidaanduiding: string | null;
  versie: number | null;
  indicatieGebruiksrecht: boolean | null;
}

export interface DocumentenApiUploadFieldDto {
  key: string;
  defaultValue: string | null;
  visible: boolean;
  readonly: boolean;
}

export interface DocumentenApiVersionDto {
  selectedVersion: string | null;
  supportsFilterableColumns: boolean;
  supportsSortableColumns: boolean;
  supportsTrefwoorden: boolean;
  supportsUpdatingDefinitiveDocument: boolean;
}

export interface DocumentenApiVersionManagementDto {
  selectedVersion: string | null;
  detectedVersions: string[];
  supportsFilterableColumns: boolean;
  supportsSortableColumns: boolean;
  supportsTrefwoorden: boolean;
}

export interface DocumentenApiVersionsManagementDto {
  versions: string[];
}

export interface ModifyDocumentRequest {
  creatiedatum: DateAsString;
  titel: string;
  auteur: string;
  status: DocumentStatusType | null;
  taal: string;
  bestandsnaam: string | null;
  beschrijving: string | null;
  ontvangstdatum: DateAsString | null;
  verzenddatum: DateAsString | null;
  indicatieGebruiksrecht: boolean | null;
  vertrouwelijkheidaanduiding: string | null;
  informatieobjecttype: string | null;
  trefwoorden: string[] | null;
}

export interface RelatedFileDto extends RelatedFile {
  fileName: string | null;
  sizeInBytes: number | null;
  pluginConfigurationId: string;
  author: string | null;
  title: string | null;
  status: string | null;
  language: string | null;
  identification: string | null;
  description: string | null;
  informatieobjecttype: string | null;
  informatieobjecttypeOmschrijving: string | null;
  keywords: string[] | null;
  format: string | null;
  sendDate: DateAsString | null;
  receiptDate: DateAsString | null;
  confidentialityLevel: string | null;
  version: number | null;
  indicationUsageRights: boolean | null;
}

export interface ReorderColumnRequest {
  key: string;
  defaultSort: string | null;
}

export interface UpdateColumnRequest {
  defaultSort: string | null;
}

export interface FormOption {
  id: string;
  name: string;
}

export interface FormProcessLinkCreateRequestDto extends ProcessLinkCreateRequestDto {
  formDefinitionId: string;
  viewModelEnabled: boolean | null;
  formDisplayType: FormDisplayType | null;
  formSize: FormSizes | null;
  subtitles: string[] | null;
}

export interface FormProcessLinkExportResponseDto extends ProcessLinkExportResponseDto {
  formDefinitionName: string;
  viewModelEnabled: boolean;
  formDisplayType: FormDisplayType;
  formSize: FormSizes;
  subtitles: string[] | null;
}

export interface FormProcessLinkResponseDto extends ProcessLinkResponseDto {
  formDefinitionId: string;
  viewModelEnabled: boolean;
  formDisplayType: FormDisplayType;
  formSize: FormSizes;
  subtitles: string[] | null;
}

export interface FormProcessLinkUpdateRequestDto extends ProcessLinkUpdateRequestDto {
  formDefinitionId: string;
  viewModelEnabled: boolean | null;
  formDisplayType: FormDisplayType | null;
  formSize: FormSizes | null;
  subtitles: string[] | null;
}

export interface FormSubmissionResult {
  errors: OperationError[];
  documentId: string | null;
}

export interface FormSubmissionResultFailed extends FormSubmissionResult, TransactionalResult {}

export interface FormSubmissionResultSucceeded extends FormSubmissionResult {
  documentId: string;
}

export interface IntermediateSaveRequest {
  submission: ObjectNode;
  taskInstanceId: string;
}

export interface IntermediateSubmission {
  submission: ObjectNode;
  taskInstanceId: string;
  createdBy: string;
  createdOn: DateAsString;
  editedBy: string | null;
  editedOn: DateAsString | null;
}

export interface IntermediateSubmissionKt {}

export interface FormFlowBreadcrumbResponse {
  title: string | null;
  key: string;
  stepInstanceId: string | null;
  completed: boolean;
}

export interface FormFlowBreadcrumbsResponse {
  currentStepIndex: number;
  breadcrumbs: FormFlowBreadcrumbResponse[];
}

export interface FormFlowProcessLinkCreateRequestDto extends ProcessLinkCreateRequestDto {
  formFlowDefinitionKey: string;
  formDisplayType: FormDisplayType | null;
  formSize: FormSizes | null;
  subtitles: string[] | null;
}

export interface FormFlowProcessLinkExportResponseDto extends ProcessLinkExportResponseDto {
  formFlowDefinitionKey: string;
  formDisplayType: FormDisplayType;
  formSize: FormSizes;
  subtitles: string[] | null;
}

export interface FormFlowProcessLinkResponseDto extends ProcessLinkResponseDto {
  formFlowDefinitionKey: string;
  formDisplayType: FormDisplayType;
  formSize: FormSizes;
  subtitles: string[] | null;
}

export interface FormFlowProcessLinkUpdateRequestDto extends ProcessLinkUpdateRequestDto {
  formFlowDefinitionKey: string;
  formDisplayType: FormDisplayType | null;
  formSize: FormSizes | null;
  subtitles: string[] | null;
}

export interface MultipleFormErrors {
  componentErrors: ComponentError[];
}

export interface SingleFormError {
  error: string;
  component: string | null;
}

export interface StartFormSubmissionResult {
  documentId: string | null;
}

export interface LocalizationResponseDto {
  languageKey: string;
  content: ObjectNode;
}

export interface LocalizationUpdateRequestDto {
  languageKey: string;
  content: ObjectNode;
}

export interface LoggingEventPropertyDto {
  key: string;
  value: string;
}

export interface LoggingEventResponse {
  timestamp: DateAsString;
  formattedMessage: string;
  level: string;
  properties: LoggingEventPropertyDto[];
  stacktrace: string | null;
}

export interface LoggingEventSearchRequest {
  afterTimestamp: DateAsString | null;
  beforeTimestamp: DateAsString | null;
  level: string | null;
  likeFormattedMessage: string | null;
  properties: LoggingEventPropertyDto[];
}

export interface NoteCreateRequestDto {
  content: string;
}

export interface NoteResponseDto {
  id: string;
  createdByUserId: string;
  createdByUserFullName: string;
  createdDate: DateAsString;
  content: string;
  documentId: string;
}

export interface NoteUpdateRequestDto {
  content: string;
}

export interface URLProcessLinkCreateRequestDto extends ProcessLinkCreateRequestDto {
  url: string;
}

export interface URLProcessLinkDeployDto extends ProcessLinkDeployDto {
  processLinkType: 'url';
  url: string;
}

export interface URLProcessLinkExportResponseDto extends ProcessLinkExportResponseDto {
  url: string;
}

export interface URLProcessLinkResponseDto extends ProcessLinkResponseDto {
  url: string;
}

export interface URLProcessLinkUpdateRequestDto extends ProcessLinkUpdateRequestDto {
  url: string;
}

export interface URLSubmissionResult {
  errors: string[];
  documentId: string;
}

export interface URLVariables {
  variables: {[index: string]: string};
}

export interface CaseProcessDefinitionResponseDto {
  processDefinition: ProcessDefinitionWithPropertiesDto;
  processCaseLink: ProcessDefinitionCaseDefinition;
  processLinks: ProcessLinkResponseDto[];
  bpmn20Xml: string;
}

export interface ProcessDefinitionResponseDto {
  processDefinition: ProcessDefinitionWithPropertiesDto;
  processLinks: ProcessLinkResponseDto[];
  bpmn20Xml: string;
}

export interface ProcessLinkActivityResult<T> {
  processLinkId: string;
  type: string;
  properties: T;
}

export interface ProcessLinkActivityResultWithTask {
  task: TaskInstanceWithIdentityLink;
  processLinkActivityResult: ProcessLinkActivityResult<any> | null;
}

export interface ProcessLinkCreateRequestDto {
  activityId: string;
  processDefinitionId: string;
  processLinkType: string;
  activityType: ActivityTypeWithEventName;
}

export interface ProcessLinkExportResponseDto {
  activityId: string;
  processLinkType: string;
  activityType: ActivityTypeWithEventName;
}

export interface ProcessLinkResponseDto {
  id: string;
  activityId: string;
  processDefinitionId: string;
  processLinkType: string;
  activityType: ActivityTypeWithEventName;
}

export interface ProcessLinkUpdateRequestDto {
  id: string;
  processLinkType: string;
}

export interface SearchFieldV2Dto {
  id: string;
  ownerId: string;
  ownerType: string;
  key: string;
  title: string | null;
  path: string;
  order: number;
  dataType: DataType;
  fieldType: FieldType;
  matchType: SearchFieldMatchType | null;
  dropdownDataProvider: string | null;
  required: boolean;
}

export interface TabDto {
  key: string;
  title: string | null;
  type: string;
}

export interface BatchAssignTaskDTO {
  assignee: string;
  tasksIds: string[];
}

export interface ChoiceFieldCreateRequestDTO {
  keyName: string;
  title: string;
}

export interface ChoiceFieldDTO {
  id: number;
  keyName: string;
  choiceFieldValues: ChoiceFieldValue[];
}

export interface ChoiceFieldUpdateRequestDTO {
  id: number;
  keyName: string;
  title: string;
}

export interface ChoiceFieldValueCreateRequestDTO {
  name: string;
  deprecated: boolean;
  sortOrder: number;
  value: string;
}

export interface ChoiceFieldValueUpdateRequestDTO {
  id: number;
  name: string;
  deprecated: boolean;
  sortOrder: number;
  value: string;
}

export interface CommentDto {
  text: string;
}

export interface CustomTaskDto {
  task: OperatonTaskDto;
  formFields: FormField[];
  variables: {[index: string]: any};
  formLocation: string;
  processName: string;
  processKey: string;
  processVersion: string;
  businessKey: string;
}

export interface DefinitionDeploymentResponseDto {
  identifier: string;
}

export interface FlowNodeMigrationDTO {
  sourceFlowNodeMap: {[index: string]: string};
  targetFlowNodeMap: {[index: string]: string};
  uniqueFlowNodeMap: {[index: string]: string};
}

export interface HeatmapTaskAverageDurationDTO extends HeatmapTaskDTO {
  averageDurationInMilliseconds: number;
}

export interface HeatmapTaskCountDTO extends HeatmapTaskDTO {}

export interface HeatmapTaskDTO {
  name: string;
  count: number;
  totalCount: number;
}

export interface KeyAndPasswordDTO {
  key: string;
  newPassword: string;
}

export interface LoginDTO {
  username: string;
  password: string;
  rememberMe: boolean;
}

export interface ProcessDefinitionDiagramWithPropertyDto {
  id: string;
  bpmn20Xml: string;
  readOnly: boolean;
  systemProcess: boolean;
}

export interface ProcessDefinitionWithPropertiesDto extends ProcessDefinitionDto {
  readOnly: boolean;
}

export interface ProcessInstanceDiagramDto {
  id: string;
  bpmn20Xml: string;
  historicActivityInstances: HistoricActivityInstance[];
}

export interface ProcessInstanceSearchDTO {
  processVariables: ProcessVariableDTOV2Union[];
}

export interface ProcessInstanceStatisticsDTO {
  duration: number;
  processName: string;
}

export interface StartFormDto {
  formLocation: string;
  formFields: FormField[];
  genericForm: boolean;
}

export interface TaskCompletionDTO {
  variables: {[index: string]: any};
  filesToDelete: string[];
}

export interface WidgetDto {
  type: string;
  key: string;
  actions: WidgetAction[];
  title: string;
  width: number;
  highContrast: boolean;
  displayConditions: Condition<any>[] | null;
}

export interface CaseDefinitionId extends AbstractId<CaseDefinitionId>, SolutionModuleId {
  key: string;
  versionTag: Semver;
}

export interface CaseListItemDto {
  key: string;
  value: any | null;
}

export interface ObjectNode extends ContainerNode<ObjectNode>, Serializable {}

export interface URI extends Comparable<URI>, Serializable {}

export interface RelatedFile {
  fileName: string;
  createdBy: string;
  createdOn: DateAsString;
  fileId: string;
  sizeInBytes: number;
}

export interface OperationError {}

export interface TransactionalResult {}

export interface ComponentError {
  component: string | null;
  message: string;
}

export interface ProcessLinkDeployDto {
  processLinkType: 'url';
  activityId: string;
  processDefinitionId: string;
  activityType: ActivityTypeWithEventName;
}

export interface ProcessDefinitionCaseDefinition {
  id: ProcessDefinitionCaseDefinitionId;
  canInitializeDocument: boolean;
  startableByUser: boolean;
  processDefinitionName: string | null;
  processDefinitionKey: string | null;
}

export interface TaskInstanceWithIdentityLink {
  businessKey: string;
  id: string | null;
  name: string | null;
  assignee: string | null;
  created: DateAsString | null;
  due: DateAsString | null;
  followUp: DateAsString | null;
  lastUpdated: DateAsString | null;
  delegationState: string | null;
  description: string | null;
  executionId: string | null;
  owner: string | null;
  parentTaskId: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
  taskDefinitionKey: string | null;
  caseExecutionId: string | null;
  caseInstanceId: string | null;
  caseDefinitionId: string | null;
  suspended: boolean;
  tenantId: string | null;
  external: boolean;
  processDefinitionKey: string;
  identityLinks: OperatonIdentityLinkDto[];
  subtitles: string[];
}

export interface ChoiceFieldValue extends AbstractAuditingEntity, Serializable {
  id: number;
  name: string;
  deprecated: boolean;
  sortOrder: number;
  value: string;
  choiceField: ChoiceField;
}

export interface OperatonTaskDto {
  id: string | null;
  name: string | null;
  assignee: string | null;
  created: DateAsString | null;
  due: DateAsString | null;
  followUp: DateAsString | null;
  lastUpdated: DateAsString | null;
  delegationState: string | null;
  description: string | null;
  executionId: string | null;
  owner: string | null;
  parentTaskId: string | null;
  priority: number;
  processDefinitionId: string | null;
  processInstanceId: string | null;
  taskDefinitionKey: string | null;
  caseExecutionId: string | null;
  caseInstanceId: string | null;
  caseDefinitionId: string | null;
  suspended: boolean;
  tenantId: string | null;
}

export interface FormField {
  value: TypedValue;
  typeName: string;
  properties: {[index: string]: string};
  id: string;
  type: FormType;
  /**
   * @deprecated since 1.0
   */
  defaultValue: any;
  businessKey: boolean;
  validationConstraints: FormFieldValidationConstraint[];
  label: string;
}

export interface ProcessDefinitionDto {
  id: string;
  key: string;
  category: string;
  description: string;
  name: string;
  version: number;
  resource: string;
  deploymentId: string;
  diagram: string;
  suspended: boolean;
  tenantId: string;
  versionTag: string;
  historyTimeToLive: number;
  startableInTasklist: boolean;
}

export interface HistoricActivityInstance {
  id: string;
  executionId: string;
  processDefinitionKey: string;
  activityId: string;
  assignee: string;
  tenantId: string;
  canceled: boolean;
  removalTime: DateAsString;
  rootProcessInstanceId: string;
  parentActivityInstanceId: string;
  calledProcessInstanceId: string;
  calledCaseInstanceId: string;
  taskId: string;
  startTime: DateAsString;
  endTime: DateAsString;
  processDefinitionId: string;
  activityType: string;
  activityName: string;
  durationInMillis: number;
  completeScope: boolean;
  processInstanceId: string;
}

export interface ProcessVariableDTOV2 {
  '@type': 'string' | 'date' | 'boolean' | 'enum' | 'long' | 'fileUpload';
  name: string;
}

export interface WidgetAction {}

export interface Condition<T> {
  path: string;
  operator: ExpressionOperator;
  value: T;
}

export interface Semver extends Comparable<Semver> {
  major: number;
  minor: number;
  patch: number;
  preRelease: string[];
  build: string[];
  version: string;
  stable: boolean;
}

export interface SolutionModuleId {
  tagPrefix: string;
  idKey: string;
}

export interface Serializable {}

export interface ProcessDefinitionCaseDefinitionId
  extends AbstractId<ProcessDefinitionCaseDefinitionId> {
  processDefinitionId: ProcessDefinitionId;
  caseDefinitionId: CaseDefinitionId;
}

export interface OperatonIdentityLinkDto {
  userId: string | null;
  groupId: string | null;
  type: string | null;
}

export interface ChoiceField extends AbstractAuditingEntity, Serializable {
  id: number;
  keyName: string;
  title: string;
}

export interface AbstractAuditingEntity {}

export interface TypedValue extends Serializable {
  value: any;
  type: ValueType;
  transient: boolean;
}

export interface FormType {
  name: string;
}

export interface FormFieldValidationConstraint {
  name: string;
  configuration: any;
}

export interface StringProcessVariableDTOV2 extends ProcessVariableDTOV2 {
  '@type': 'string';
  value: string;
}

export interface DateProcessVariableDTOV2 extends ProcessVariableDTOV2 {
  '@type': 'date';
  range: DateRange;
}

export interface BooleanProcessVariableDTOV2 extends ProcessVariableDTOV2 {
  '@type': 'boolean';
  value: boolean;
}

export interface EnumProcessVariableDTOV2 extends ProcessVariableDTOV2 {
  '@type': 'enum';
  values: string[];
}

export interface LongProcessVariableDTOV2 extends ProcessVariableDTOV2 {
  '@type': 'long';
  value: number;
}

export interface FileUploadProcessVariableDTOV2 extends ProcessVariableDTOV2 {
  '@type': 'fileUpload';
  value: boolean;
}

export interface AbstractId<SELF> extends Identity, Serializable {}

export interface ContainerNode<T> extends BaseJsonNode, JsonNodeCreator {}

export interface Comparable<T> {}

export interface ProcessDefinitionId {
  id: string;
}

export interface ValueType extends Serializable {
  name: string;
  parent: ValueType;
  abstract: boolean;
  primitiveValueType: boolean;
}

export interface DateRange {
  from: DateAsString;
  to: DateAsString;
}

export interface Identity {}

export interface BaseJsonNode extends Serializable {}

export interface JsonNodeCreator {}

export type DateAsString = string;

export type ColumnDefaultSort = 'ASC' | 'DESC';

export type CaseTabType = 'standard' | 'formio' | 'custom' | 'widgets';

export type CaseTagColor =
  | 'WARMGRAY'
  | 'RED'
  | 'MAGENTA'
  | 'PURPLE'
  | 'BLUE'
  | 'CYAN'
  | 'TEAL'
  | 'GREEN'
  | 'GRAY'
  | 'COOLGRAY'
  | 'HIGHCONTRAST'
  | 'OUTLINE';

export type InternalCaseStatusColor =
  | 'WARMGRAY'
  | 'RED'
  | 'MAGENTA'
  | 'PURPLE'
  | 'BLUE'
  | 'CYAN'
  | 'TEAL'
  | 'GREEN'
  | 'GRAY'
  | 'COOLGRAY'
  | 'HIGHCONTRAST'
  | 'OUTLINE';

export type DocumentStatusType =
  | 'in_bewerking'
  | 'ter_vaststelling'
  | 'definitief'
  | 'gearchiveerd';

export type ActivityTypeWithEventName =
  | 'bpmn:MultiInstanceBody:start'
  | 'bpmn:MultiInstanceBody:end'
  | 'bpmn:ExclusiveGateway:start'
  | 'bpmn:ExclusiveGateway:end'
  | 'bpmn:InclusiveGateway:start'
  | 'bpmn:InclusiveGateway:end'
  | 'bpmn:ParallelGateway:start'
  | 'bpmn:ParallelGateway:end'
  | 'bpmn:ComplexGateway:start'
  | 'bpmn:ComplexGateway:end'
  | 'bpmn:EventBasedGateway:start'
  | 'bpmn:EventBasedGateway:end'
  | 'bpmn:Task:start'
  | 'bpmn:Task:end'
  | 'bpmn:ScriptTask:start'
  | 'bpmn:ScriptTask:end'
  | 'bpmn:ServiceTask:start'
  | 'bpmn:ServiceTask:end'
  | 'bpmn:BusinessRuleTask:start'
  | 'bpmn:BusinessRuleTask:end'
  | 'bpmn:ManualTask:start'
  | 'bpmn:ManualTask:end'
  | 'bpmn:UserTask:create'
  | 'bpmn:UserTask:assignment'
  | 'bpmn:UserTask:complete'
  | 'bpmn:UserTask:update'
  | 'bpmn:UserTask:delete'
  | 'bpmn:UserTask:timeout'
  | 'bpmn:UserTask:start'
  | 'bpmn:UserTask:end'
  | 'bpmn:SendTask:start'
  | 'bpmn:SendTask:end'
  | 'bpmn:ReceiveTask:start'
  | 'bpmn:ReceiveTask:end'
  | 'bpmn:SubProcess:start'
  | 'bpmn:SubProcess:end'
  | 'bpmn:AdHocSubProcess:start'
  | 'bpmn:AdHocSubProcess:end'
  | 'bpmn:CallActivity:start'
  | 'bpmn:CallActivity:end'
  | 'bpmn:Transaction:start'
  | 'bpmn:Transaction:end'
  | 'bpmn:BoundaryTimer:start'
  | 'bpmn:BoundaryTimer:end'
  | 'bpmn:BoundaryMessage:start'
  | 'bpmn:BoundaryMessage:end'
  | 'bpmn:BoundarySignal:start'
  | 'bpmn:BoundarySignal:end'
  | 'bpmn:CompensationBoundaryCatch:start'
  | 'bpmn:CompensationBoundaryCatch:end'
  | 'bpmn:BoundaryError:start'
  | 'bpmn:BoundaryError:end'
  | 'bpmn:BoundaryEscalation:start'
  | 'bpmn:BoundaryEscalation:end'
  | 'bpmn:CancelBoundaryCatch:start'
  | 'bpmn:CancelBoundaryCatch:end'
  | 'bpmn:BoundaryConditional:start'
  | 'bpmn:BoundaryConditional:end'
  | 'bpmn:StartEvent:start'
  | 'bpmn:StartEvent:end'
  | 'bpmn:StartTimerEvent:start'
  | 'bpmn:StartTimerEvent:end'
  | 'bpmn:MessageStartEvent:start'
  | 'bpmn:MessageStartEvent:end'
  | 'bpmn:SignalStartEvent:start'
  | 'bpmn:SignalStartEvent:end'
  | 'bpmn:EscalationStartEvent:start'
  | 'bpmn:EscalationStartEvent:end'
  | 'bpmn:CompensationStartEvent:start'
  | 'bpmn:CompensationStartEvent:end'
  | 'bpmn:ErrorStartEvent:start'
  | 'bpmn:ErrorStartEvent:end'
  | 'bpmn:ConditionalStartEvent:start'
  | 'bpmn:ConditionalStartEvent:end'
  | 'bpmn:IntermediateCatchEvent:start'
  | 'bpmn:IntermediateCatchEvent:end'
  | 'bpmn:IntermediateMessageCatch:start'
  | 'bpmn:IntermediateMessageCatch:end'
  | 'bpmn:IntermediateTimer:start'
  | 'bpmn:IntermediateTimer:end'
  | 'bpmn:IntermediateLinkCatch:start'
  | 'bpmn:IntermediateLinkCatch:end'
  | 'bpmn:IntermediateSignalCatch:start'
  | 'bpmn:IntermediateSignalCatch:end'
  | 'bpmn:IntermediateConditional:start'
  | 'bpmn:IntermediateConditional:end'
  | 'bpmn:IntermediateThrowEvent:start'
  | 'bpmn:IntermediateThrowEvent:end'
  | 'bpmn:IntermediateSignalThrow:start'
  | 'bpmn:IntermediateSignalThrow:end'
  | 'bpmn:IntermediateCompensationThrowEvent:start'
  | 'bpmn:IntermediateCompensationThrowEvent:end'
  | 'bpmn:IntermediateMessageThrowEvent:start'
  | 'bpmn:IntermediateMessageThrowEvent:end'
  | 'bpmn:IntermediateNoneThrowEvent:start'
  | 'bpmn:IntermediateNoneThrowEvent:end'
  | 'bpmn:IntermediateEscalationThrowEvent:start'
  | 'bpmn:IntermediateEscalationThrowEvent:end'
  | 'bpmn:ErrorEndEvent:start'
  | 'bpmn:ErrorEndEvent:end'
  | 'bpmn:CancelEndEvent:start'
  | 'bpmn:CancelEndEvent:end'
  | 'bpmn:TerminateEndEvent:start'
  | 'bpmn:TerminateEndEvent:end'
  | 'bpmn:MessageEndEvent:start'
  | 'bpmn:MessageEndEvent:end'
  | 'bpmn:SignalEndEvent:start'
  | 'bpmn:SignalEndEvent:end'
  | 'bpmn:CompensationEndEvent:start'
  | 'bpmn:CompensationEndEvent:end'
  | 'bpmn:EscalationEndEvent:start'
  | 'bpmn:EscalationEndEvent:end'
  | 'bpmn:NoneEndEvent:start'
  | 'bpmn:NoneEndEvent:end';

export type FormDisplayType = 'modal' | 'panel';

export type FormSizes = 'extraSmall' | 'small' | 'medium' | 'large';

export type DataType = 'text' | 'number' | 'date' | 'datetime' | 'time' | 'boolean';

export type FieldType =
  | 'text_contains'
  | 'single'
  | 'range'
  | 'single-select-dropdown'
  | 'multi-select-dropdown';

export type SearchFieldMatchType = 'like' | 'exact';

export type ExpressionOperator = '!=' | '==' | '>' | '>=' | '<' | '<=' | 'list_contains' | 'in';

export type ProcessVariableDTOV2Union =
  | StringProcessVariableDTOV2
  | DateProcessVariableDTOV2
  | BooleanProcessVariableDTOV2
  | EnumProcessVariableDTOV2
  | LongProcessVariableDTOV2
  | FileUploadProcessVariableDTOV2;
