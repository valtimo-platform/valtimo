package com.ritense.documentenapipreview.domain

import com.fasterxml.jackson.annotation.JsonProperty

enum class PdfArchiveMethod {
    @JsonProperty("none")
    NONE,

    @JsonProperty("PDF/A-1b")
    PDFA1B,

    @JsonProperty("PDF/A-2b")
    PDFA2B,

    @JsonProperty("PDF/A-3b")
    PDFA3B,
}