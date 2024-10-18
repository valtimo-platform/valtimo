package com.ritense.extension

import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class ExtensionServiceIntTest @Autowired constructor(
    private val extensionService: ExtensionService
): BaseIntegrationTest() {

    @Test
    fun `should extension a zip`() {
        val bytes = extensionService.extension(TestExtensionRequest()).toByteArray()
        val entries = ZipInputStream(ByteArrayInputStream(bytes)).use {
            generateSequence { it.nextEntry }
                .toList()
        }

        assertThat(entries.singleOrNull { it.name == "test.txt" }).isNotNull
        assertThat(entries.singleOrNull { it.name == "nested.txt" }).isNotNull
    }

    @Test
    fun `should extension an empty zip`() {
        val bytes = extensionService.extension(TestExtensionRequest(required = false)).toByteArray()
        val entries = ZipInputStream(ByteArrayInputStream(bytes)).use {
            generateSequence { it.nextEntry }
                .toList()
        }

        assertThat(entries.isEmpty())
    }

    @Test
    fun `should not result in a stackoverflow`() {
        val bytes = extensionService.extension(TestStackOverflowExtensionRequest()).toByteArray()
        val entries = ZipInputStream(ByteArrayInputStream(bytes)).use {
            generateSequence { it.nextEntry }
                .toList()
        }
        assertThat(entries).isEmpty()
    }
}