package br.com.festvaletimoteo.pdv

import android.content.Context
import android.graphics.Bitmap
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPag
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagActivationData
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagEventData
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagEventListener
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagPaymentData
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagPrinterData
import java.io.File
import java.io.FileOutputStream

/** Resultado de uma cobrança no cartão ou no Pix. */
sealed class Cobranca {
    data class Aprovada(val codigo: String, val bandeira: String) : Cobranca()
    data class Recusada(val motivo: String) : Cobranca()
}

/**
 * Tudo que fala com o hardware do PagBank: pinpad, cobrança e impressora.
 *
 * Todas as chamadas daqui BLOQUEIAM — a cobrança espera o cliente passar o
 * cartão. Só chamar fora da thread da tela.
 *
 * Lembretes da biblioteca (1.35.0), aprendidos no terminal:
 *  - a biblioteca é Kotlin: getSerialNumber(), getModel() e isAuthenticated()
 *    são funções, com parênteses;
 *  - o userReference é cortado em 10 caracteres no comprovante.
 */
class Terminal(contexto: Context) {
    private val plugPag = PlugPag(contexto)
    private val pasta: File = contexto.cacheDir

    /** Quem quer saber o que o leitor está pedindo ("INSIRA O CARTÃO", "SENHA"...). */
    @Volatile var aoMudarMensagem: ((String) -> Unit)? = null

    init {
        try {
            plugPag.setEventListener(object : PlugPagEventListener {
                override fun onEvent(data: PlugPagEventData) {
                    val msg = data.customMessage?.trim()
                    if (!msg.isNullOrEmpty()) aoMudarMensagem?.invoke(msg)
                }
            })
        } catch (e: Throwable) {
            // sem mensagens do leitor; a cobrança funciona do mesmo jeito
        }
    }

    /** Desiste da cobrança em andamento. Chamar de OUTRA thread, nunca da que está em cobrar(). */
    fun cancelar(): Boolean = try {
        plugPag.abort()
        true
    } catch (e: Throwable) {
        false
    }

    fun serial(): String = try { plugPag.getSerialNumber() ?: "" } catch (e: Throwable) { "" }
    fun modelo(): String = try { plugPag.getModel() ?: "" } catch (e: Throwable) { "" }

    /** Devolve null se o pinpad está pronto, ou o motivo de não estar. */
    fun garantirAtivacao(codigo: String): String? {
        try {
            if (plugPag.isAuthenticated()) return null
        } catch (e: Throwable) {
            // segue para tentar ativar
        }
        return try {
            val r = plugPag.initializeAndActivatePinpad(PlugPagActivationData(codigo))
            if (r.result == PlugPag.RET_OK) null
            else "O pinpad não ativou (código ${r.result}). ${r.errorMessage ?: ""}".trim()
        } catch (e: Throwable) {
            "O pinpad não ativou: ${e.message ?: e.javaClass.simpleName}"
        }
    }

    /**
     * Cobra no cartão ou no Pix. A tela do PagBank assume enquanto o cliente
     * paga; esta chamada só volta depois.
     *
     * printReceipt = false: com fila no bar, o operador não pode ter que
     * responder "imprimir via do cliente?" a cada venda.
     */
    fun cobrar(tipo: Int, centavos: Int, referencia: String): Cobranca {
        return try {
            val dados = PlugPagPaymentData(
                tipo,
                centavos,
                PlugPag.INSTALLMENT_TYPE_A_VISTA,
                1,
                referencia.take(10),
                false,
            )
            val r = plugPag.doPayment(dados)
            if (r.result == PlugPag.RET_OK) {
                Cobranca.Aprovada(r.transactionCode ?: "", r.cardBrand ?: "")
            } else {
                val msg = (r.message ?: "Pagamento não aprovado").trim()
                val cod = listOfNotNull(r.result?.toString(), r.errorCode).joinToString(" / ")
                Cobranca.Recusada(if (cod.isBlank()) msg else "$msg (código $cod)")
            }
        } catch (e: Throwable) {
            Cobranca.Recusada("Falha na cobrança: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    /** Imprime uma imagem já desenhada. Devolve null se saiu, ou o motivo. */
    fun imprimir(imagem: Bitmap): String? {
        return try {
            val arquivo = File(pasta, "impressao-${System.currentTimeMillis()}.png")
            FileOutputStream(arquivo).use { imagem.compress(Bitmap.CompressFormat.PNG, 100, it) }
            val r = plugPag.printFromFile(PlugPagPrinterData(arquivo.absolutePath, 4, 10 * 12))
            arquivo.delete()
            if (r.result == PlugPag.RET_OK) null
            else "A impressora não imprimiu (${r.result}). ${r.message ?: ""}".trim()
        } catch (e: Throwable) {
            "A impressora não imprimiu: ${e.message ?: e.javaClass.simpleName}"
        }
    }
}
