/*
 * Copyright 2015-2024 Ritense BV, the Netherlands.
 *
 * Licensed under EUPL, Version 1.2 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://joinup.ec.europa.eu/collection/eupl/eupl-text-eupl-12
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package com.ritense.processdocument.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.ritense.processdocument.BaseIntegrationTest;
import com.ritense.processdocument.domain.CaseDefinitionProcessLink;
import com.ritense.processdocument.domain.CaseDefinitionProcessLinkId;
import com.ritense.processdocument.domain.impl.request.DocumentDefinitionProcessRequest;
import com.ritense.processdocument.repository.CaseDefinitionProcessLinkRepository;
import com.ritense.processdocument.service.CaseDefinitionProcessLinkService;
import com.ritense.case_.repository.CaseDefinitionRepository;
import com.ritense.valtimo.contract.case_.CaseDefinitionId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.operaton.bpm.engine.RepositoryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class CaseDefinitionProcessLinkServiceIntTest extends BaseIntegrationTest {

    private static final String DOCUMENT_DEFINITION_NAME = "house";
    private static final CaseDefinitionId CASE_DEFINITION_ID = new CaseDefinitionId(DOCUMENT_DEFINITION_NAME, "1.0.0");
    private static final String DOCUMENT_UPLOAD = "DOCUMENT_UPLOAD";
    private static final String PROCESS_DEFINITION_KEY = "loan-process-demo";
    private static final String SYSTEM_PROCESS_KEY = "system-process";

    @Autowired
    private CaseDefinitionProcessLinkRepository caseDefinitionProcessLinkRepository;

    @Autowired
    private CaseDefinitionProcessLinkService caseDefinitionProcessLinkService;

    @Autowired
    private RepositoryService repositoryService;

    @Autowired
    private CaseDefinitionRepository caseDefinitionRepository;

    @BeforeEach
    public void beforeEach() {
        caseDefinitionProcessLinkService.saveDocumentDefinitionProcess(
            CASE_DEFINITION_ID,
            new DocumentDefinitionProcessRequest(
                PROCESS_DEFINITION_KEY,
                DOCUMENT_UPLOAD
            )
        );
    }

    @Test
    void shouldGetDocumentDefinitionProcessLink() {
        var link = caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(
            CASE_DEFINITION_ID,
            DOCUMENT_UPLOAD
        );

        assertThat(link).isNotNull();
        assertThat(link.getId().getCaseDefinitionId()).isEqualTo(CASE_DEFINITION_ID);
        assertThat(link.getId().getProcessDefinitionKey()).isEqualTo(PROCESS_DEFINITION_KEY);
        assertThat(link.getType()).isEqualTo(DOCUMENT_UPLOAD);
    }

    @Test
    void shouldOverrideProcessDefinitionKeyInLinkWhenSaving() {
        caseDefinitionProcessLinkService.saveDocumentDefinitionProcess(
            CASE_DEFINITION_ID,
            new DocumentDefinitionProcessRequest(
                "embedded-subprocess-example",
                DOCUMENT_UPLOAD
            )
        );

        var caseDefinitionProcess = caseDefinitionProcessLinkService.getDocumentDefinitionProcess(CASE_DEFINITION_ID, DOCUMENT_UPLOAD);

        assertThat(caseDefinitionProcess).isNotNull();
        assertThat(caseDefinitionProcess.getProcessDefinitionKey()).isEqualTo("embedded-subprocess-example");
    }

    @Test
    void shouldNotPinAProcessTheCaseDefinitionOwns() {
        var link = caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(
            CASE_DEFINITION_ID,
            DOCUMENT_UPLOAD
        );

        assertThat(link.getProcessDefinitionVersion()).isNull();
    }

    @Test
    void shouldPinTheCurrentVersionOfASystemProcess() {
        deploySystemProcess();
        deploySystemProcess();

        caseDefinitionProcessLinkService.saveDocumentDefinitionProcess(
            CASE_DEFINITION_ID,
            new DocumentDefinitionProcessRequest(SYSTEM_PROCESS_KEY, DOCUMENT_UPLOAD)
        );

        var link = caseDefinitionProcessLinkService.getDocumentDefinitionProcessLink(
            CASE_DEFINITION_ID,
            DOCUMENT_UPLOAD
        );

        assertThat(link.getProcessDefinitionVersion()).isEqualTo(2);
    }

    @Test
    void shouldKeepResolvingThePinnedVersionAfterANewSystemProcessVersionIsDeployed() {
        deploySystemProcess();

        caseDefinitionProcessLinkService.saveDocumentDefinitionProcess(
            CASE_DEFINITION_ID,
            new DocumentDefinitionProcessRequest(SYSTEM_PROCESS_KEY, DOCUMENT_UPLOAD)
        );
        deploySystemProcess();

        var caseDefinitionProcess = caseDefinitionProcessLinkService.getDocumentDefinitionProcess(
            CASE_DEFINITION_ID,
            DOCUMENT_UPLOAD
        );

        assertThat(caseDefinitionProcess).isNotNull();
        assertThat(caseDefinitionProcess.getProcessDefinitionVersion()).isEqualTo(1);
    }

    @Test
    void shouldPinAnUnpinnedLinkOfACaseDefinitionThatCanNoLongerChange() {
        deploySystemProcess();
        caseDefinitionProcessLinkRepository.save(
            new CaseDefinitionProcessLink(
                CaseDefinitionProcessLinkId.newId(CASE_DEFINITION_ID, SYSTEM_PROCESS_KEY),
                DOCUMENT_UPLOAD,
                null
            )
        );
        finalizeCaseDefinition();

        caseDefinitionProcessLinkService.pinLinksThatCanNoLongerChange();

        assertThat(systemProcessLink().getProcessDefinitionVersion()).isEqualTo(1);
    }

    @Test
    void shouldLeaveAnUnpinnedLinkOfACaseDefinitionThatCanStillChange() {
        deploySystemProcess();
        caseDefinitionProcessLinkRepository.save(
            new CaseDefinitionProcessLink(
                CaseDefinitionProcessLinkId.newId(CASE_DEFINITION_ID, SYSTEM_PROCESS_KEY),
                DOCUMENT_UPLOAD,
                null
            )
        );

        caseDefinitionProcessLinkService.pinLinksThatCanNoLongerChange();

        assertThat(systemProcessLink().getProcessDefinitionVersion()).isNull();
    }

    private CaseDefinitionProcessLink systemProcessLink() {
        return caseDefinitionProcessLinkRepository
            .findById(CaseDefinitionProcessLinkId.newId(CASE_DEFINITION_ID, SYSTEM_PROCESS_KEY))
            .orElseThrow();
    }

    private void deploySystemProcess() {
        repositoryService.createDeployment()
            .addClasspathResource("bpmn/" + SYSTEM_PROCESS_KEY + ".bpmn")
            .deploy();
    }

    private void finalizeCaseDefinition() {
        var caseDefinition = caseDefinitionRepository.findById(CASE_DEFINITION_ID).orElseThrow();
        caseDefinitionRepository.save(caseDefinition.copy(
            caseDefinition.getId(),
            caseDefinition.getName(),
            caseDefinition.getDescription(),
            caseDefinition.getCreatedBy(),
            caseDefinition.getCreatedDate(),
            caseDefinition.getBasedOnVersionTag(),
            true,
            caseDefinition.getActive(),
            caseDefinition.getCanHaveAssignee(),
            caseDefinition.getAutoAssignTasks(),
            caseDefinition.getHasExternalStartForm(),
            caseDefinition.getExternalStartFormUrl(),
            caseDefinition.getExternalStartFormDescription(),
            caseDefinition.getOriginalKey(),
            caseDefinition.getOriginalName(),
            caseDefinition.getOriginalVersionTag()
        ));
    }
}
