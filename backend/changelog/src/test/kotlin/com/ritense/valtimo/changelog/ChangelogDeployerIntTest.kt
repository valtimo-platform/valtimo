/*
 *  Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 *  Licensed under EUPL, Version 1.2 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" basis,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package com.ritense.valtimo.changelog

import com.ritense.valtimo.BaseIntegrationTest
import com.ritense.valtimo.changelog.domain.Changeset
import com.ritense.valtimo.changelog.domain.ChangesetCheckSumType
import com.ritense.valtimo.changelog.repository.ChangesetRepository
import com.ritense.valtimo.changelog.service.ChangelogDeployer
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import java.time.Instant

internal class ChangelogDeployerIntTest : BaseIntegrationTest() {

    @Autowired
    lateinit var changesetRepository: ChangesetRepository

    @Autowired
    lateinit var changelogDeployer: ChangelogDeployer

    @Autowired
    lateinit var testTypeChangesetDeployer: TestTypeChangesetDeployer

    @Test
    fun `should deploy  file from resource folder`() {

        val changeset = changesetRepository.findById("initial-testtype")

        assertThat(changeset.isPresent).isTrue()
        assertThat(changeset.get().filename).endsWith("/initial.testtype.json")
        assertThat(changeset.get().dateExecuted).isBetween(Instant.parse("2023-06-13T00:00:00Z"), Instant.now())
        assertThat(changeset.get().orderExecuted).isBetween(0, 1000)
        assertThat(changeset.get().md5sum).isEqualTo("a6c383282ddb4fe67632b182eb11656f")
        assertThat(changeset.get().checksumType).isEqualTo(ChangesetCheckSumType.FILE_HASH)
    }

    @Test
    fun `should ignore whitespace changes in changeset`() {
        val filename = "/initial.testtype.json"
        val content = """
            {"testContent":    ["a",     "b" ,
                 "c"
            ] , "changesetId" :   "initial-testtype"}"""

        changelogDeployer.deploy(testTypeChangesetDeployer, filename, content)

        val changeset = changesetRepository.findById("initial-testtype")
        assertThat(changeset.isPresent).isTrue()
    }

    @Test
    fun `should throw error when changeset changed`() {
        val filename = "/initial.testtype.json"
        val content = """
            {
                "changesetId": "initial-testtype",
                "testContent": ["a", "b", "c", "new-value"]
            }"""

        val exception = assertThrows<RuntimeException> {
            changelogDeployer.deploy(testTypeChangesetDeployer, filename, content)
        }
        assertThat(exception.cause!!.message).isEqualTo("Computed checksum '7bd57c7d9670d1c81cd5da9f7a7a92f5' doesn't match existing 'a6c383282ddb4fe67632b182eb11656f' for test/config/import/initial.testtype.json")
    }

    @Test
    fun `should migrate changeset checksum when it uses the old format`() {

        changesetRepository.save(
            Changeset(
                id = "new-testtype",
                key = null,
                filename = "/new.testtype.json",
                dateExecuted = Instant.now(),
                orderExecuted = 100,
                md5sum = "c29a5747d698b2f95cdfd5ed6502f19d",
                checksumType = ChangesetCheckSumType.LEGACY
            )
        )

        val filename = "/new.testtype.json"
        val content = """
            {
                "changesetId": "new-testtype",
                "testContent": ["a", "b", "c"]
            }"""

        changelogDeployer.deploy(testTypeChangesetDeployer, filename, content)

        // Verify that changeset has been updated to new checksum type
        val changeset = changesetRepository.findById("new-testtype")
        assertThat(changeset.isPresent).isTrue()
        assertThat(changeset.get().md5sum).isEqualTo("7b30a822ba6369cfb1d7bb2a1adf0f92")
        assertThat(changeset.get().checksumType).isEqualTo(ChangesetCheckSumType.FILE_HASH)
    }
}
