/* tslint:disable */
/* eslint-disable */
// Generated using typescript-generator version 3.2.1263 on 2026-08-04 15:02:17.

export interface AccentColorsDto {
    colors: { [index: string]: string };
}

export interface AdminSettingsLogoDto {
    logoType: string;
    imageBase64: string;
}

export interface AdminSettingsLogosDto {
    logo: AdminSettingsLogoDto | null;
    logoDarkMode: AdminSettingsLogoDto | null;
}

export interface CreateAdminSettingsLogoDto {
    imageBase64: string;
}

export interface FeatureToggleOverridesDto {
    overrides: { [index: string]: boolean };
}

export interface UpdateFeatureToggleDto {
    key: string;
    enabled: boolean;
}

export interface PbacConditionFieldDto {
    name: string;
    type: string;
}

export interface PbacConditionTypeDto {
    key: string;
}

export interface PbacEntityMapperDto {
    fromResourceType: string;
    toResourceType: string;
}

export interface PbacFieldAliasDto {
    alias: string;
    field: string;
}

export interface PbacOperatorDto {
    key: string;
}

export interface PbacRegistryDto {
    resources: PbacResourceDto[];
    operators: PbacOperatorDto[];
    conditionTypes: PbacConditionTypeDto[];
    entityMappers: PbacEntityMapperDto[];
    roles: string[];
}

export interface PbacResourceDto {
    resourceType: string;
    shortName: string;
    actions: string[];
    fields: PbacConditionFieldDto[];
    fieldAliases: PbacFieldAliasDto[];
    hasSpecificationFactory: boolean;
    containerTargets: string[];
}

export interface BuildingBlockDefinitionArtworkDto {
    key: string;
    versionTag: string;
    imageBase64: string;
}

export interface BuildingBlockDefinitionDto {
    key: string;
    versionTag: string;
    name: string;
    description: string | null;
    createdBy: string | null;
    createdDate: DateAsString | null;
    basedOnVersionTag: string | null;
    final: boolean;
    imageBase64: string | null;
}

export interface BuildingBlockFormDefinitionDto {
    id: string;
    name: string;
    formDefinition: any;
    readOnly: boolean;
}

export interface BuildingBlockInstanceDto {
    id: string;
    documentId: string;
    caseDocumentId: string | null;
    definitionKey: string;
    definitionVersionTag: string;
    activityId: string | null;
    callerProcessDefinitionId: string | null;
    processInstanceId: string | null;
    parentBuildingBlockInstanceId: string | null;
    rootBuildingBlockInstanceId: string | null;
}

export interface BuildingBlockProcessDefinitionDto {
    id: string;
    key: string;
    name: string | null;
    versionTag: string | null;
    main: boolean;
    draft: boolean;
}

export interface BuildingBlockProcessDefinitionWithLinksDto {
    processDefinition: ProcessDefinitionWithPropertiesDto;
    processLinks: ProcessLinkResponseDto[];
    bpmn20Xml: string;
    draft: boolean;
}

export interface BuildingBlockVersionDto {
    versionTag: string;
    final: boolean;
}

export interface CaseDefinitionBuildingBlockLinkDto {
    id: string;
    caseDefinitionKey: string;
    caseDefinitionVersionTag: string;
    buildingBlockDefinitionKey: string;
    buildingBlockDefinitionVersionTag: string;
    inputMappings: BuildingBlockInputMapping[];
    outputMappings: BuildingBlockOutputMapping[];
    pluginConfigurationMappings: { [index: string]: string };
}

export interface CreateBuildingBlockDefinitionArtworkDto {
    imageBase64: string;
}

export interface CreateBuildingBlockDefinitionDto {
    key: string;
    versionTag: string;
    name: string;
    description: string | null;
}

export interface CreateBuildingBlockDraftDto {
    versionTag: string;
}

export interface CreateBuildingBlockFormDefinitionDto {
    name: string;
    formDefinition: string;
    readOnly: boolean | null;
}

export interface CreateCaseDefinitionBuildingBlockLinkDto {
    buildingBlockDefinitionKey: string;
    buildingBlockDefinitionVersionTag: string;
    inputMappings: BuildingBlockInputMapping[];
    outputMappings: BuildingBlockOutputMapping[];
    pluginConfigurationMappings: { [index: string]: string };
}

export interface UpdateBuildingBlockDefinitionArtworkDto {
    imageBase64: string;
}

export interface UpdateBuildingBlockDefinitionDto {
    name: string;
    description: string | null;
}

export interface UpdateBuildingBlockFormDefinitionDto {
    name: string;
    formDefinition: string;
}

export interface UpdateCaseDefinitionBuildingBlockLinkDto {
    inputMappings: BuildingBlockInputMapping[];
    outputMappings: BuildingBlockOutputMapping[];
    pluginConfigurationMappings: { [index: string]: string };
}

export interface CaseDefinitionCheckResponse {
    canUpdateGlobalConfiguration: boolean;
}

export interface CaseDefinitionConfigurationIssueDto {
    id: string;
    issueType: string;
    resolved: boolean;
    createdAt: DateAsString;
    resolvedAt: DateAsString | null;
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

export interface CaseDefinitionImportPreviewResponse {
    key: string;
    name: string;
    versionTag: string;
    pluginConfigurations: PluginConfigurationPreviewDto[];
    final: boolean;
}

export interface CaseDefinitionImportResponse {
    caseDefinitionId: CaseDefinitionId | null;
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
    hasConfigurationIssues: boolean;
    originalKey: string | null;
    originalName: string | null;
    originalVersionTag: string | null;
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

export interface CreateStartableItemRequest {
    type: StartableItemType;
    properties: any;
}

export interface HiddenCaseListColumnDto {
    columnKey: string;
}

export interface HiddenTaskListColumnDto {
    columnKey: string;
}

export interface ManagementStartableItemDto {
    type: StartableItemType;
    name: string | null;
    key: string;
    versionTag: string | null;
    processDefinitionId: string | null;
    sortOrder: number | null;
}

export interface PluginConfigurationPreviewDto {
    pluginConfigurationId: string;
    pluginDefinitionKey: string | null;
    pluginActionDefinitionKey: string;
    processDefinitionKey: string;
    activityId: string;
    existsInTargetEnvironment: boolean;
}

export interface StartableItemDto {
    type: StartableItemType;
    name: string | null;
    key: string;
    versionTag: string | null;
    processDefinitionId: string | null;
    draft: boolean;
}

export interface StartableItemOrderEntry {
    key: string;
    type: StartableItemType;
    versionTag: string | null;
    sortOrder: number;
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

export interface UpdateStartableItemOrderRequest {
    items: StartableItemOrderEntry[];
}

export interface UpdateStartableItemRequest {
    type: StartableItemType;
    properties: any;
}

export interface AdminWidgetConfigurationResponseDto {
    key: string;
    title: string;
    dataSourceKey: string;
    displayType: string;
    dataSourceProperties: ObjectNode;
    displayTypeProperties: ObjectNode;
    url: string | null;
}

export interface DashboardCreateRequestDto {
    title: string;
    description: string;
    widgetLayout: DashboardWidgetLayout | null;
}

export interface DashboardResponseDto {
    key: string;
    title: string;
    description: string;
    createdBy: string;
    createdOn: DateAsString;
    widgetLayout: DashboardWidgetLayout | null;
}

export interface DashboardUpdateRequestDto {
    key: string;
    title: string;
    description: string;
    widgetLayout: DashboardWidgetLayout | null;
}

export interface DashboardWidgetDataResultDto {
    key: string;
    data: any;
}

export interface DashboardWithWidgetsResponseDto {
    key: string;
    title: string;
    widgets: WidgetConfigurationResponseDto[];
    widgetLayout: DashboardWidgetLayout | null;
}

export interface SingleWidgetConfigurationUpdateRequestDto {
    title: string;
    dataSourceKey: string;
    displayType: string;
    dataSourceProperties: ObjectNode;
    displayTypeProperties: ObjectNode;
    url: string | null;
}

export interface WidgetConfigurationCreateRequestDto {
    title: string;
    dataSourceKey: string;
    displayType: string;
    dataSourceProperties: ObjectNode;
    displayTypeProperties: ObjectNode;
    url: string | null;
}

export interface WidgetConfigurationResponseDto {
    key: string;
    title: string;
    displayType: string;
    displayTypeProperties: ObjectNode;
    url: string | null;
}

export interface WidgetConfigurationUpdateRequestDto {
    key: string;
    title: string;
    dataSourceKey: string;
    displayType: string;
    dataSourceProperties: ObjectNode;
    displayTypeProperties: ObjectNode;
    url: string | null;
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

export interface DocumentInspectionDto {
    id: string;
    definitionId: DocumentDefinitionId;
    createdOn: DateAsString;
    modifiedOn: DateAsString;
    createdBy: string;
    sequence: number;
    version: number;
    assigneeId: string;
    assigneeFullName: string;
    assignedTeamKey: string;
    assignedTeamTitle: string;
    internalStatus: string;
    caseTags: CaseTagResponseDto[];
    relations: DocumentRelation[];
    relatedFiles: RelatedFile[];
    content: any;
}

export interface InternalCaseStatusCreateRequestDto {
    key: string;
    title: string;
    visibleInCaseListByDefault: boolean;
    retentionPeriodInDays: number;
    color: InternalCaseStatusColor;
    label: string | null;
}

export interface InternalCaseStatusResponseDto {
    key: string;
    caseDefinitionName: string;
    title: string;
    visibleInCaseListByDefault: boolean;
    retentionPeriodInDays: number;
    order: number;
    color: InternalCaseStatusColor;
    label: string | null;
}

export interface InternalCaseStatusUpdateOrderRequestDto {
    key: string;
    title: string;
    visibleInCaseListByDefault: boolean;
    retentionPeriodInDays: number;
    color: InternalCaseStatusColor;
    label: string | null;
}

export interface InternalCaseStatusUpdateRequestDto {
    key: string;
    title: string;
    visibleInCaseListByDefault: boolean;
    retentionPeriodInDays: number;
    color: InternalCaseStatusColor;
    label: string | null;
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
    canView: boolean;
    canModify: boolean;
    canDelete: boolean;
}

export interface DocumentenApiUploadFieldDto {
    key: string;
    defaultValue: string | null;
    visible: boolean;
    readonly: boolean;
}

export interface DocumentenApiVersionDetailsDto {
    version: string;
    supportsFilterableColumns: boolean;
    supportsSortableColumns: boolean;
    supportsTrefwoorden: boolean;
    supportsUpdatingDefinitiveDocument: boolean;
    supportsObjectInformatieObjecten: boolean;
    experimentalVersion: boolean;
}

export interface DocumentenApiVersionDto {
    selectedVersion: string | null;
    supportsFilterableColumns: boolean;
    supportsSortableColumns: boolean;
    supportsTrefwoorden: boolean;
    supportsUpdatingDefinitiveDocument: boolean;
    supportsObjectInformatieObjecten: boolean;
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
    versionDetails: DocumentenApiVersionDetailsDto[];
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
    canView: boolean;
    canModify: boolean;
    canDelete: boolean;
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
    documentId: string | null;
    errors: OperationError[];
}

export interface FormSubmissionResultFailed extends FormSubmissionResult, TransactionalResult {
}

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

export interface IntermediateSubmissionKt {
}

export interface FormFlowAdditionalPropertyDto {
    name: string;
    context: string;
    alwaysPresent: boolean;
}

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

export interface FormFlowExpressionBeanDto {
    name: string;
    methods: FormFlowExpressionMethodDto[];
}

export interface FormFlowExpressionMethodDto {
    name: string;
    parameters: FormFlowExpressionParameterDto[];
    returnType: string;
}

export interface FormFlowExpressionParameterDto {
    name: string;
    type: string;
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

export interface FormFlowRegistryDto {
    stepTypes: FormFlowStepTypeDto[];
    expressionBeans: FormFlowExpressionBeanDto[];
    additionalProperties: FormFlowAdditionalPropertyDto[];
}

export interface FormFlowStepTypeDto {
    name: string;
    properties: FormFlowStepTypePropertyDto[];
}

export interface FormFlowStepTypePropertyDto {
    name: string;
    type: string;
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

export interface JobInspectionDto {
    id: string;
    jobDefinitionId: string | null;
    executionId: string | null;
    activityId: string | null;
    jobType: JobType;
    retries: number;
    exceptionMessage: string | null;
    dueDate: DateAsString | null;
    suspended: boolean;
}

export interface LogInspectionSearchRequest {
    level: string | null;
    likeFormattedMessage: string | null;
    afterTimestamp: DateAsString | null;
    beforeTimestamp: DateAsString | null;
    additionalProperties: LoggingEventPropertyDto[];
}

export interface ProcessInstanceInspectionDto {
    processInstanceId: string;
    processDefinitionId: string | null;
    processDefinitionKey: string | null;
    processName: string | null;
    version: number;
    latestVersion: number;
    active: boolean;
    startedBy: string | null;
    startedByUserId: string | null;
    startedOn: DateAsString | null;
    incidents: IncidentDto[];
    tasks: TaskInspectionDto[];
    variables: ProcessVariableDto[];
    jobs: JobInspectionDto[];
    buildingBlock: BuildingBlockProcessReference | null;
}

export interface TaskInspectionDto {
    id: string;
    name: string | null;
    assignee: string | null;
    created: DateAsString | null;
    dueDate: DateAsString | null;
    taskDefinitionKey: string | null;
}

export interface URLProcessLinkCreateRequestDto extends ProcessLinkCreateRequestDto {
    url: string;
}

export interface URLProcessLinkDeployDto extends ProcessLinkDeployDto {
    processLinkType: "url";
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
    variables: { [index: string]: string };
}

export interface CaseProcessDefinitionResponseDto {
    processDefinition: ProcessDefinitionWithPropertiesDto;
    processCaseLink: ProcessDefinitionCaseDefinition;
    processLinks: ProcessLinkResponseDto[];
    bpmn20Xml: string;
    draft: boolean;
}

export interface ProcessDefinitionConflictResponseDto {
    processDefinitionKey: string;
    processDefinitionId: string;
    processDefinitionName: string | null;
}

export interface ProcessDefinitionResponseDto {
    processDefinition: ProcessDefinitionWithPropertiesDto;
    processLinks: ProcessLinkResponseDto[];
    bpmn20Xml: string;
    draft: boolean;
}

export interface ProcessDefinitionValidateRequestDto {
    bpmnXml: string;
    processLinks: ProcessLinkCreateRequestDto[];
}

export interface ProcessDefinitionValidateResponseDto {
    hasWarnings: boolean;
    errors: ProcessDefinitionValidationError[];
    valid: boolean;
}

export interface ProcessLinkActivityResult<T> {
    processLinkId: string;
    type: string;
    assignee: string | null;
    due: DateAsString | null;
    properties: T;
}

export interface ProcessLinkActivityResultWithTask {
    task: TaskInstanceWithIdentityLink;
    processLinkActivityResult: ProcessLinkActivityResult<any> | null;
}

export interface ProcessLinkCreateRequestDto {
    activityId: string;
    processDefinitionId: string;
    activityType: ActivityTypeWithEventName;
    processLinkType: string;
}

export interface ProcessLinkExportResponseDto {
    activityId: string;
    activityType: ActivityTypeWithEventName;
    processLinkType: string;
}

export interface ProcessLinkResponseDto {
    activityId: string;
    processDefinitionId: string;
    activityType: ActivityTypeWithEventName;
    processLinkType: string;
    id: string;
}

export interface ProcessLinkUpdateRequestDto {
    processLinkType: string;
    id: string;
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
    properties: { [index: string]: any | null } | null;
    widgetLayout: TabWidgetLayout | null;
}

export interface TeamCreateRequestDto {
    key: string;
    title: string;
}

export interface TeamImportExportDto {
    key: string;
    title: string;
}

export interface TeamListResponseDto {
    key: string;
    title: string;
    userCount: number;
}

export interface TeamResponseDto {
    key: string;
    title: string;
}

export interface TeamUpdateRequestDto {
    key: string;
    title: string;
}

export interface TeamUserCreateRequestDto {
    username: string;
}

export interface TeamUserResponseDto {
    username: string;
    fullName: string | null;
    email: string | null;
}

export interface BatchAssignTaskDTO {
    assignee: string;
    assignedTeamKey: string;
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
    variables: { [index: string]: any };
    formLocation: string;
    processName: string;
    processKey: string;
    processVersion: string;
    businessKey: string;
}

export interface DecisionDefinitionResponseDto {
    id: string;
    key: string;
    category: string | null;
    name: string | null;
    version: number;
    resource: string | null;
    deploymentId: string | null;
    tenantId: string | null;
    decisionRequirementsDefinitionId: string | null;
    decisionRequirementsDefinitionKey: string | null;
    versionTag: string | null;
    historyTimeToLive: number | null;
}

export interface DefinitionDeploymentResponseDto {
    identifier: string;
}

export interface FlowNodeMigrationDTO {
    sourceFlowNodeMap: { [index: string]: string };
    targetFlowNodeMap: { [index: string]: string };
    uniqueFlowNodeMap: { [index: string]: string };
}

export interface HeatmapTaskAverageDurationDTO extends HeatmapTaskDTO {
    averageDurationInMilliseconds: number;
}

export interface HeatmapTaskCountDTO extends HeatmapTaskDTO {
}

export interface HeatmapTaskDTO {
    name: string;
    count: number;
    totalCount: number;
}

export interface IncidentDto {
    id: string;
    processInstanceId: string;
    processDefinitionId: string;
    executionId: string;
    activityId: string;
    incidentType: string;
    incidentMessage: string;
    incidentTimestamp: DateAsString;
    causeIncidentId: string;
    rootCauseIncidentId: string;
    configuration: string;
    tenantId: string;
    jobDefinitionId: string;
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

export interface ProcessVariableDto {
    name: string;
    type: string;
    value: any;
}

export interface ProcessVariableMutationRequest {
    name: string;
    type: ProcessVariableType;
    value: any;
}

export interface StartFormDto {
    formLocation: string;
    formFields: FormField[];
    genericForm: boolean;
}

export interface TaskCompletionDTO {
    variables: { [index: string]: any };
    filesToDelete: string[];
}

export interface UserTeamDto {
    key: string;
}

export interface TemplatePreviewRequest {
    fileName: string;
    content: string;
}

export interface CreateTemplateRequest {
    key: string;
    caseDefinitionKey: string | null;
    caseDefinitionVersionTag: string | null;
    buildingBlockDefinitionKey: string | null;
    buildingBlockDefinitionVersionTag: string | null;
    type: string;
    metadata: { [index: string]: any | null };
}

export interface DeleteTemplateRequest {
    caseDefinitionKey: string | null;
    caseDefinitionVersionTag: string | null;
    buildingBlockDefinitionKey: string | null;
    buildingBlockDefinitionVersionTag: string | null;
    templates: TemplateKeyType[];
}

export interface TemplateKeyType {
    key: string;
    type: string;
}

export interface TemplateListItemResponse {
    key: string;
    type: string;
}

export interface TemplateResponse {
    key: string;
    caseDefinitionKey: string | null;
    caseDefinitionVersionTag: string | null;
    buildingBlockDefinitionKey: string | null;
    buildingBlockDefinitionVersionTag: string | null;
    type: string;
    metadata: { [index: string]: any | null };
    content: string;
}

export interface UpdateTemplateRequest {
    key: string;
    caseDefinitionKey: string | null;
    caseDefinitionVersionTag: string | null;
    buildingBlockDefinitionKey: string | null;
    buildingBlockDefinitionVersionTag: string | null;
    type: string;
    metadata: { [index: string]: any | null };
    content: string;
}

export interface WidgetDto {
    type: string;
    color: WidgetColor | null;
    width: number;
    icon: string | null;
    compact: boolean | null;
    title: string;
    highContrast: boolean;
    displayConditions: Condition<any>[] | null;
    key: string;
    actions: WidgetAction[];
}

export interface CaseZaakdetailsInspectionDto {
    syncConfig: ZaakdetailsSyncConfigDto | null;
    zaakdetailsObject: ZaakdetailsObjectDto | null;
}

export interface ZaakdetailsObjectContentDto {
    resolved: boolean;
    record: any | null;
    message: string | null;
    objectUrl: string | null;
}

export interface ZaakdetailsObjectDto {
    documentId: string;
    objectUrl: string;
    linkedToZaak: boolean;
}

export interface ZaakdetailsSyncConfigDto {
    caseDefinitionKey: string;
    caseDefinitionVersionTag: string;
    objectManagementConfigurationId: string | null;
    objectManagementTitle: string | null;
    enabled: boolean;
}

export interface CaseZgwInspectionDto {
    zaakInstanceLink: ZaakInstanceLinkDto | null;
    zaak: any | null;
    eigenschappen: ZaakEigenschapDto[];
    rollen: ZaakRolDto[];
    statusHistory: ZaakStatusDto[];
    resultaat: ZaakResultaatDto | null;
    zaakObjecten: ZaakObjectDto[];
    zaakInformatieObjecten: ZaakInformatieObjectDto[];
    besluiten: ZaakBesluitDto[];
    warnings: string[];
}

export interface ZaakBesluitDto {
    url: string;
    besluit: string;
}

export interface ZaakEigenschapDto {
    url: string;
    eigenschap: string;
    naam: string | null;
    waarde: string;
}

export interface ZaakInformatieObjectDto {
    url: string;
    informatieobject: string;
    titel: string | null;
    registratiedatum: DateAsString;
}

export interface ZaakInstanceLinkDto {
    zaakInstanceUrl: string;
    zaakInstanceId: string;
    zaakTypeUrl: string;
}

export interface ZaakObjectDto {
    url: string;
    objectUrl: string;
    objectType: string;
    objectTypeOverige: string | null;
    relatieomschrijving: string | null;
}

export interface ZaakResultaatDto {
    url: string;
    resultaattype: string;
    toelichting: string | null;
}

export interface ZaakRolDto {
    url: string | null;
    betrokkeneType: string;
    roltype: string;
    omschrijving: string | null;
    omschrijvingGeneriek: string | null;
    indicatieMachtiging: string | null;
    betrokkeneIdentificatie: any | null;
}

export interface ZaakStatusDto {
    url: string;
    statustype: string;
    datumStatusGezet: DateAsString;
    statustoelichting: string | null;
}

export interface ZaakobjectResolveResultDto {
    resolved: boolean;
    record: any | null;
    message: string | null;
    objectUrl: string;
}

export interface BuildingBlockInputMapping {
    source: string;
    target: string;
    prefixedTarget: string;
}

export interface BuildingBlockOutputMapping {
    source: string;
    target: string;
    syncTiming: BuildingBlockSyncTiming;
    prefixedSource: string;
}

export interface CaseDefinitionId extends AbstractId<CaseDefinitionId>, BlueprintId {
    key: string;
    versionTag: string;
}

export interface CaseListItemDto {
    key: string;
    value: any | null;
}

export interface ObjectNode extends ContainerNode<ObjectNode>, Serializable {
}

export interface DocumentDefinitionId {
    buildingBlockDefinitionId: BuildingBlockDefinitionId;
    caseDefinitionId: CaseDefinitionId;
    name: string;
}

export interface DocumentRelation {
    relationType: DocumentRelationType;
    id: string;
}

export interface RelatedFile {
    createdBy: string;
    createdOn: DateAsString;
    sizeInBytes: number;
    fileId: string;
    fileName: string;
}

export interface OperationError {
}

export interface TransactionalResult {
}

export interface ComponentError {
    component: string | null;
    message: string;
}

export interface BuildingBlockProcessReference {
    instanceId: string;
    definitionKey: string;
    definitionVersionTag: string;
    documentId: string;
}

export interface ProcessLinkDeployDto {
    processLinkType: "url";
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
    draft: boolean;
}

export interface ProcessDefinitionValidationError {
    elementId: string;
    elementType: string;
    elementName: string | null;
    reason: string;
    errorCode: string | null;
    expression: string | null;
    severity: ValidationSeverity;
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
    assignedTeam: TeamDto | null;
    valtimoAssignee: AssigneeDto | null;
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
    assignedTeam: TeamDto | null;
    valtimoAssignee: AssigneeDto | null;
}

export interface FormField {
    validationConstraints: FormFieldValidationConstraint[];
    label: string;
    businessKey: boolean;
    value: TypedValue;
    typeName: string;
    properties: { [index: string]: string };
    id: string;
    type: FormType;
    /**
     * @deprecated since 1.0
     */
    defaultValue: any;
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
    rootProcessInstanceId: string;
    parentActivityInstanceId: string;
    calledProcessInstanceId: string;
    calledCaseInstanceId: string;
    processDefinitionKey: string;
    taskId: string;
    startTime: DateAsString;
    endTime: DateAsString;
    activityId: string;
    executionId: string;
    processInstanceId: string;
    processDefinitionId: string;
    activityType: string;
    assignee: string;
    tenantId: string;
    canceled: boolean;
    removalTime: DateAsString;
    activityName: string;
    durationInMillis: number;
    completeScope: boolean;
    id: string;
}

export interface ProcessVariableDTOV2 {
    "@type": "string" | "date" | "boolean" | "enum" | "long" | "fileUpload";
    name: string;
}

export interface Condition<T> {
    path: string;
    operator: ExpressionOperator;
    value: T;
}

export interface WidgetAction {
}

export interface BlueprintId {
    tagPrefix: string;
    idKey: string;
}

export interface Serializable {
}

export interface BuildingBlockDefinitionId extends AbstractId<BuildingBlockDefinitionId>, BlueprintId {
    key: string;
    versionTag: string;
}

export interface ProcessDefinitionCaseDefinitionId extends AbstractId<ProcessDefinitionCaseDefinitionId> {
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

export interface AbstractAuditingEntity {
}

export interface TeamDto extends Team {
}

export interface AssigneeDto {
    username: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
}

export interface FormFieldValidationConstraint {
    configuration: any;
    name: string;
}

export interface TypedValue extends Serializable {
    value: any;
    type: ValueType;
    transient: boolean;
}

export interface FormType {
    name: string;
}

export interface StringProcessVariableDTOV2 extends ProcessVariableDTOV2 {
    "@type": "string";
    value: string;
}

export interface DateProcessVariableDTOV2 extends ProcessVariableDTOV2 {
    "@type": "date";
    range: DateRange;
}

export interface BooleanProcessVariableDTOV2 extends ProcessVariableDTOV2 {
    "@type": "boolean";
    value: boolean;
}

export interface EnumProcessVariableDTOV2 extends ProcessVariableDTOV2 {
    "@type": "enum";
    values: string[];
}

export interface LongProcessVariableDTOV2 extends ProcessVariableDTOV2 {
    "@type": "long";
    value: number;
}

export interface FileUploadProcessVariableDTOV2 extends ProcessVariableDTOV2 {
    "@type": "fileUpload";
    value: boolean;
}

export interface AbstractId<SELF> extends Identity, Serializable {
}

export interface ContainerNode<T> extends BaseJsonNode, JsonNodeCreator {
}

export interface ProcessDefinitionId {
    id: string;
}

export interface Team {
    title: string;
    key: string;
}

export interface ValueType extends Serializable {
    primitiveValueType: boolean;
    name: string;
    parent: ValueType;
    abstract: boolean;
}

export interface DateRange {
    from: DateAsString;
    to: DateAsString;
}

export interface Identity {
}

export interface BaseJsonNode extends Serializable {
}

export interface JsonNodeCreator {
}

export type DateAsString = string;

export type StartableItemType = "PROCESS" | "BUILDING_BLOCK";

export type JobType = "TIMER" | "ASYNC_CONTINUATION" | "MESSAGE" | "BATCH" | "OTHER";

export type ProcessVariableType = "STRING" | "INTEGER" | "LONG" | "DOUBLE" | "BOOLEAN" | "JSON";

export type ColumnDefaultSort = "ASC" | "DESC";

export type CaseTabType = "standard" | "formio" | "custom" | "widgets";

export type DashboardWidgetLayout = "MUURI_GAP_FREE" | "MUURI" | "BEAUTIFUL";

export type CaseTagColor = "WARMGRAY" | "RED" | "MAGENTA" | "PURPLE" | "BLUE" | "CYAN" | "TEAL" | "GREEN" | "GRAY" | "COOLGRAY" | "HIGHCONTRAST" | "OUTLINE";

export type InternalCaseStatusColor = "WARMGRAY" | "RED" | "MAGENTA" | "PURPLE" | "BLUE" | "CYAN" | "TEAL" | "GREEN" | "GRAY" | "COOLGRAY" | "HIGHCONTRAST" | "OUTLINE";

export type DocumentStatusType = "in_bewerking" | "ter_vaststelling" | "definitief" | "gearchiveerd";

export type ActivityTypeWithEventName = "bpmn:MultiInstanceBody:start" | "bpmn:MultiInstanceBody:end" | "bpmn:ExclusiveGateway:start" | "bpmn:ExclusiveGateway:end" | "bpmn:InclusiveGateway:start" | "bpmn:InclusiveGateway:end" | "bpmn:ParallelGateway:start" | "bpmn:ParallelGateway:end" | "bpmn:ComplexGateway:start" | "bpmn:ComplexGateway:end" | "bpmn:EventBasedGateway:start" | "bpmn:EventBasedGateway:end" | "bpmn:Task:start" | "bpmn:Task:end" | "bpmn:ScriptTask:start" | "bpmn:ScriptTask:end" | "bpmn:ServiceTask:start" | "bpmn:ServiceTask:end" | "bpmn:BusinessRuleTask:start" | "bpmn:BusinessRuleTask:end" | "bpmn:ManualTask:start" | "bpmn:ManualTask:end" | "bpmn:UserTask:create" | "bpmn:UserTask:assignment" | "bpmn:UserTask:complete" | "bpmn:UserTask:update" | "bpmn:UserTask:delete" | "bpmn:UserTask:timeout" | "bpmn:UserTask:start" | "bpmn:UserTask:end" | "bpmn:SendTask:start" | "bpmn:SendTask:end" | "bpmn:ReceiveTask:start" | "bpmn:ReceiveTask:end" | "bpmn:SubProcess:start" | "bpmn:SubProcess:end" | "bpmn:AdHocSubProcess:start" | "bpmn:AdHocSubProcess:end" | "bpmn:CallActivity:start" | "bpmn:CallActivity:end" | "bpmn:Transaction:start" | "bpmn:Transaction:end" | "bpmn:BoundaryTimer:start" | "bpmn:BoundaryTimer:end" | "bpmn:BoundaryMessage:start" | "bpmn:BoundaryMessage:end" | "bpmn:BoundarySignal:start" | "bpmn:BoundarySignal:end" | "bpmn:CompensationBoundaryCatch:start" | "bpmn:CompensationBoundaryCatch:end" | "bpmn:BoundaryError:start" | "bpmn:BoundaryError:end" | "bpmn:BoundaryEscalation:start" | "bpmn:BoundaryEscalation:end" | "bpmn:CancelBoundaryCatch:start" | "bpmn:CancelBoundaryCatch:end" | "bpmn:BoundaryConditional:start" | "bpmn:BoundaryConditional:end" | "bpmn:StartEvent:start" | "bpmn:StartEvent:end" | "bpmn:StartTimerEvent:start" | "bpmn:StartTimerEvent:end" | "bpmn:MessageStartEvent:start" | "bpmn:MessageStartEvent:end" | "bpmn:SignalStartEvent:start" | "bpmn:SignalStartEvent:end" | "bpmn:EscalationStartEvent:start" | "bpmn:EscalationStartEvent:end" | "bpmn:CompensationStartEvent:start" | "bpmn:CompensationStartEvent:end" | "bpmn:ErrorStartEvent:start" | "bpmn:ErrorStartEvent:end" | "bpmn:ConditionalStartEvent:start" | "bpmn:ConditionalStartEvent:end" | "bpmn:IntermediateCatchEvent:start" | "bpmn:IntermediateCatchEvent:end" | "bpmn:IntermediateMessageCatch:start" | "bpmn:IntermediateMessageCatch:end" | "bpmn:IntermediateTimer:start" | "bpmn:IntermediateTimer:end" | "bpmn:IntermediateLinkCatch:start" | "bpmn:IntermediateLinkCatch:end" | "bpmn:IntermediateSignalCatch:start" | "bpmn:IntermediateSignalCatch:end" | "bpmn:IntermediateConditional:start" | "bpmn:IntermediateConditional:end" | "bpmn:IntermediateThrowEvent:start" | "bpmn:IntermediateThrowEvent:end" | "bpmn:IntermediateSignalThrow:start" | "bpmn:IntermediateSignalThrow:end" | "bpmn:IntermediateCompensationThrowEvent:start" | "bpmn:IntermediateCompensationThrowEvent:end" | "bpmn:IntermediateMessageThrowEvent:start" | "bpmn:IntermediateMessageThrowEvent:end" | "bpmn:IntermediateNoneThrowEvent:start" | "bpmn:IntermediateNoneThrowEvent:end" | "bpmn:IntermediateEscalationThrowEvent:start" | "bpmn:IntermediateEscalationThrowEvent:end" | "bpmn:ErrorEndEvent:start" | "bpmn:ErrorEndEvent:end" | "bpmn:CancelEndEvent:start" | "bpmn:CancelEndEvent:end" | "bpmn:TerminateEndEvent:start" | "bpmn:TerminateEndEvent:end" | "bpmn:MessageEndEvent:start" | "bpmn:MessageEndEvent:end" | "bpmn:SignalEndEvent:start" | "bpmn:SignalEndEvent:end" | "bpmn:CompensationEndEvent:start" | "bpmn:CompensationEndEvent:end" | "bpmn:EscalationEndEvent:start" | "bpmn:EscalationEndEvent:end" | "bpmn:NoneEndEvent:start" | "bpmn:NoneEndEvent:end";

export type FormDisplayType = "modal" | "panel";

export type FormSizes = "extraSmall" | "small" | "medium" | "large";

export type DataType = "text" | "number" | "date" | "datetime" | "time" | "boolean" | "bsn";

export type FieldType = "text_contains" | "single" | "range" | "single-select-dropdown" | "multi-select-dropdown";

export type SearchFieldMatchType = "like" | "exact";

export type TabWidgetLayout = "MUURI_GAP_FREE" | "MUURI" | "BEAUTIFUL";

export type WidgetColor = "YELLOW" | "ORANGE" | "RED" | "BROWN" | "GREEN" | "TURQOISE" | "PURPLE" | "PERIWINKLE" | "BLUE" | "HIGHCONTRAST" | "WHITE";

export type BuildingBlockSyncTiming = "CONTINUOUS" | "END";

export type DocumentRelationType = "PREVIOUS" | "NEXT" | "SUPPORTING";

export type ValidationSeverity = "ERROR" | "WARNING";

export type ExpressionOperator = "!=" | "==" | ">" | ">=" | "<" | "<=" | "list_contains" | "in";

export type ProcessVariableDTOV2Union = StringProcessVariableDTOV2 | DateProcessVariableDTOV2 | BooleanProcessVariableDTOV2 | EnumProcessVariableDTOV2 | LongProcessVariableDTOV2 | FileUploadProcessVariableDTOV2;
