/*
 * Copyright 2015-2026 Ritense BV, the Netherlands.
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

package com.ritense.valtimo.web.rest;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultHandlers.print;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ritense.valtimo.BaseIntegrationTest;
import com.ritense.valtimo.choicefield.repository.ChoiceFieldRepository;
import com.ritense.valtimo.choicefield.repository.ChoiceFieldValueRepository;
import com.ritense.valtimo.domain.choicefield.ChoiceField;
import com.ritense.valtimo.domain.choicefield.ChoiceFieldValue;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

@Transactional
class ChoiceFieldValueResourceIntTest extends BaseIntegrationTest {

    private MockMvc mockMvc;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @Autowired
    private ChoiceFieldRepository choiceFieldRepository;

    @Autowired
    private ChoiceFieldValueRepository choiceFieldValueRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void init() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    void shoudlRetrieveChoicefieldValues() throws Exception {
        ChoiceField choiceField = new ChoiceField();
        choiceField.setKeyName("keyName");
        choiceField.setTitle("title");
        choiceFieldRepository.save(choiceField);

        ChoiceFieldValue choiceFieldValue = new ChoiceFieldValue();
        choiceFieldValue.setChoiceField(choiceField);
        choiceFieldValue.setValue("value");
        choiceFieldValue.setName("name");
        choiceFieldValue.setDeprecated(false);
        choiceFieldValueRepository.save(choiceFieldValue);

        mockMvc.perform(
            get("/api/v1/choice-field-values/{choice_field_name}/values", "keyName")
                .accept(APPLICATION_JSON_VALUE)
        )
        .andDo(print())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").isNumber())
        .andExpect(jsonPath("$[0].value").value("value"))
        .andExpect(jsonPath("$[0].deprecated").value(false))
        .andExpect(jsonPath("$[0].name").value("name"))
        .andExpect(jsonPath("$[0].choiceField.id").isNumber())
        .andExpect(jsonPath("$[0].choiceField.keyName").value("keyName"))
        .andExpect(jsonPath("$[0].choiceField.title").value("title"));
    }

    @Test
    void shouldExcludeDeprecatedValuesFromV2ByDefault() throws Exception {
        ChoiceField choiceField = new ChoiceField();
        choiceField.setKeyName("test-field");
        choiceField.setTitle("Test Field");
        choiceFieldRepository.save(choiceField);

        ChoiceFieldValue activeValue = new ChoiceFieldValue();
        activeValue.setChoiceField(choiceField);
        activeValue.setValue("active-value");
        activeValue.setName("Active");
        activeValue.setDeprecated(false);
        choiceFieldValueRepository.save(activeValue);

        ChoiceFieldValue deprecatedValue = new ChoiceFieldValue();
        deprecatedValue.setChoiceField(choiceField);
        deprecatedValue.setValue("deprecated-value");
        deprecatedValue.setName("Deprecated");
        deprecatedValue.setDeprecated(true);
        choiceFieldValueRepository.save(deprecatedValue);

        mockMvc.perform(
            get("/api/v2/choice-field-values/{choice_field_name}/values", "test-field")
                .accept(APPLICATION_JSON_VALUE)
        )
        .andDo(print())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(1))
        .andExpect(jsonPath("$.content[0].value").value("active-value"))
        .andExpect(jsonPath("$.content[0].deprecated").value(false));
    }

    @Test
    void shouldIncludeDeprecatedValuesWhenRequested() throws Exception {
        ChoiceField choiceField = new ChoiceField();
        choiceField.setKeyName("test-field-2");
        choiceField.setTitle("Test Field 2");
        choiceFieldRepository.save(choiceField);

        ChoiceFieldValue activeValue = new ChoiceFieldValue();
        activeValue.setChoiceField(choiceField);
        activeValue.setValue("active-value");
        activeValue.setName("Active");
        activeValue.setDeprecated(false);
        choiceFieldValueRepository.save(activeValue);

        ChoiceFieldValue deprecatedValue = new ChoiceFieldValue();
        deprecatedValue.setChoiceField(choiceField);
        deprecatedValue.setValue("deprecated-value");
        deprecatedValue.setName("Deprecated");
        deprecatedValue.setDeprecated(true);
        choiceFieldValueRepository.save(deprecatedValue);

        mockMvc.perform(
            get("/api/v2/choice-field-values/{choice_field_name}/values", "test-field-2")
                .param("includeDeprecated", "true")
                .accept(APPLICATION_JSON_VALUE)
        )
        .andDo(print())
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content.length()").value(2));
    }
}