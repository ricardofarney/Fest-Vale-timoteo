plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    // ATENÇÃO: o packageName NÃO pode mudar depois da homologação do PagBank.
    // O FAQ deles é explícito: "O packageName é um identificador único.
    // Alterá-lo exige nova homologação." Mudar agora é de graça; depois custa
    // 7 dias úteis. Confirmar este nome antes de submeter.
    namespace = "br.com.festvaletimoteo.pdv"
    compileSdk = 34

    // Chave FIXA para as versões de teste.
    //
    // Sem isto, cada compilação no GitHub gera uma chave nova ao acaso, o
    // Android vê duas assinaturas diferentes e recusa a instalação por cima
    // com INSTALL_FAILED_UPDATE_INCOMPATIBLE — obrigando a desinstalar o
    // aplicativo a cada versão. Com a chave guardada no repositório, o
    // `adb install -r` passa a funcionar sempre.
    //
    // Esta chave é só de teste e não protege nada: a senha "android" é a
    // mesma que o Android usa por padrão no mundo inteiro. A chave de
    // RELEASE, que vai para a homologação, é outra história — essa não pode
    // ser guardada aqui, e perdê-la custa 7 dias úteis de nova homologação.
    signingConfigs {
        getByName("debug") {
            storeFile = file("../chaves/debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    defaultConfig {
        applicationId = "br.com.festvaletimoteo.pdv"

        // O guia de boas práticas da homologação do PagBank pede
        // minSdkVersion(23) e targetSdkVersion(23). O 23 também cobre o
        // modelo mais antigo da lista (SK800, Android 6), então é a escolha
        // que serve a todos os terminais.
        minSdk = 23
        targetSdk = 23

        versionCode = 1
        versionName = "0.1-prova"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // SDK do PagBank para o terminal
    implementation("br.com.uol.pagseguro.plugpagservice.wrapper:wrapper:1.35.0")

    implementation("androidx.core:core-ktx:1.10.1")
    implementation("androidx.appcompat:appcompat:1.6.1")
}
