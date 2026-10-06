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

        // Chave de PRODUÇÃO. Nunca entra no repositório (ele é público): o
        // GitHub monta o arquivo a partir dos "segredos" cadastrados pelo
        // Ricardo, só na hora de gerar a versão de produção. Original e
        // senha: pasta "PDV - chave de assinatura (NAO APAGAR)" no OneDrive.
        val chaveRelease = System.getenv("PDV_KEYSTORE_FILE")
        if (chaveRelease != null) {
            create("release") {
                storeFile = file(chaveRelease)
                storePassword = System.getenv("PDV_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("PDV_KEY_ALIAS")
                keyPassword = System.getenv("PDV_KEY_PASSWORD")
                // O guia do PagBank exige assinatura V1 e V2.
                enableV1Signing = true
                enableV2Signing = true
            }
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

        // Cada versão de produção precisa de um número maior que a anterior.
        // O GitHub passa o número da execução; nos testes fica 1.
        versionCode = (System.getenv("PDV_VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("PDV_VERSION_NAME") ?: "0.9-teste"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // O PagBank exige targetSdk 23, que o lint do Google considera "vencido"
    // (regra da Play Store, que não se aplica à loja interna do PagBank).
    // Sem isto, a versão de produção pararia nessa checagem.
    lint {
        checkReleaseBuilds = false
        abortOnError = false
    }
}

dependencies {
    // SDK do PagBank para o terminal
    implementation("br.com.uol.pagseguro.plugpagservice.wrapper:wrapper:1.35.0")

    implementation("androidx.core:core-ktx:1.10.1")
    implementation("androidx.appcompat:appcompat:1.6.1")

    // QR code da ficha de retirada e do relatório de fechamento
    implementation("com.google.zxing:core:3.5.3")
}
