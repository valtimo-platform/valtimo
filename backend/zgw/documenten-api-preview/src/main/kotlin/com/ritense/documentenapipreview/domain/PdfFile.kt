package com.ritense.documentenapipreview.domain

import java.io.InputStream

class PdfFile (
    val fileName: String,
    val content: InputStream
)