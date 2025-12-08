# Whitelisting Spring beans for Operaton

It is possible to use custom code in your BPMN processes by referencing a [Spring bean](https://docs.spring.io/spring-framework/docs/current/reference/html/core.html) that contains the code you want to run. Any spring bean can be used in expressions by using the bean name.

## ProcessBean annotation

Camunda by default allows access to Spring beans, e.g. to send an email. Valtimo provides a whitelist for this instead, as exposing every bean is a security concern. In order to add a Spring bean to this whitelist, the bean definition itself has to be whitelisted. This is done with the `@ProcessBean` annotation.

1.  Ensure a bean for the class that should be whitelisted is provided.

    ```kotlin
    @Bean
    fun somethingService(): SomethingService {
       return SomethingService()
    }
    ```
2.  Add the `@ProcessBean` annotation.

    ```kotlin
    @Bean
    @ProcessBean
    fun somethingService(): SomethingService {
       return SomethingService()
    }
    ```

The bean can now be used. For information on how to use these beans inside a BPMN, see [here](integrate-spring-bean-in-process.md).

Note: the whitelist can be disabled by setting the following Spring property to `false`.

#### **`application.yml`**

```yaml
valtimo:
  camunda:
    bean-whitelisting: false
```
