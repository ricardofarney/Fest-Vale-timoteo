package br.com.festvaletimoteo.pdv

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.os.Bundle
import android.widget.Button
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPag
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagActivationData
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagPaymentData
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPagPrinterData
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import kotlin.concurrent.thread

/**
 * Prova de corrente do terminal SmartPOS.
 *
 * Não é o PDV. O objetivo aqui é um só: descobrir se o elo inteiro funciona —
 * ambiente, SDK, ADB, pinpad e impressora — antes de investir semanas
 * construindo a venda de bar de verdade.
 *
 * São três botões, na ordem em que devem ser apertados:
 *   1. Ativar o terminal     (código de teste 749879)
 *   2. Cobrar R$ 1,00        (transação SIMULADA, não movimenta dinheiro)
 *   3. Imprimir um comprovante
 *
 * Tudo que acontece é escrito na tela, inclusive os erros, para não ser
 * preciso ligar o computador para saber o que deu errado.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var plugPag: PlugPag
    private lateinit var saida: TextView
    private lateinit var rolagem: ScrollView

    /** Código de ativação do ambiente de testes, publicado na documentação. */
    private val codigoAtivacaoTeste = "749879"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        saida = findViewById(R.id.saida)
        rolagem = findViewById(R.id.rolagem)

        // O segundo parâmetro do PlugPag é um ouvinte de métricas, não a
        // identificação do app — e PlugPagAppIdentification, nesta versão da
        // biblioteca, recebe um Context, não nome e versão. Como nada aqui
        // precisa de métricas, o construtor de um argumento basta.
        plugPag = PlugPag(this)

        escrever("Pronto. Comece pelo botão 1.")
        escrever("As transações aqui são simuladas: nada é cobrado de verdade.")

        findViewById<Button>(R.id.btAtivar).setOnClickListener { ativar() }
        findViewById<Button>(R.id.btCobrar).setOnClickListener { cobrar() }
        findViewById<Button>(R.id.btImprimir).setOnClickListener { imprimir() }
    }

    /* ----------------------------------------------------------- 1. ativar */

    private fun ativar() {
        escrever("\n— Ativando o terminal com o código $codigoAtivacaoTeste...")
        // As chamadas do SDK bloqueiam: fora da thread principal, senão a tela trava.
        emSegundoPlano("ativar") {
            val r = plugPag.initializeAndActivatePinpad(
                PlugPagActivationData(codigoAtivacaoTeste),
            )
            if (r.result == PlugPag.RET_OK) {
                escrever("Terminal ativado.")
            } else {
                escrever("Não ativou. Código devolvido: ${r.result}")
                escrever("Confira em Informações de sistema > Suporte se o " +
                    "apontamento está no Ambiente Base.")
            }
        }
    }

    /* ----------------------------------------------------------- 2. cobrar */

    private fun cobrar() {
        escrever("\n— Cobrando R$ 1,00 (simulado). Siga as instruções na tela do terminal...")
        emSegundoPlano("cobrar") {
            val dados = PlugPagPaymentData(
                PlugPag.TYPE_CREDITO,
                100,                               // sempre em centavos: 100 = R$ 1,00
                PlugPag.INSTALLMENT_TYPE_A_VISTA,
                1,
                "PROVA-FESTVALE",
            )
            val r = plugPag.doPayment(dados)
            if (r.result == PlugPag.RET_OK) {
                escrever("Pagamento aprovado.")
                escrever("Mensagem: ${r.message}")
                escrever("Código da transação: ${r.transactionCode}")
                escrever("NSU: ${r.transactionId}")
            } else {
                escrever("Pagamento não aprovado. Código: ${r.result}")
                escrever("Mensagem: ${r.message}")
            }
        }
    }

    /* --------------------------------------------------------- 3. imprimir */

    private fun imprimir() {
        escrever("\n— Imprimindo um comprovante de teste...")
        emSegundoPlano("imprimir") {
            // O SDK imprime a partir de um arquivo de imagem, então desenhamos
            // o texto numa imagem antes.
            val arquivo = desenharComprovante()
            val r = plugPag.printFromFile(
                PlugPagPrinterData(arquivo.absolutePath, 4, 10 * 12),
            )
            if (r.result == PlugPag.RET_OK) {
                escrever("Impressão enviada.")
            } else {
                escrever("Não imprimiu. Código: ${r.result} — ${r.message}")
            }
        }
    }

    /** Desenha um comprovante simples numa imagem e devolve o arquivo salvo. */
    private fun desenharComprovante(): File {
        val largura = 384          // largura típica da bobina de 58 mm
        val altura = 240
        val bitmap = Bitmap.createBitmap(largura, altura, Bitmap.Config.ARGB_8888)
        val tela = Canvas(bitmap)
        tela.drawColor(Color.WHITE)

        val tinta = Paint().apply {
            color = Color.BLACK
            isAntiAlias = true
        }

        var y = 40f
        fun linha(texto: String, tamanho: Float, negrito: Boolean = false) {
            tinta.textSize = tamanho
            tinta.isFakeBoldText = negrito
            tela.drawText(texto, 16f, y, tinta)
            y += tamanho + 10f
        }

        val agora = SimpleDateFormat("dd/MM/yyyy HH:mm", Locale("pt", "BR")).format(Date())

        linha("FEST VALE TIMOTEO", 26f, negrito = true)
        linha("Teste de impressao", 20f)
        linha(agora, 18f)
        linha("", 10f)
        linha("Se voce esta lendo isto", 18f)
        linha("em papel, a impressora", 18f)
        linha("esta funcionando.", 18f)

        val arquivo = File(getExternalFilesDir(null), "comprovante-teste.png")
        FileOutputStream(arquivo).use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        return arquivo
    }

    /* ---------------------------------------------------------- utilidades */

    /**
     * Roda fora da thread principal e nunca deixa uma exceção derrubar o app:
     * num terminal, um erro escrito na tela vale muito mais que um fechamento
     * silencioso.
     */
    private fun emSegundoPlano(nome: String, bloco: () -> Unit) {
        thread {
            try {
                bloco()
            } catch (e: Throwable) {
                escrever("Erro em \"$nome\": ${e.javaClass.simpleName} — ${e.message}")
            }
        }
    }

    private fun escrever(texto: String) {
        runOnUiThread {
            saida.append("$texto\n")
            rolagem.post { rolagem.fullScroll(ScrollView.FOCUS_DOWN) }
        }
    }
}
