# 🖱️ Getting started

This section contains information on how to create a new Valtimo implementation. Instructions are available for two types of user groups that want to get started with Valtimo:

* Business Process Engineers
* Software Developers

The Valtimo platform consists of multiple services/containers. Depending on the edition (Valtimo or GZAC), a specific set of containers can be used for supporting a quick start-up. For both editions, a Docker Compose repository is available. These repositories include a guide on which Compose file(s) to use and how to use them.

## Business Process Engineers

Available documentation for users that want to use Valtimo as an "Off the Shelf" application and do not want to be bothered with technical documentation on the setup and configuration of the environment.

In order to enable these users, instruction video's are recorded and made available in the online [Valtimo Academy](https://academy.valtimo.nl) on how to make use of GIT and Docker Desktop to start up Valtimo on your own device (laptop or PC). The UI versions of the training material both have a first chapter that explains how to setup Valtimo on your own device in about 15 minutes.

* [Introduction training for Business Process Engineers](https://academy.valtimo.nl/courses/introductietraining-voor-business-process-engineers-ui-versie-v12)\*
* [Create a Case definition](https://academy.valtimo.nl/courses/maken-van-dossier-definitie-ui)\*

_\* This training material is recorded in Dutch._

### Running GZAC locally with demo process

GZAC (Generieke Zaakafhandelcomponent) is the Dutch municipal variant of Valtimo. The demo process in this guide concerns an application for an event permit and is in Dutch. This guide helps you install and run GZAC locally on macOS or Windows.

{% hint style="info" %}
**What you'll need**

* A computer with macOS 11+ or Windows 10+
* An internet connection
* At least 3 GB of free disk space
* Software requirements:
  * macOS: Homebrew, Git, Docker Desktop
  * Windows: Git, Docker Desktop
{% endhint %}

{% stepper %}
{% step %}
### Install Homebrew, Git and Docker Desktop

{% tabs %}
{% tab title="MacOS" %}
#### **Step 1: Install Homebrew**

* Open Spotlight with Cmd + Space, then open Terminal.
* Go to https://brew.sh and copy the installation command.
* Paste it into the Terminal and press Enter.
* Follow the on-screen instructions.

👉 Already have Homebrew? You can skip this step.

#### **Step 2: Install Git**

* Run the following command in Terminal:

```
brew install git
```

#### **Step 3: Install Docker Desktop**

* Go to [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
* Download the macOS version (Intel or Apple Silicon).
* Open the .dmg file and drag Docker into Applications.
* Launch Docker via Launchpad or Spotlight.
* Wait until the whale icon appears in the menu bar.
{% endtab %}

{% tab title="Windows" %}
#### Step 1: Install Git&#x20;

* Go to [https://git-scm.com/ ](https://git-scm.com/)
* Download and install Git for Windows.&#x20;
* Launch Git Bash from the Start menu after installation.&#x20;

#### Step 2: Install Docker Desktop&#x20;

* Visit [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)&#x20;
* Download and install the Windows version.&#x20;
* Restart your computer if prompted.&#x20;
* Open Docker Desktop and wait for the whale icon to appear in the system tray.&#x20;
{% endtab %}
{% endtabs %}
{% endstep %}

{% step %}
### Start GZAC

* Open Terminal (macOS) or Git Bash / Windows Terminal (Windows).
* Clone the GZAC repository:

{% code overflow="wrap" %}
```
git clone https://github.com/generiekzaakafhandelcomponent/gzac-docker-compose.git
```
{% endcode %}

* Navigate into the directory:

```
cd gzac-docker-compose
```

* Start GZAC:

```
docker compose --profile zgw --profile demo up -d
```

⏳ The first startup can take 5–10 minutes.
{% endstep %}

{% step %}
### Open GZAC in your browser

* Open your browser.
* Visit [http://localhost](http://localhost/)
* Log in with the following credentials:
  * Username: admin
  * Password: admin

🎉 You’re now inside the GZAC environment and can explore the demo process.
{% endstep %}

{% step %}
### Shut down GZAC

* To stop GZAC, return to your terminal and run:

```
docker compose down
```
{% endstep %}
{% endstepper %}

### For experienced users

For users that are already familiar with GIT and Docker Desktop, instructions are available in the README files of below mentioned repositories. Depending on the Valtimo edition, a Github repository should be checked out that contains the Docker Compose file.

{% tabs %}
{% tab title="Valtimo" %}
For starting the Valtimo platform, the following repository should be checked out:

* [valtimo-docker-compose](https://github.com/valtimo-platform/valtimo-docker-compose)
{% endtab %}

{% tab title="GZAC" %}
For starting the GZAC platform, the following repository should be checked out:

* [gzac-docker-compose](https://github.com/generiekzaakafhandelcomponent/gzac-docker-compose)
{% endtab %}
{% endtabs %}

When starting the Valtimo platform as Docker containers, all supporting services and the two Valtimo services are started up with above Docker Compose files. The containers are designed for evaluation purposes only.

## Software developers

Documentation for tech-savvy engineers and developers on which modules are available and what settings at minimum are required to use them. Some knowledge on java build tools such as [Maven](https://maven.apache.org/) or [Gradle](https://gradle.org/) is assumed for these users.

### Starting your own Valtimo implementation

When starting your own Valtimo implementation, the supporting services are started up with a Docker Compose file. The two Valtimo services are started up from their respective Git repositories using a command line interface (CLI) or integrated development environment (IDE).

### Supporting services

Both editions of Valtimo require a Keycloak instance for Identity and Access Management. The Valtimo backend application requires a database container. Both PostgreSQL and MySQL are supported.

### Application services <a href="#application-services" id="application-services"></a>

Valtimo consists of a frontend (Angular) and a backend (Java/Kotlin) application. Both services have their own Github repository with instructions on how the service can be started.

### **Repositories** <a href="#repositories" id="repositories"></a>

Depending on the Valtimo edition, three Github repositories should be checked out:

* Supporting Services
* Backend application
* Frontend application

{% tabs %}
{% tab title="Valtimo" %}
For starting a Valtimo implementation, the following Github repositories should be checked out:

* [valtimo-docker-compose](https://github.com/valtimo-platform/valtimo-docker-compose)
* [valtimo-backend-template](https://github.com/valtimo-platform/valtimo-backend-template)
* [valtimo-frontend-template](https://github.com/valtimo-platform/valtimo-frontend-template)

Instructions are available in the README files of above mentioned repositories.
{% endtab %}

{% tab title="GZAC" %}
For starting a GZAC implementation, the following Github repositories should be checked out:

* [gzac-docker-compose](https://github.com/generiekzaakafhandelcomponent/gzac-docker-compose)
* [gzac-backend-template](https://github.com/generiekzaakafhandelcomponent/gzac-backend-template)
* [gzac-frontend-template](https://github.com/generiekzaakafhandelcomponent/gzac-frontend-template)

Instructions are available in the README files of above mentioned repositories.
{% endtab %}
{% endtabs %}

\
Below pages contain additional information for engineers and developers for making choices in database type, available modules and an overview of tested versions in a compatibility matrix.

* [Configuring the database](configure-database.md)
* [Modules](modules/)
* [Compatibility matrix](compatibility-matrix.md)
