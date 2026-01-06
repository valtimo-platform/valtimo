# Widget display types

The display types listed below are the ones that are included in Valtimo.

Each display type used must be imported in the `AppModule` of your front-end implementation if you want to use them. They are exported from `'@valtimo/dashboard'`.

## Number

Key: `number`

Front-end module: `BigNumberModule`

Displays the data as a single number in text.

<div align="center" data-full-width="false"><img src="../../.gitbook/assets/display-type-number-example.png" alt="Example of display type &#x27;number&#x27;"></div>

### Properties

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>title</code></td><td valign="top">The title of the widget, shown at the top of the widget.</td></tr><tr><td valign="top"><code>subtitle</code></td><td valign="top">The text shown below the title.</td></tr><tr><td valign="top"><code>label</code></td><td valign="top">The label that is displayed to the right of the number. Can be used to clarify what the number indicates.</td></tr><tr><td valign="top"><code>useKPI</code></td><td valign="top">Enables the use of thresholds to change the color of the number. When set to <code>false</code> the color of the number is black. When set to <code>true</code> the color of the number is green unless it is above one or more of the threshold values.</td></tr><tr><td valign="top"><code>lowSeverityThreshold</code></td><td valign="top">Limit above which the color of the number becomes yellow.</td></tr><tr><td valign="top"><code>mediumSeverityThreshold</code></td><td valign="top">Limit above which the color of the number becomes orange.</td></tr><tr><td valign="top"><code>highSeverityThreshold</code></td><td valign="top">Limit above which the color of the number becomes red.</td></tr></tbody></table>

## Donut chart

Key: `donut`

Front-end module: `DonutModule`

Displays multiple counts in a donut chart.

<div align="center"><figure><img src="https://v1.docs.valtimo.nl/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-842a6fe7e0482e282105063e93a0e8d732c4c888%252Fdisplay-type-donut-example.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=a06a18a1&#x26;sv=2" alt=""><figcaption><p>Example of display type 'donut chart'</p></figcaption></figure></div>

### **Properties**

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>title</code></td><td valign="top">Required. The title of the widget, shown at the top of the widget.</td></tr><tr><td valign="top"><code>subtitle</code></td><td valign="top">The text shown below the title.</td></tr><tr><td valign="top"><code>label</code></td><td valign="top">The label that is displayed in the center of the donut.</td></tr></tbody></table>

## Meter chart <a href="#meter-chart" id="meter-chart"></a>

Key: `meter`

Front-end module: `MeterModule`

Displays multiple counts in a horizontal meter chart.

<figure><img src="https://v1.docs.valtimo.nl/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-78ca3165ec8c07c7b4f5ea56b3d1e9cfd9d33de0%252Fdisplay-type-meter-example.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=ce14f3d6&#x26;sv=2" alt=""><figcaption><p>Example of display type 'meter chart'</p></figcaption></figure>

### **Properties**

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>title</code></td><td valign="top">Required. The title of the widget, shown at the top of the widget.</td></tr><tr><td valign="top"><code>subtitle</code></td><td valign="top">The text shown below the title.</td></tr></tbody></table>

## Gauge <a href="#gauge" id="gauge"></a>

Key: `gauge`

Front-end module: `GaugeModule`

Displays a count and a total count in a gauge.

<figure><img src="https://v1.docs.valtimo.nl/~gitbook/image?url=https%3A%2F%2F181910120-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252FG21VIGcgPc1cyGRZY5CR%252Fuploads%252Fgit-blob-698884b17edc61963ee87c834bf9de262f271c25%252Fdisplay-type-gauge-example.png%3Falt%3Dmedia&#x26;width=768&#x26;dpr=4&#x26;quality=100&#x26;sign=5d896d6e&#x26;sv=2" alt=""><figcaption><p>Example of display type 'gauge'</p></figcaption></figure>

### **Properties**

<table><thead><tr><th valign="top">Name</th><th valign="top">Description</th></tr></thead><tbody><tr><td valign="top"><code>title</code></td><td valign="top">Required. The title of the widget, shown at the top of the widget.</td></tr><tr><td valign="top"><code>subtitle</code></td><td valign="top">The text shown below the title.</td></tr><tr><td valign="top"><code>label</code></td><td valign="top">The label specifies the type of item under the gauge. In the screenshot this is 'zaken'.</td></tr></tbody></table>
