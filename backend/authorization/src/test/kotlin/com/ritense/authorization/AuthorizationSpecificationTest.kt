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

package com.ritense.authorization

import com.ritense.authorization.AuthorizationSupportedHelper
import com.ritense.authorization.permission.ConditionContainer
import com.ritense.authorization.permission.Permission
import com.ritense.authorization.permission.condition.ContainerPermissionCondition
import com.ritense.authorization.permission.condition.FieldPermissionCondition
import com.ritense.authorization.permission.condition.PermissionConditionOperator
import com.ritense.authorization.request.AuthorizationResourceContext
import com.ritense.authorization.request.EntityAuthorizationRequest
import com.ritense.authorization.request.RelatedEntityAuthorizationRequest
import com.ritense.authorization.role.Role
import com.ritense.authorization.specification.AuthorizationSpecification
import com.ritense.authorization.testimpl.RelatedTestEntity
import com.ritense.authorization.testimpl.TestAuthorizationSpecification
import com.ritense.authorization.testimpl.TestDocumentAuthorizationSpecification
import com.ritense.authorization.testimpl.TestDocument
import com.ritense.authorization.testimpl.TestEntity
import com.ritense.authorization.testimpl.TestEntityActionProvider
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.mock
import org.mockito.kotlin.spy
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import kotlin.test.assertEquals

class AuthorizationSpecificationTest {

    lateinit var authorizationService: AuthorizationService

    @BeforeEach
    fun setup() {
        authorizationService = mock()
        AuthorizationServiceHolder(authorizationService)

        val applicationContext: org.springframework.context.ApplicationContext = mock()
        whenever(applicationContext.getBeanNamesForType(any<org.springframework.core.ResolvableType>()))
            .thenReturn(arrayOf("testBean"))
        AuthorizationSupportedHelper.setApplicationContext(applicationContext)
    }

    @Test
    fun `isAuthorized should return true`() {
        val spec = TestAuthorizationSpecification(
            EntityAuthorizationRequest(
                TestEntity::class.java, action = TestEntityActionProvider.complete, TestEntity()
            ),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.complete),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should return false if no permission can be found for entity class`() {
        val spec = TestAuthorizationSpecification(
            EntityAuthorizationRequest(
                TestEntity::class.java, action = TestEntityActionProvider.complete, TestEntity()
            ),
            {
                listOf(
                    Permission(
                        resourceType = String::class.java,
                        actions = mutableListOf(TestEntityActionProvider.complete),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        ) as AuthorizationSpecification<Any>

        assertEquals(false, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should return false if no permission can be found for requested action`() {
        val spec = TestAuthorizationSpecification(
            EntityAuthorizationRequest(
                TestEntity::class.java, action = TestEntityActionProvider.view, TestEntity()
            ),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.complete),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(false, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should return false when Permission_appliesTo() returns false`() {
        val permission: Permission = spy(
            Permission(
                resourceType = TestEntity::class.java,
                actions = mutableListOf(TestEntityActionProvider.complete),
                conditionContainer = ConditionContainer(listOf()),
                role = Role(key = "")
            )
        )
        val spec = TestAuthorizationSpecification(
            EntityAuthorizationRequest(
                TestEntity::class.java, action = TestEntityActionProvider.complete, TestEntity()
            ),
            {
                listOf(
                    permission
                )
            },
            mock()
        )

        whenever(permission.appliesTo(eq(TestEntity::class.java), any(), eq(null), eq(null))).thenReturn(false)

        val authorized = spec.isAuthorized()
        assertEquals(false, authorized)

        verify(permission).appliesTo(eq(TestEntity::class.java), any(), eq(null), eq(null))
    }

    @Test
    fun `isAuthorized should return true for related entity with matching resource type`() {
        val spec = TestAuthorizationSpecification(
            RelatedEntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view,
                TestEntity::class.java,
                "some-id"
            ),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should return false for related entity with no matching permission`() {
        val spec = TestAuthorizationSpecification(
            RelatedEntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view,
                TestEntity::class.java,
                "some-id"
            ),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.complete),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(false, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should use mapper when related resource type differs from resource type`() {
        val mapper: AuthorizationEntityMapper<TestDocument, TestEntity> = mock()
        val mappedEntity = TestEntity(name = "mapped")

        whenever(authorizationService.hasMapper(TestDocument::class.java, TestEntity::class.java)).thenReturn(true)
        whenever(authorizationService.getMapper<TestDocument, TestEntity>(any(), any())).thenReturn(mapper)
        whenever(mapper.mapRelated(any())).thenReturn(listOf(mappedEntity))

        // resolveRelatedEntity needs a spec that can look up the TestDocument by identifier
        whenever(authorizationService.getAuthorizationSpecification<TestDocument>(any(), any()))
            .thenReturn(TestDocumentAuthorizationSpecification(
                EntityAuthorizationRequest(TestDocument::class.java, Action(Action.IGNORE)),
                { emptyList() }
            ))

        val spec = TestAuthorizationSpecification(
            RelatedEntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view,
                TestDocument::class.java,
                "doc-id"
            ),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should resolve container condition via context when context type matches`() {
        val contextEntity = TestDocument("context-doc")
        val childSpec: AuthorizationSpecification<TestDocument> = mock()
        whenever(childSpec.isAuthorized()).thenReturn(true)

        whenever(authorizationService.getAuthorizationSpecification<TestDocument>(any(), any()))
            .thenReturn(childSpec)

        val containerCondition = ContainerPermissionCondition(
            resourceType = TestDocument::class.java,
            conditions = listOf()
        )

        val request = RelatedEntityAuthorizationRequest(
            TestEntity::class.java,
            TestEntityActionProvider.view,
            RelatedTestEntity::class.java,
            "related-id"
        ).withContext(AuthorizationResourceContext(TestDocument::class.java, contextEntity))

        val spec = TestAuthorizationSpecification(
            request,
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf(containerCondition)),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should resolve container condition via context mapper`() {
        val contextEntity = TestDocument("context-doc")
        val mappedEntity = RelatedTestEntity("mapped")

        val mapper: AuthorizationEntityMapper<TestDocument, RelatedTestEntity> = mock()
        whenever(mapper.mapRelated(any())).thenReturn(listOf(mappedEntity))

        // No mapper from RelatedTestEntity -> TestEntity (the related resource path)
        whenever(authorizationService.hasMapper(RelatedTestEntity::class.java, TestEntity::class.java))
            .thenReturn(false)
        // No mapper from RelatedTestEntity -> RelatedTestEntity (not needed)
        whenever(authorizationService.hasMapper(RelatedTestEntity::class.java, RelatedTestEntity::class.java))
            .thenReturn(false)
        // Context mapper: TestDocument -> RelatedTestEntity exists
        whenever(authorizationService.hasMapper(TestDocument::class.java, RelatedTestEntity::class.java))
            .thenReturn(true)
        whenever(authorizationService.getMapper<TestDocument, RelatedTestEntity>(any(), any()))
            .thenReturn(mapper)

        val childSpec: AuthorizationSpecification<RelatedTestEntity> = mock()
        whenever(childSpec.isAuthorized()).thenReturn(true)
        whenever(authorizationService.getAuthorizationSpecification<RelatedTestEntity>(any(), any()))
            .thenReturn(childSpec)

        val containerCondition = ContainerPermissionCondition(
            resourceType = RelatedTestEntity::class.java,
            conditions = listOf()
        )

        // relatedResourceType != resourceType, and no mapper from related -> resource,
        // so it falls through to the permission/container condition path
        val request = RelatedEntityAuthorizationRequest(
            TestEntity::class.java,
            TestEntityActionProvider.view,
            RelatedTestEntity::class.java,
            "related-id"
        ).withContext(AuthorizationResourceContext(TestDocument::class.java, contextEntity))

        val spec = TestAuthorizationSpecification(
            request,
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf(containerCondition)),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should return false when context mapper returns entity that fails authorization`() {
        val contextEntity = TestDocument("context-doc")
        val mappedEntity = RelatedTestEntity("mapped")

        val mapper: AuthorizationEntityMapper<TestDocument, RelatedTestEntity> = mock()
        whenever(mapper.mapRelated(any())).thenReturn(listOf(mappedEntity))

        whenever(authorizationService.hasMapper(RelatedTestEntity::class.java, TestEntity::class.java))
            .thenReturn(false)
        whenever(authorizationService.hasMapper(RelatedTestEntity::class.java, RelatedTestEntity::class.java))
            .thenReturn(false)
        whenever(authorizationService.hasMapper(TestDocument::class.java, RelatedTestEntity::class.java))
            .thenReturn(true)
        whenever(authorizationService.getMapper<TestDocument, RelatedTestEntity>(any(), any()))
            .thenReturn(mapper)

        val childSpec: AuthorizationSpecification<RelatedTestEntity> = mock()
        whenever(childSpec.isAuthorized()).thenReturn(false)
        whenever(authorizationService.getAuthorizationSpecification<RelatedTestEntity>(any(), any()))
            .thenReturn(childSpec)

        val containerCondition = ContainerPermissionCondition(
            resourceType = RelatedTestEntity::class.java,
            conditions = listOf()
        )

        val request = RelatedEntityAuthorizationRequest(
            TestEntity::class.java,
            TestEntityActionProvider.view,
            RelatedTestEntity::class.java,
            "related-id"
        ).withContext(AuthorizationResourceContext(TestDocument::class.java, contextEntity))

        val spec = TestAuthorizationSpecification(
            request,
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf(containerCondition)),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        assertEquals(false, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should prefer related resource path over context path`() {
        val contextEntity = TestDocument("context-doc")

        whenever(authorizationService.hasMapper(RelatedTestEntity::class.java, RelatedTestEntity::class.java))
            .thenReturn(false)

        val childSpec: AuthorizationSpecification<RelatedTestEntity> = mock()
        whenever(childSpec.isAuthorized()).thenReturn(true)
        whenever(authorizationService.getAuthorizationSpecification<RelatedTestEntity>(any(), any()))
            .thenReturn(childSpec)

        val containerCondition = ContainerPermissionCondition(
            resourceType = RelatedTestEntity::class.java,
            conditions = listOf()
        )

        val request = RelatedEntityAuthorizationRequest(
            TestEntity::class.java,
            TestEntityActionProvider.view,
            RelatedTestEntity::class.java,
            "related-id"
        ).withContext(AuthorizationResourceContext(TestDocument::class.java, contextEntity))

        val spec = TestAuthorizationSpecification(
            request,
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf(containerCondition)),
                        role = Role(key = "")
                    )
                )
            },
            mock()
        )

        // Should match via the related resource path (direct type match), not the context path
        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should propagate context to entity request from related`() {
        val contextEntity = TestDocument("context-doc")

        val spec = TestAuthorizationSpecification(
            RelatedEntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view,
                TestEntity::class.java,
                "some-id"
            ).withContext(AuthorizationResourceContext(TestDocument::class.java, contextEntity)),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = ""),
                        contextResourceType = TestDocument::class.java,
                        contextConditionContainer = ConditionContainer(
                            listOf(
                                FieldPermissionCondition(
                                    "name",
                                    PermissionConditionOperator.EQUAL_TO,
                                    "context-doc"
                                )
                            )
                        )
                    )
                )
            },
            mock()
        )

        assertEquals(true, spec.isAuthorized())
    }

    @Test
    fun `isAuthorized should fail when context condition does not match`() {
        val contextEntity = TestDocument("wrong-name")

        val spec = TestAuthorizationSpecification(
            RelatedEntityAuthorizationRequest(
                TestEntity::class.java,
                TestEntityActionProvider.view,
                TestEntity::class.java,
                "some-id"
            ).withContext(AuthorizationResourceContext(TestDocument::class.java, contextEntity)),
            {
                listOf(
                    Permission(
                        resourceType = TestEntity::class.java,
                        actions = mutableListOf(TestEntityActionProvider.view),
                        conditionContainer = ConditionContainer(listOf()),
                        role = Role(key = ""),
                        contextResourceType = TestDocument::class.java,
                        contextConditionContainer = ConditionContainer(
                            listOf(
                                FieldPermissionCondition(
                                    "name",
                                    PermissionConditionOperator.EQUAL_TO,
                                    "expected-name"
                                )
                            )
                        )
                    )
                )
            },
            mock()
        )

        assertEquals(false, spec.isAuthorized())
    }
}
