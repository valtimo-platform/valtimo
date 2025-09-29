package com.ritense.case_.repository

import com.ritense.case_.domain.header.CaseHeaderWidget
import com.ritense.case_.domain.header.CaseHeaderWidgetId
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.stereotype.Repository

@Repository
interface CaseHeaderWidgetRepository :
    JpaRepository<CaseHeaderWidget, CaseHeaderWidgetId>,
    JpaSpecificationExecutor<CaseHeaderWidget>