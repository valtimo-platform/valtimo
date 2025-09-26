package com.ritense.formviewmodel.submission

import com.ritense.formviewmodel.error.FormException
import com.ritense.formviewmodel.viewmodel.TestViewModel
import com.ritense.processlink.domain.ProcessLink
import com.ritense.processlink.uicomponent.domain.UIComponentProcessLink

open class TestStartFormUIComponentSubmissionHandler(
    val componentKey: String = "my-component",
) : FormViewModelStartFormSubmissionHandler<TestViewModel> {

    override fun supports(processLink: ProcessLink): Boolean {
        return (processLink as? UIComponentProcessLink)?.componentKey == componentKey
    }

    override fun <T> handle(
        documentDefinitionName: String,
        processDefinitionKey: String,
        submission: T
    ) {
        submission as TestViewModel
        if (submission.age!! < 18) {
            throw FormException("Age should be 18 or older")
        }
    }

}