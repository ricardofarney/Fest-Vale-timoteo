# PDV do Fest Vale — aplicativo do terminal SmartPOS

Este é o aplicativo que roda **dentro da maquininha** do PagBank, em Kotlin.
O PagBank não aceita WebView: exige Android nativo. Por isso ele existe
separado do site.

## O que esta versão faz

Nada de PDV ainda. Esta é uma **prova de corrente**: três botões que
verificam, na ordem, se o elo inteiro funciona antes de construir a venda de
bar de verdade.

1. **Ativar o terminal** — com o código de teste `749879`
2. **Cobrar R$ 1,00** — transação simulada, não movimenta dinheiro
3. **Imprimir um comprovante**

Tudo que acontece aparece na tela do terminal, incluindo os erros.

## Como gerar o APK

Não precisa instalar nada no computador. A cada alteração publicada aqui, o
GitHub compila sozinho.

1. Abra a aba **Actions** do repositório
2. Clique na execução mais recente de *PDV Android (APK de teste)*
3. Em **Artifacts**, baixe **pdv-apk**
4. Descompacte — dentro está o arquivo `.apk`

## Como instalar no terminal

Só é preciso o **ADB** (platform-tools do Android, uns 10 MB), não o Android
Studio inteiro.

```
adb devices          # confere se o terminal aparece
adb install -r app-debug.apk
```

Se `adb devices` não listar nada, é preciso habilitar a depuração USB no
terminal.

⛔ **Nunca restaure o terminal DEBUG para o padrão de fábrica.** O FAQ do
PagBank diz que, se isso acontecer, ele precisa voltar para ajuste técnico.

## Decisões que não dá para desfazer depois

O FAQ do PagBank é explícito: mudar o **`packageName`** ou a **chave de
assinatura** de um app já homologado **exige nova homologação**, que leva 7
dias úteis.

- `packageName` atual: `br.com.festvaletimoteo.pdv` — confirmar antes de
  submeter
- A chave de assinatura (keystore) ainda não foi criada. Quando for, guardar
  cópia em pelo menos dois lugares.

## Versões e limites

- `minSdk` e `targetSdk` **23**, como pede o guia de boas práticas da
  homologação. O 23 também cobre o modelo mais antigo da lista (SK800).
- SDK do PagBank: `br.com.uol.pagseguro.plugpagservice.wrapper:wrapper:1.35.0`
- Valores sempre em **centavos**: `100` = R$ 1,00

## Depois que a prova passar

Aí sim entra o PDV: catálogo, estoque, cortesia com valor zero, fechamento de
caixa e ticket com QR. As regras de negócio já vivem no banco (Postgres), não
neste aplicativo — ele será mais um cliente do mesmo sistema, falando por
HTTPS.
