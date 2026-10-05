pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Repositório público do SDK do PagBank. Não precisa de credencial.
        maven { url = uri("https://github.com/pagseguro/PlugPagServiceWrapper/raw/master") }
    }
}

rootProject.name = "FestValePdv"
include(":app")
