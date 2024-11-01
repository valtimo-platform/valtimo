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

package com.ritense.extension.listener

import com.ritense.extension.ExtensionManager
import com.ritense.valtimo.contract.annotation.SkipComponentScan
import com.ritense.valtimo.contract.extension.ExtensionClassRegistrationListener
import org.springframework.beans.factory.annotation.AnnotatedGenericBeanDefinition
import org.springframework.beans.factory.support.AbstractAutowireCapableBeanFactory
import org.springframework.beans.factory.support.BeanDefinitionRegistry
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.AnnotationBeanNameGenerator
import org.springframework.context.annotation.Configuration
import org.springframework.context.support.AbstractApplicationContext
import org.springframework.stereotype.Component
import org.springframework.stereotype.Controller
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.RestController

@SkipComponentScan
@Component
class BeanExtensionClassRegistrationListener(
    private val extensionManager: ExtensionManager,
    private val beanFactory: AbstractAutowireCapableBeanFactory
) : ExtensionClassRegistrationListener {

    override fun classRegistered(extensionClass: Class<*>) {
        if (isBean(extensionClass)) {
            registerSpringBean(extensionClass)
        }
    }

    override fun classUnregistered(extensionClass: Class<*>) {
        if (isBean(extensionClass)) {
            unregisterSpringBean(extensionClass)
        }
    }

    private fun registerSpringBean(extensionClass: Class<*>) {
        val beanName = getBeanName(extensionClass)
        require(!beanFactory.containsSingleton(beanName)) {
            "Spring bean already exists: '$beanName' for '$extensionClass'"
        }
        val extension = extensionManager.extensionFactory.create(extensionClass)
        beanFactory.registerSingleton(beanName, extension)
    }

    private fun unregisterSpringBean(extensionClass: Class<*>) {
        val exceptions = mutableListOf<Exception>()
        val beanNames = extensionManager.applicationContext.getBeansOfType(extensionClass).keys.toMutableSet()
        beanNames.add(getBeanName(extensionClass))
        beanNames.forEach { beanName ->
            try {
                beanFactory.destroySingleton(beanName)
            } catch (e: Exception) {
                exceptions.add(
                    RuntimeException("Failed to destroy Spring bean '$beanName' for $extensionClass", e)
                )
            }
        }
        exceptions.forEach { throw it }
    }

    private fun isBean(clazz: Class<*>): Boolean {
        return clazz.annotations.any { SPRING_ANNOTATION_CLASSES.contains(it.annotationClass) }
    }

    private fun getBeanName(extensionClass: Class<*>): String {
        val abd = AnnotatedGenericBeanDefinition(extensionClass)
        val registry = getBeanDefinitionRegistry(extensionManager.applicationContext)
        return AnnotationBeanNameGenerator.INSTANCE.generateBeanName(abd, registry)
    }

    private fun getBeanDefinitionRegistry(applicationContext: ApplicationContext): BeanDefinitionRegistry {
        if (applicationContext is BeanDefinitionRegistry) {
            return applicationContext
        }
        if (applicationContext is AbstractApplicationContext) {
            return applicationContext.beanFactory as BeanDefinitionRegistry
        }
        throw IllegalStateException("Could not locate BeanDefinitionRegistry")
    }

    companion object {
        val SPRING_ANNOTATION_CLASSES = listOf(
            Component::class,
            Configuration::class,
            Controller::class,
            Repository::class,
            RestController::class,
            Service::class,
        )
    }
}