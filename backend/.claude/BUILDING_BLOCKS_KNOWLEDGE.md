# Building Blocks Feature - Knowledge Document

## Branch: `feature/building-blocks`

## Overview

Building blocks are reusable process components with **isolated documents**. They can be nested (building blocks calling other building blocks) while maintaining document isolation.

---

## Key Architectural Concepts

### 1. Document Isolation

Each building block has its own document. Data flows through explicit input/output mappings only:

```
Case Document (applicantName, householdSize)
    ↓ input mappings
BB-A Document (applicantName, householdSize, verifiedApplicant, ...)
    ↓ input mappings
BB-B Document (applicantName, householdSize, eligibilityResult, ...)
    ↑ output mappings (writes to BB-A doc)
    ↑ output mappings (writes to case doc)
```

### 2. Key Variables

| Variable | Purpose | Scope |
|----------|---------|-------|
| `buildingBlockInstanceId` | The document ID of the current building block | Process variable - used to determine which document to read/write |
| `rootCaseDocumentId` | The original case document ID | Used for ZGW plugins, zaaktype links - NOT for output mappings |
| `parentBuildingBlockInstanceId` | Links to parent BB instance | Stored in `BuildingBlockInstance` entity |
| `sourceDocumentId` | Parent's document ID | **Local variable only** - used during input mapping resolution, NOT passed to child process |

### 3. Output Mapping Flow

**Critical**: Output mappings write to the **immediate parent only**, not directly to the root case.

```kotlin
// BuildingBlockCallActivityListener.onCallActivityEnd()
val targetDocumentId = if (buildingBlockInstance.parentBuildingBlockInstanceId != null) {
    parentInstance.documentId  // Write to PARENT building block
} else {
    buildingBlockInstance.caseDocumentId  // Only if top-level
}
```

Data bubbles up because each level has explicit output mappings that read from its document and write to its parent.

### 4. Document Resolution During Execution

When `doc:fieldName` is resolved during building block execution:
- `OperatonProcessJsonSchemaDocumentService.getDocumentId()` checks for `buildingBlockInstanceId`
- If present → returns the building block's OWN document
- Building blocks always read from their own document during execution

---

## Important Files

### Core Building Block Files

| File | Purpose |
|------|---------|
| `BuildingBlockCallActivityListener.kt` | Handles call activity start/end, creates BB instances, processes input/output mappings |
| `BuildingBlockInstance.kt` | Entity with `documentId`, `caseDocumentId`, `parentBuildingBlockInstanceId`, `activityId` |
| `BuildingBlockInstanceService.kt` | CRUD operations for building block instances |
| `BuildingBlockProcessLink.kt` | Process link entity with input/output mappings |
| `BuildingBlockProcessLinkMapper.kt` | Maps DTOs to entities, handles nested BB detection |

### Value Resolution

| File | Purpose |
|------|---------|
| `CaseDocumentJsonValueResolverFactory.kt` | Resolves `doc:` prefix values |
| `OperatonProcessJsonSchemaDocumentService.java` | `getDocumentId()` determines which document to use based on `buildingBlockInstanceId` |
| `ValueResolverService.kt` | Orchestrates value resolution across different prefixes |

### Process Link Infrastructure

| File | Purpose |
|------|---------|
| `ProcessLinkMapper.kt` | Interface - changed to accept `BlueprintId?` instead of `CaseDefinitionId?` |
| `ProcessLinkService.kt` | Creates/updates process links |
| `ProcessDeploymentService.kt` | Deploys BPMN and creates process links |

---

## Recent Fixes (This Session)

### 1. BlueprintId Interface Change

**Problem**: When saving building block process links via UI, got error "CaseDefinitionId is required for building-block process links in case processes"

**Root Cause**: When deploying via UI, a new process definition version is created. The mapper checked if the new processDefinitionId existed in the building block links table, but the link wasn't created yet.

**Solution**: Changed `ProcessLinkMapper` interface to accept `BlueprintId?` instead of `CaseDefinitionId?`. The mapper now checks:
```kotlin
val isNestedBuildingBlockLink = blueprintId is BuildingBlockDefinitionId ||
    repository.existsByIdProcessDefinitionIdId(processDefinitionId)
```

**Files Changed**:
- `ProcessLinkMapper.kt` - Interface change
- `ProcessLinkService.kt` - Parameter type change
- `ProcessDeploymentService.kt` - Removed cast
- All mapper implementations (Form, Plugin, FormFlow, URL, UIComponent, BuildingBlock, test mappers)

---

## Sample Scenario: Energy Subsidy Application (Energietoeslag Aanvraag)

### Structure
```
Case: energy-subsidy-request
└── BB: subsidy-calculator (Subsidie Berekening)
    └── BB: household-verification (Huishouden Verificatie)
        ├── Process: brp-lookup (BRP Opvraging) - internal, not a BB
        └── BB: income-check (Inkomenstoets)
```

### Data Flow
```
Input: applicantName="Max", householdSize=2

1. BRP Lookup: "[BRP GEVERIFIEERD] Max"
2. Household Verification: verifiedApplicant="Geverifieerd: [BRP GEVERIFIEERD] Max"
3. Income Check: eligibilityResult="Geschikt: Max (huishouden: 2 personen)"
4. Household Verification: baseSubsidyAmount = 2 * 2 = 4
5. Subsidy Calculator: finalSubsidyAmount = 4 + 100 = 104

Output: verifiedApplicant, calculatedSubsidy=104, eligibilityResult
```

### Config Files Location
```
backend/app/gzac/src/dev/resources/config/
├── building-block/
│   ├── income-check/1-0-0/
│   ├── household-verification/1-0-0/
│   └── subsidy-calculator/1-0-0/
└── case/
    └── energy-subsidy-request/1-0-0/
```

---

## Mapping Configuration

### Input Mapping Example
```json
{
    "source": "doc:applicantName",
    "target": "applicantName"
}
```
- `source`: Read from parent's document (using `sourceDocumentId` during input mapping phase)
- `target`: Write to child's document (field name, no prefix)

### Output Mapping Example
```json
{
    "source": "eligibilityResult",
    "target": "doc:eligibilityResult",
    "syncTiming": "END"
}
```
- `source`: Read from child's document (field name or `doc:` prefix)
- `target`: Write to parent's document (`doc:` prefix)
- `syncTiming`: `END` means write when building block completes

---

## Testing

### Integration Test
`NestedBuildingBlockIT.kt` - Tests the full nested building block flow

### Running the Sample
1. Start GZAC backend
2. Create a new "Energietoeslag Aanvraag" case
3. Fill in: Naam aanvrager, Aantal personen in huishouden
4. Submit and observe the calculated results

---

## Key Gotchas

1. **Process Definition IDs change on deploy** - When editing via UI, a new version is created with a new ID
2. **sourceDocumentId is NOT a process variable** - Only used locally during input mapping
3. **rootCaseDocumentId is for ZGW context** - NOT for output mapping writes
4. **Building blocks read from their OWN document** - Not from parent or case during execution
5. **Output mappings must be explicit at each level** - Data doesn't automatically bubble up
