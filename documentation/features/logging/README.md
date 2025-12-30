---
icon: file-chart-column
---

# Logging

{% hint style="success" %}
Available since Valtimo 12.5.0.
{% endhint %}

## Introduction

For every action in, or request to the Valtimo backend, a lot of information is logged. This information can be used for debugging or troubleshooting purposes in a production process, or might be relevant for an administrator that is working on a new case configuration.

## Feature overview

The logs overview is available through the `Admin -> Logs` menu. This list contains all stored loglines, with the most recent lines on top. Per logline, the timestamp, log level and first part of the message are shown.

<figure><img src="../../.gitbook/assets/image (49).png" alt=""><figcaption></figcaption></figure>

## Viewing log details

When clicking on one of the loglines, the details are shown. This includes the full message, additional properties, and a stacktrace when applicable.

<figure><img src="../../.gitbook/assets/image (50).png" alt=""><figcaption></figcaption></figure>

## Filtering logs

The list supports filtering the loglines, based on message, log level, timestamp and additional properties.&#x20;

<figure><img src="../../.gitbook/assets/image (51).png" alt=""><figcaption></figcaption></figure>

Log entries are cleared after a certain period to prevent the database from filling up. By default, this period is set to 21 days.

