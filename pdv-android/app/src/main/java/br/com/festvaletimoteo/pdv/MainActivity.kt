package br.com.festvaletimoteo.pdv

import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.InputFilter
import android.text.TextWatcher
import android.text.method.PasswordTransformationMethod
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import br.com.uol.pagseguro.plugpagservice.wrapper.PlugPag
import org.json.JSONArray
import org.json.JSONObject
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.Executors

/**
 * PDV do Fest Vale.
 *
 * O aplicativo sabe o mínimo: desenha o que o banco manda, cobra pelo PagBank,
 * imprime e registra. Preço, produto, estoque, operador e permissão moram no
 * banco — por isso quase toda mudança chega aqui sem APK novo.
 *
 * Fluxo: parear → quem está no caixa (PIN) → abertura com fundo de troco →
 * vender → (sangria) → fechar e imprimir o relatório do envelope.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var raiz: FrameLayout
    private lateinit var local: Local
    private var terminal: Terminal? = null

    private val principal = Handler(Looper.getMainLooper())
    private val rede = Executors.newCachedThreadPool()
    private val hardware = Executors.newSingleThreadExecutor()
    private val sorteio = SecureRandom()

    // estado da sessão
    private var produtos = JSONArray()
    private var operadores = JSONArray()
    /** Lote ativo de cada tipo de ingresso, para a venda na portaria. */
    private var ingressos = JSONArray()
    private var operadorId: String? = null
    private var operadorNome = ""
    private var caixa: JSONObject? = null
    private val carrinho = LinkedHashMap<String, Int>()
    private var aba = 0
    private var online = true
    private var enviandoFila = false

    // referências da tela de caixa
    private var vNome: TextView? = null
    private var vVendido: TextView? = null
    private var vStatus: TextView? = null
    private var vAbas: LinearLayout? = null
    private var vGrade: LinearLayout? = null
    private var vQtd: TextView? = null
    private var vTotal: TextView? = null
    private var vCobrar: View? = null

    // ====================================================================
    //  ciclo de vida
    // ====================================================================

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        local = Local(this)
        terminal = try { Terminal(this) } catch (e: Throwable) { null }
        if (Impressos.logo == null) {
            Impressos.logo = try {
                android.graphics.BitmapFactory.decodeResource(resources, R.drawable.logo_impressao,
                    android.graphics.BitmapFactory.Options().apply { inScaled = false })
            } catch (e: Throwable) { null }
        }
        raiz = FrameLayout(this)
        setContentView(raiz)

        if (local.token == null) telaParear() else carregarEstado { telaOperadores() }
        agendarFila()
    }

    @Deprecated("Usado de propósito: com targetSdk 23 é o caminho que funciona nas duas maquininhas.")
    override fun onBackPressed() {
        // Voltar fecha a janela de cima. Nunca fecha o aplicativo no meio do caixa.
        if (raiz.childCount > 1) {
            val topo = raiz.getChildAt(raiz.childCount - 1)
            if (topo.tag != "espera") raiz.removeView(topo)
            return
        }
        if (local.token == null) {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    // ====================================================================
    //  infraestrutura de tela
    // ====================================================================

    private fun base(v: View) {
        raiz.removeAllViews()
        raiz.addView(v, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    private fun empilhar(v: View): View {
        raiz.addView(v, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return v
    }

    private fun tirar(v: View?) { if (v != null) raiz.removeView(v) }

    private fun tirarCamadas() { while (raiz.childCount > 1) raiz.removeViewAt(raiz.childCount - 1) }

    private fun aviso(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_LONG).show()

    private fun mostrarEspera(msg: String): View {
        val veu = FrameLayout(this).apply {
            setBackgroundColor(0xCC141618.toInt())
            isClickable = true
            tag = "espera"
        }
        val t = texto(msg, 18f, Cor.BRANCO, true, true).apply { setPadding(dp(30), 0, dp(30), 0) }
        veu.addView(t, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        return empilhar(veu)
    }

    /** Janela de aviso que exige um toque. Para o que não pode passar despercebido. */
    private fun alerta(titulo: String, msg: String, botaoTexto: String = "Entendi", aoTocar: (() -> Unit)? = null) {
        val veu = FrameLayout(this).apply { setBackgroundColor(Cor.VEU); isClickable = true }
        val c = coluna().apply {
            background = fundo(Cor.CARTAO, 14)
            setPadding(dp(18), dp(18), dp(18), dp(16))
        }
        c.addView(texto(titulo, 19f, Cor.TEXTO, true))
        c.addView(texto(msg, 15f, Cor.MUDO).apply { setPadding(0, dp(8), 0, dp(14)) })
        c.addView(botao(botaoTexto, Cor.CARVAO) { raiz.removeView(veu); aoTocar?.invoke() }, cheio())
        val lp = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER)
        lp.setMargins(dp(20), 0, dp(20), 0)
        veu.addView(c, lp)
        empilhar(veu)
    }

    /** Janela que sobe de baixo, com título e um X. */
    private fun folha(titulo: String, conteudo: View): View {
        val veu = FrameLayout(this).apply { setBackgroundColor(Cor.VEU); isClickable = true }
        val caixaFolha = coluna().apply {
            background = fundo(Cor.CARTAO, 16)
            setPadding(dp(16), dp(12), dp(16), dp(16))
            isClickable = true
        }
        val cab = linhaH()
        cab.addView(texto(titulo, 18f, Cor.TEXTO, true), peso())
        cab.addView(texto("✕", 22f, Cor.MUDO).apply {
            setPadding(dp(14), dp(4), dp(4), dp(4))
            setOnClickListener { raiz.removeView(veu) }
        })
        caixaFolha.addView(cab)
        val rolagem = ScrollView(this)
        rolagem.addView(conteudo)
        caixaFolha.addView(rolagem, cheio().apply { topMargin = dp(8) })
        veu.addView(caixaFolha, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
        veu.setOnClickListener { raiz.removeView(veu) }
        return empilhar(veu)
    }

    /**
     * Chamada ao banco fora da thread da tela.
     * Sem rede, marca a maquininha como offline; o resto do erro vai para a tela.
     */
    private fun naRede(espera: String?, tarefa: () -> JSONObject,
                       ok: (JSONObject) -> Unit, falha: ((ErroApi) -> Unit)? = null) {
        val veu = espera?.let { mostrarEspera(it) }
        rede.execute {
            try {
                val r = tarefa()
                online = true
                principal.post { tirar(veu); atualizarStatus(); ok(r) }
            } catch (e: ErroApi) {
                if (e.semRede) online = false
                principal.post {
                    tirar(veu); atualizarStatus()
                    if (falha != null) falha(e) else alerta("Não deu certo", e.message ?: "Erro")
                }
            } catch (e: Throwable) {
                principal.post { tirar(veu); alerta("Erro inesperado", e.message ?: e.javaClass.simpleName) }
            }
        }
    }

    // ====================================================================
    //  teclado de PIN
    // ====================================================================

    /**
     * Teclado de 4 dígitos em tela cheia. `enviar` recebe o PIN e uma função de
     * resposta: null fecha o teclado; uma mensagem mostra o erro e limpa.
     */
    private fun pedirPin(titulo: String, dica: String,
                         enviar: (pin: String, resposta: (String?) -> Unit) -> Unit,
                         aoVoltar: (() -> Unit)? = null) {
        val porta = coluna().apply {
            setBackgroundColor(Cor.CARVAO)
            setPadding(dp(22), dp(26), dp(22), dp(16))
            isClickable = true
        }
        porta.addView(texto(titulo, 21f, Cor.BRANCO, true))
        porta.addView(texto(dica, 14f, Cor.CLARO).apply { setPadding(0, dp(4), 0, dp(14)) })

        val pontos = linhaH().apply { gravity = Gravity.CENTER }
        val bolinhas = (0 until 4).map {
            View(this).apply { background = fundo(0x2EFFFFFF, 99) }.also { v ->
                pontos.addView(v, LinearLayout.LayoutParams(dp(16), dp(16)).apply { setMargins(dp(8), 0, dp(8), 0) })
            }
        }
        porta.addView(pontos, cheio().apply { topMargin = dp(8) })
        val erro = texto("", 14f, 0xFFF09B91.toInt(), false, true).apply { minHeight = dp(24) }
        porta.addView(erro, cheio().apply { topMargin = dp(10) })

        var digitado = ""
        var travado = false
        fun pintar() {
            bolinhas.forEachIndexed { i, v -> v.background = fundo(if (i < digitado.length) Cor.BRANCO else 0x2EFFFFFF, 99) }
        }

        val teclas = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫")
        for (linha in teclas.chunked(3)) {
            val l = linhaH()
            for (t in linha) {
                val b = texto(t, 24f, Cor.BRANCO, true, true).apply {
                    background = if (t.isEmpty()) null else fundo(0x1AFFFFFF, 12)
                    setPadding(0, dp(14), 0, dp(14))
                }
                if (t.isNotEmpty()) b.setOnClickListener {
                    if (travado) return@setOnClickListener
                    erro.text = ""
                    digitado = if (t == "⌫") digitado.dropLast(1) else (digitado + t).take(4)
                    pintar()
                    if (digitado.length == 4) {
                        travado = true
                        erro.setTextColor(Cor.CLARO); erro.text = "Conferindo…"
                        enviar(digitado) { msg ->
                            if (msg == null) {
                                raiz.removeView(porta)
                            } else {
                                erro.setTextColor(0xFFF09B91.toInt()); erro.text = msg
                                digitado = ""; pintar(); travado = false
                            }
                        }
                    }
                }
                l.addView(b, peso().apply { setMargins(dp(5), dp(5), dp(5), dp(5)) })
            }
            porta.addView(l, cheio())
        }

        porta.addView(texto("‹ Voltar", 15f, Cor.CLARO).apply {
            setPadding(0, dp(16), 0, dp(4))
            setOnClickListener { raiz.removeView(porta); aoVoltar?.invoke() }
        })
        empilhar(porta)
    }

    // ====================================================================
    //  pareamento e estado
    // ====================================================================

    private fun telaParear() {
        val c = coluna().apply {
            setBackgroundColor(Cor.CARVAO)
            setPadding(dp(24), dp(40), dp(24), dp(24))
        }
        c.addView(texto("FEST VALE", 26f, Cor.BRANCO, true))
        c.addView(texto("Parear esta maquininha", 20f, Cor.BRANCO, true).apply { setPadding(0, dp(18), 0, dp(6)) })
        c.addView(texto("No celular, abra o painel de gestão do evento e toque em \"Parear maquininha\". " +
                "Digite aqui o código de 8 letras que aparecer. Ele vale por 15 minutos.", 15f, Cor.CLARO))
        val campoCodigo = campo("Código", max = 8, escuro = true).apply {
            filters = arrayOf(InputFilter.AllCaps(), InputFilter.LengthFilter(8))
            textSize = 24f
            gravity = Gravity.CENTER
            letterSpacing = 0.15f
        }
        c.addView(campoCodigo, cheio().apply { topMargin = dp(24) })
        c.addView(botao("Parear", Cor.OK) {
            val cod = campoCodigo.text.toString().trim().uppercase()
            if (cod.length != 8) { aviso("O código tem 8 letras"); return@botao }
            naRede("Pareando…", {
                val t = terminal
                Api.chamar(null, "parear", JSONObject()
                    .put("codigo", cod)
                    .put("serial", t?.serial() ?: "")
                    .put("modelo", t?.modelo() ?: ""))
            }, { r ->
                local.token = r.getString("token")
                local.nomeEvento = r.optString("evento")
                carregarEstado { telaOperadores() }
            })
        }, cheio().apply { topMargin = dp(14) })
        base(c)
    }

    private fun aplicarEstado(r: JSONObject) {
        r.optJSONObject("evento")?.optString("nome")?.let { if (it.isNotBlank()) local.nomeEvento = it }
        produtos = r.optJSONArray("produtos") ?: JSONArray()
        operadores = r.optJSONArray("operadores") ?: JSONArray()
        ingressos = r.optJSONArray("ingressos") ?: JSONArray()
    }

    private fun carregarEstado(depois: () -> Unit) {
        naRede("Carregando o cardápio…", { Api.chamar(local.token, "estado") }, { r ->
            aplicarEstado(r); local.estadoEmCache = r; depois()
        }, { e ->
            if (e.message == "TERMINAL_NAO_PAREADO") {
                local.desparear(); telaParear()
                alerta("Maquininha despareada", "Esta maquininha foi desligada do evento no painel. Pareie de novo.")
                return@naRede
            }
            val cache = local.estadoEmCache
            if (cache != null) {
                aplicarEstado(cache)
                aviso("Sem internet — usando o último cardápio baixado")
                depois()
            } else {
                alerta("Sem internet", "Não consegui baixar o cardápio, e esta maquininha ainda não tem um guardado.", "Tentar de novo") {
                    carregarEstado(depois)
                }
            }
        })
    }

    /** Atualiza estoque e operadores em segundo plano, sem travar a tela. */
    private fun atualizarEstadoSilencioso() {
        val tok = local.token ?: return
        rede.execute {
            try {
                val r = Api.chamar(tok, "estado")
                online = true
                principal.post {
                    aplicarEstado(r); local.estadoEmCache = r
                    if (vGrade != null) { desenharGrade(); atualizarRodape() }
                    atualizarStatus()
                }
            } catch (e: ErroApi) {
                if (e.semRede) { online = false; principal.post { atualizarStatus() } }
            }
        }
    }

    // ====================================================================
    //  fila de vendas sem internet
    // ====================================================================

    private fun agendarFila() {
        principal.postDelayed(object : Runnable {
            override fun run() {
                enviarFila(silencioso = true)
                principal.postDelayed(this, 20_000)
            }
        }, 20_000)
    }

    private fun enviarFila(silencioso: Boolean, depois: ((Int) -> Unit)? = null) {
        if (enviandoFila) { depois?.invoke(local.pendentes()); return }
        if (local.pendentes() == 0) { depois?.invoke(0); return }
        enviandoFila = true
        rede.execute {
            val antes = local.pendentes()
            val resto = try { local.enviarFila() } catch (e: Throwable) { antes }
            if (resto < antes) online = true
            enviandoFila = false
            principal.post {
                atualizarStatus()
                if (!silencioso && resto > 0) aviso("Ainda há $resto venda(s) esperando internet")
                if (resto < antes) atualizarEstadoSilencioso()
                depois?.invoke(resto)
            }
        }
    }

    private fun atualizarStatus() {
        val v = vStatus ?: return
        val n = local.pendentes()
        when {
            n > 0 -> { v.text = "$n na fila"; v.setTextColor(0xFFFFC27A.toInt()); v.background = fundo(0x40E8921F, 99) }
            !online -> { v.text = "sem internet"; v.setTextColor(0xFFF09B91.toInt()); v.background = fundo(0x40C0392B, 99) }
            else -> { v.text = "online"; v.setTextColor(0xFF8BD98E.toInt()); v.background = fundo(0x3846A049, 99) }
        }
    }

    // ====================================================================
    //  quem está no caixa
    // ====================================================================

    private fun telaOperadores() {
        operadorId = null; caixa = null; carrinho.clear()
        vGrade = null; vStatus = null

        val c = coluna().apply {
            setBackgroundColor(Cor.CARVAO)
            setPadding(dp(18), dp(22), dp(18), dp(14))
        }
        c.addView(texto(local.nomeEvento.ifBlank { "Fest Vale" }, 13f, Cor.CLARO))
        c.addView(texto("Quem está no caixa?", 22f, Cor.BRANCO, true).apply { setPadding(0, dp(4), 0, dp(4)) })
        c.addView(texto("Toque no seu nome e digite seu PIN.", 14f, Cor.CLARO).apply { setPadding(0, 0, 0, dp(12)) })

        val pend = local.pendentes()
        if (pend > 0) {
            c.addView(texto("$pend venda(s) feitas sem internet esperando para subir", 13f, 0xFFFFC27A.toInt()).apply {
                background = fundo(0x33E8921F, 8); setPadding(dp(10), dp(8), dp(10), dp(8))
            }, cheio().apply { bottomMargin = dp(10) })
        }

        val lista = coluna()
        if (operadores.length() == 0) {
            lista.addView(texto("Nenhum operador cadastrado ainda.\n\nCadastre pelo painel de gestão no celular, " +
                    "ou toque em Gestão abaixo.", 15f, Cor.CLARO).apply { setPadding(0, dp(20), 0, dp(20)) })
        }
        for (i in 0 until operadores.length()) {
            val o = operadores.getJSONObject(i)
            val nome = o.optString("nome")
            val linha = linhaH().apply {
                background = fundo(0x12FFFFFF, 12, 0x14FFFFFF, 1)
                setPadding(dp(12), dp(10), dp(12), dp(10))
            }
            linha.addView(avatar(nome, 40))
            val txt = coluna().apply { setPadding(dp(12), 0, 0, 0) }
            txt.addView(texto(nome, 17f, Cor.BRANCO, true))
            txt.addView(texto(if (o.optBoolean("caixa_aberto")) "caixa aberto" else "toque para entrar", 12f, Cor.CLARO))
            linha.addView(txt, peso())
            linha.setOnClickListener { entrar(o.optString("id"), nome) }
            lista.addView(linha, cheio().apply { bottomMargin = dp(8) })
        }
        val rolagem = ScrollView(this).apply { addView(lista) }
        c.addView(rolagem, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        val rodape = linhaH()
        rodape.addView(botaoContorno("Atualizar", Cor.CLARO) { carregarEstado { telaOperadores() } }, peso().apply { rightMargin = dp(6) })
        rodape.addView(botaoContorno("Gestão", Cor.CLARO) { abrirGestao() }, peso().apply { leftMargin = dp(6) })
        c.addView(rodape, cheio().apply { topMargin = dp(10) })
        base(c)
    }

    private fun avatar(nome: String, tamanho: Int): TextView {
        val cores = intArrayOf(Cor.AZUL, Cor.LARANJA, Cor.VERDE, Cor.VERMELHO, 0xFF7A5CC4.toInt(), Cor.MUDO)
        val cor = cores[Math.floorMod(nome.hashCode(), cores.size)]
        return texto(iniciais(nome), (tamanho / 2.9f), Cor.BRANCO, true, true).apply {
            background = fundo(cor, 99)
            layoutParams = LinearLayout.LayoutParams(dp(tamanho), dp(tamanho))
        }
    }

    private fun entrar(id: String, nome: String) {
        pedirPin("PIN de ${primeiroNome(nome)}", "Quatro números.", { pin, resposta ->
            naRede(null, {
                Api.chamar(local.token, "entrar", JSONObject().put("operador_id", id).put("pin", pin))
            }, { r ->
                resposta(null)
                operadorId = id
                operadorNome = r.optJSONObject("operador")?.optString("nome") ?: nome
                caixa = r.optJSONObject("caixa")
                if (caixa == null) telaAbertura() else telaCaixa()
            }, { e -> resposta(if (e.semRede) "Sem internet para conferir o PIN" else e.message) })
        })
    }

    private fun sair() {
        tirarCamadas()
        telaOperadores()
        atualizarEstadoSilencioso()
    }

    // ====================================================================
    //  abertura de caixa
    // ====================================================================

    private fun telaAbertura() {
        val c = coluna().apply {
            setBackgroundColor(Cor.CARVAO)
            setPadding(dp(20), dp(26), dp(20), dp(16))
        }
        c.addView(texto("Abertura de caixa", 22f, Cor.BRANCO, true))
        c.addView(texto("$operadorNome ainda não tem caixa aberto. Registre o troco que está recebendo.",
            14f, Cor.CLARO).apply { setPadding(0, dp(6), 0, dp(18)) })
        c.addView(texto("FUNDO DE TROCO", 12f, Cor.CLARO, true))

        var escolhido: Int? = null
        val valores = listOf(5000, 10000, 20000)
        val botoes = mutableListOf<TextView>()
        val outro = campo("Outro valor, em reais", decimal = true, escuro = true)
        val abrir = botao("ABRIR CAIXA", Cor.DESLIGADO) {}

        fun marcar(v: Int?) {
            escolhido = v
            botoes.forEachIndexed { i, b -> b.background = fundo(if (valores[i] == v) 0x42FFFFFF else 0x1AFFFFFF, 10) }
            val pronto = v != null
            abrir.isEnabled = pronto
            abrir.background = fundo(if (pronto) Cor.OK else Cor.DESLIGADO, 10)
            abrir.text = if (pronto) "ABRIR CAIXA COM ${brl(v!!)}" else "ABRIR CAIXA"
        }

        val atalhos = linhaH()
        for (v in valores) {
            val b = texto(brl(v), 17f, Cor.BRANCO, true, true).apply {
                background = fundo(0x1AFFFFFF, 10); setPadding(0, dp(14), 0, dp(14))
                setOnClickListener { outro.setText(""); marcar(v) }
            }
            botoes += b
            atalhos.addView(b, peso().apply { setMargins(dp(4), 0, dp(4), 0) })
        }
        c.addView(atalhos, cheio().apply { topMargin = dp(8) })
        outro.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) {
                if (!s.isNullOrBlank()) marcar(lerReais(s.toString()))
            }
        })
        c.addView(outro, cheio().apply { topMargin = dp(10) })

        abrir.setOnClickListener {
            val v = escolhido ?: return@setOnClickListener
            pedirPin("Quem está entregando o troco?", "O PIN do gestor confirma a entrega de ${brl(v)}.", { pin, resposta ->
                naRede(null, {
                    Api.chamar(local.token, "abrir_caixa", JSONObject()
                        .put("operador_id", operadorId).put("fundo_cents", v).put("pin_gestor", pin))
                }, { r -> resposta(null); caixa = r; telaCaixa() },
                    { e -> resposta(e.message) })
            })
        }
        marcar(null)
        c.addView(abrir, cheio().apply { topMargin = dp(18) })
        c.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))
        c.addView(texto("‹ Trocar de operador", 15f, Cor.CLARO).apply {
            setPadding(0, dp(12), 0, dp(4)); setOnClickListener { sair() }
        })
        base(c)
    }

    // ====================================================================
    //  tela de caixa
    // ====================================================================

    private fun categorias(): List<String> {
        val vistas = LinkedHashSet<String>()
        for (i in 0 until produtos.length()) vistas += produtos.getJSONObject(i).optString("categoria", "Outros")
        if (ingressos.length() > 0) vistas += ABA_INGRESSO
        return vistas.toList()
    }

    private val ABA_INGRESSO = "Ingresso"

    private fun produto(id: String): JSONObject? {
        for (i in 0 until produtos.length()) {
            val p = produtos.getJSONObject(i)
            if (p.optString("id") == id) return p
        }
        return null
    }

    private fun totalCarrinho(): Int = carrinho.entries.sumOf { (id, q) -> (produto(id)?.optInt("preco") ?: 0) * q }
    private fun itensCarrinho(): Int = carrinho.values.sum()

    private fun telaCaixa() {
        val c = coluna().apply { setBackgroundColor(Cor.TELA) }

        // cabeçalho: quem está vendendo, quanto já vendeu, internet, gestão
        val cab = linhaH().apply {
            setBackgroundColor(Cor.CARVAO)
            setPadding(dp(10), dp(8), dp(8), dp(9))
        }
        val quem = linhaH().apply { setOnClickListener { meuCaixa() } }
        quem.addView(avatar(operadorNome, 34))
        val qt = coluna().apply { setPadding(dp(9), 0, 0, 0) }
        val nNome = texto(primeiroNome(operadorNome), 16f, Cor.BRANCO, true)
        val nVendido = texto("", 12f, Cor.CLARO)
        vNome = nNome; vVendido = nVendido
        qt.addView(nNome); qt.addView(nVendido)
        quem.addView(qt)
        cab.addView(quem, peso())
        val nStatus = texto("online", 11f, Cor.BRANCO, true).apply { setPadding(dp(9), dp(4), dp(9), dp(4)) }
        vStatus = nStatus
        cab.addView(nStatus)
        cab.addView(texto("🔒", 17f, Cor.BRANCO, false, true).apply {
            background = fundo(0x1AFFFFFF, 8)
            setPadding(dp(10), dp(6), dp(10), dp(6))
            setOnClickListener { abrirGestao() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { leftMargin = dp(8) })
        c.addView(cab, cheio())

        // abas: todas à vista, nada rolando para o lado
        val nAbas = coluna().apply { setBackgroundColor(Cor.CARVAO) }
        vAbas = nAbas
        c.addView(nAbas, cheio())

        // grade de produtos
        val nGrade = coluna().apply { setPadding(dp(8), dp(8), dp(8), dp(8)) }
        vGrade = nGrade
        val rolagem = ScrollView(this)
        rolagem.addView(nGrade)
        c.addView(rolagem, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f))

        // rodapé: total e cobrar
        val rod = linhaH().apply {
            setBackgroundColor(Cor.CARTAO)
            setPadding(dp(12), dp(9), dp(10), dp(9))
        }
        val res = coluna().apply { setOnClickListener { abrirCarrinho() } }
        val nQtd = texto("carrinho vazio", 12f, Cor.MUDO)
        val nTotal = texto(brl(0), 25f, Cor.TEXTO, true)
        vQtd = nQtd; vTotal = nTotal
        res.addView(nQtd); res.addView(nTotal)
        rod.addView(res, peso())
        val nCobrar = botao("COBRAR", Cor.OK, tamanho = 17f, altura = 54) { abrirPagamento() }
        nCobrar.setPadding(dp(26), 0, dp(26), 0)
        vCobrar = nCobrar
        rod.addView(nCobrar)
        c.addView(rod, cheio())

        base(c)
        aba = aba.coerceIn(0, maxOf(0, categorias().size - 1))
        desenharAbas(); desenharGrade(); atualizarRodape(); atualizarCabecalho(); atualizarStatus()
    }

    private fun atualizarCabecalho() {
        val cx = caixa ?: return
        vVendido?.text = "${brl(cx.optInt("vendido"))} vendido · ${cx.optInt("vendas")} vendas"
    }

    private fun desenharAbas() {
        val area = vAbas ?: return
        area.removeAllViews()
        val cats = categorias()
        val fatias = when (cats.size) {
            0 -> emptyList()
            1, 2, 3 -> listOf(cats.size)
            4 -> listOf(2, 2)
            5 -> listOf(2, 3)
            6 -> listOf(3, 3)
            else -> cats.chunked(3).map { it.size }
        }
        var idx = 0
        for (n in fatias) {
            val l = linhaH()
            repeat(n) {
                val i = idx
                val cat = cats[i]
                val col = coluna().apply { setOnClickListener { aba = i; desenharAbas(); desenharGrade() } }
                col.addView(texto(cat.uppercase(), 12f, if (i == aba) Cor.BRANCO else 0xFF9AA2A8.toInt(), true, true).apply {
                    setPadding(dp(2), dp(9), dp(2), dp(7)); maxLines = 1
                })
                col.addView(View(this).apply { setBackgroundColor(if (i == aba) corDaCategoria(cat) else Color.TRANSPARENT) },
                    LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)))
                l.addView(col, peso())
                idx++
            }
            area.addView(l, cheio())
        }
    }

    private fun desenharGrade() {
        val g = vGrade ?: return
        g.removeAllViews()
        val cats = categorias()
        if (cats.isEmpty()) {
            g.addView(texto("O cardápio está vazio. Cadastre os produtos no painel.", 15f, Cor.MUDO, false, true)
                .apply { setPadding(dp(10), dp(40), dp(10), dp(40)) })
            return
        }
        val cat = cats[aba.coerceIn(0, cats.size - 1)]
        if (cat == ABA_INGRESSO) { desenharIngressos(g); return }
        val daAba = (0 until produtos.length()).map { produtos.getJSONObject(it) }.filter { it.optString("categoria") == cat }
        for (par in daAba.chunked(2)) {
            val l = linhaH()
            for (p in par) l.addView(cartaoProduto(p), peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
            if (par.size == 1) l.addView(View(this), peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
            g.addView(l, cheio())
        }
    }

    private fun cartaoProduto(p: JSONObject): View {
        val id = p.optString("id")
        val cor = corDaCategoria(p.optString("categoria"))
        val noCarrinho = carrinho[id] ?: 0
        val controla = p.optBoolean("controla", true)
        val restante = p.optInt("estoque") - noCarrinho
        val alerta = p.optInt("alerta", 10)
        val esgotado = controla && restante <= 0

        val moldura = FrameLayout(this)
        val corpo = linhaH().apply {
            background = fundo(Cor.CARTAO, 10, Cor.LINHA, 1)
            minimumHeight = dp(96)
        }
        corpo.addView(View(this).apply { background = fundo(cor, 3) }, LinearLayout.LayoutParams(dp(5), ViewGroup.LayoutParams.MATCH_PARENT))
        val col = coluna().apply { setPadding(dp(9), dp(8), dp(8), dp(8)) }
        col.addView(texto(p.optString("nome"), 14f, Cor.TEXTO, true).apply { maxLines = 3 })
        if (controla && esgotado) {
            col.addView(texto("esgotado", 12f, Cor.MUDO, true))
        } else if (controla && restante <= maxOf(alerta, 1)) {
            col.addView(texto("restam $restante", 12f, Cor.VERMELHO, true))
        }
        col.addView(View(this), LinearLayout.LayoutParams(1, 0, 1f))
        col.addView(texto(brl(p.optInt("preco")), 20f, Cor.TEXTO, true))
        corpo.addView(col, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f))
        moldura.addView(corpo, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        if (noCarrinho > 0) {
            moldura.addView(texto(noCarrinho.toString(), 13f, Cor.BRANCO, true, true).apply {
                background = fundo(Cor.OK, 99); minWidth = dp(26); setPadding(dp(6), dp(3), dp(6), dp(3))
            }, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP or Gravity.END))
        }

        if (esgotado) {
            moldura.alpha = 0.45f
        } else {
            moldura.setOnClickListener {
                carrinho[id] = noCarrinho + 1
                desenharGrade(); atualizarRodape()
            }
        }
        return moldura
    }

    private fun atualizarRodape() {
        val n = itensCarrinho()
        vQtd?.text = when (n) { 0 -> "carrinho vazio"; 1 -> "1 item · toque para ver"; else -> "$n itens · toque para ver" }
        vTotal?.text = brl(totalCarrinho())
        vCobrar?.isEnabled = n > 0
        vCobrar?.background = fundo(if (n > 0) Cor.OK else Cor.DESLIGADO, 10)
    }

    private fun abrirCarrinho() {
        if (carrinho.isEmpty()) return
        val lista = coluna()
        var janela: View? = null
        for ((id, q) in carrinho.entries.toList()) {
            val p = produto(id) ?: continue
            val l = linhaH().apply { setPadding(0, dp(8), 0, dp(8)) }
            val t = coluna()
            t.addView(texto(p.optString("nome"), 14f, Cor.TEXTO, true))
            t.addView(texto("${brl(p.optInt("preco"))} cada", 12f, Cor.MUDO))
            l.addView(t, peso())
            val menos = texto("−", 22f, Cor.TEXTO, true, true).apply { background = fundo(Cor.TELA, 8, Cor.LINHA, 1) }
            val mais = texto("+", 22f, Cor.TEXTO, true, true).apply { background = fundo(Cor.TELA, 8, Cor.LINHA, 1) }
            menos.setOnClickListener {
                val n = (carrinho[id] ?: 0) - 1
                if (n <= 0) carrinho.remove(id) else carrinho[id] = n
                tirar(janela); desenharGrade(); atualizarRodape(); abrirCarrinho()
            }
            mais.setOnClickListener {
                val restante = p.optInt("estoque") - (carrinho[id] ?: 0)
                if (p.optBoolean("controla", true) && restante <= 0) { aviso("Não há mais em estoque"); return@setOnClickListener }
                carrinho[id] = (carrinho[id] ?: 0) + 1
                tirar(janela); desenharGrade(); atualizarRodape(); abrirCarrinho()
            }
            l.addView(menos, LinearLayout.LayoutParams(dp(40), dp(40)))
            l.addView(texto(q.toString(), 17f, Cor.TEXTO, true, true), LinearLayout.LayoutParams(dp(34), ViewGroup.LayoutParams.WRAP_CONTENT))
            l.addView(mais, LinearLayout.LayoutParams(dp(40), dp(40)))
            l.addView(texto(brl(q * p.optInt("preco")), 15f, Cor.TEXTO, true).apply { gravity = Gravity.END },
                LinearLayout.LayoutParams(dp(84), ViewGroup.LayoutParams.WRAP_CONTENT))
            lista.addView(l, cheio())
        }
        lista.addView(botaoContorno("Esvaziar carrinho", Cor.VERMELHO) {
            carrinho.clear(); tirar(janela); desenharGrade(); atualizarRodape()
        }, cheio().apply { topMargin = dp(10) })
        janela = folha("Carrinho · ${brl(totalCarrinho())}", lista)
    }

    // ====================================================================
    //  pagamento
    // ====================================================================

    private fun abrirPagamento() {
        if (carrinho.isEmpty()) return
        val c = coluna()
        var janela: View? = null
        fun opcao(titulo: String, sub: String, cor: Int, aoTocar: () -> Unit): View =
            coluna().apply {
                background = fundo(Cor.CARTAO, 12, cor, 2)
                setPadding(dp(10), dp(16), dp(10), dp(16))
                gravity = Gravity.CENTER
                addView(texto(titulo, 18f, cor, true, true))
                addView(texto(sub, 12f, Cor.MUDO, false, true))
                setOnClickListener { tirar(janela); aoTocar() }
            }
        val l1 = linhaH()
        l1.addView(opcao("Crédito", "passa no chip", Cor.TEXTO) { cobrarNaMaquininha(PlugPag.TYPE_CREDITO, "credito", "Crédito") }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        l1.addView(opcao("Débito", "passa no chip", Cor.TEXTO) { cobrarNaMaquininha(PlugPag.TYPE_DEBITO, "debito", "Débito") }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        c.addView(l1, cheio())
        val l2 = linhaH()
        l2.addView(opcao("Pix", "QR na tela", Cor.TEXTO) { cobrarNaMaquininha(PlugPag.TYPE_PIX, "pix", "Pix") }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        l2.addView(opcao("Dinheiro", "calcula o troco", Cor.OK) { telaTroco() }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        c.addView(l2, cheio())
        c.addView(opcao("Cortesia", "precisa de gestor", Cor.LARANJA) { telaCortesia() }, cheio().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        janela = folha("Cobrar ${brl(totalCarrinho())}", c)
    }

    private fun novoToken(): String {
        val b = ByteArray(8); sorteio.nextBytes(b)
        return b.joinToString("") { "%02x".format(it) }
    }

    private fun cobrarNaMaquininha(tipo: Int, meio: String, rotulo: String,
                                   total: Int = totalCarrinho(),
                                   aoAprovar: ((cid: String, codigo: String) -> Unit)? = null) {
        val cid = UUID.randomUUID().toString()
        val t = terminal
        if (t == null) { alerta("Sem leitor de cartão", "Este aparelho não tem o serviço de pagamento do PagBank."); return }

        // Tela da cobrança: o valor, o que o leitor está pedindo e o Cancelar.
        val veu = coluna().apply {
            setBackgroundColor(0xF2141618.toInt())
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
            isClickable = true
            tag = "espera"
        }
        veu.addView(texto("$rotulo · ${brl(total)}", 18f, Cor.CLARO, true, true))
        val vMsg = texto("Preparando o leitor…", 26f, Cor.BRANCO, true, true).apply { setPadding(0, dp(28), 0, dp(36)) }
        veu.addView(vMsg, cheio())
        val vCancelar = botaoContorno("Cancelar cobrança", Cor.CLARO) {}
        veu.addView(vCancelar, cheio())
        empilhar(veu)

        t.aoMudarMensagem = { m -> principal.post { vMsg.text = m } }
        var cancelando = false
        vCancelar.setOnClickListener {
            if (cancelando) return@setOnClickListener
            cancelando = true
            vCancelar.text = "Cancelando…"
            Thread { t.cancelar() }.start()
        }

        hardware.execute {
            val erroAtivacao = t.garantirAtivacao(local.codigoAtivacao)
            if (erroAtivacao != null) {
                t.aoMudarMensagem = null
                principal.post { tirar(veu); alerta("O pinpad não está pronto", erroAtivacao) }
                return@execute
            }
            principal.post { vMsg.text = "INSIRA, PASSE OU APROXIME O CARTÃO" }
            val r = t.cobrar(tipo, total, "FV" + cid.replace("-", "").take(8))
            t.aoMudarMensagem = null
            principal.post {
                tirar(veu)
                when (r) {
                    is Cobranca.Aprovada ->
                        if (aoAprovar != null) aoAprovar(cid, r.codigo)
                        else registrarVenda(meio, rotulo, cid, pagamentoExterno = r.codigo)
                    is Cobranca.Recusada ->
                        if (cancelando) aviso("Cobrança cancelada")
                        else alerta("Pagamento não aprovado", r.motivo, "Voltar")
                }
            }
        }
    }

    private fun telaTroco(devido: Int = totalCarrinho(), aoConfirmar: ((recebido: Int) -> Unit)? = null) {
        var recebido: Int? = null
        val c = coluna()
        val vRec = texto("—", 30f, Cor.TEXTO, true, true)
        val vTroco = texto(brl(0), 30f, Cor.OK, true, true)
        val confirmar = botao("CONFIRMAR RECEBIMENTO", Cor.DESLIGADO) {}
        var janela: View? = null

        fun atualizar() {
            vRec.text = recebido?.let { brl(it) } ?: "—"
            val r = recebido
            if (r == null) { vTroco.text = brl(0); vTroco.setTextColor(Cor.OK) }
            else if (r < devido) { vTroco.text = "falta ${brl(devido - r)}"; vTroco.setTextColor(Cor.VERMELHO) }
            else { vTroco.text = brl(r - devido); vTroco.setTextColor(Cor.OK) }
            val ok = r != null && r >= devido
            confirmar.isEnabled = ok
            confirmar.background = fundo(if (ok) Cor.OK else Cor.DESLIGADO, 10)
        }

        c.addView(texto("RECEBIDO", 12f, Cor.MUDO, true, true))
        c.addView(vRec)
        val caixaTroco = coluna().apply { background = fundo(Cor.TELA, 12); setPadding(dp(10), dp(10), dp(10), dp(10)) }
        caixaTroco.addView(texto("TROCO", 12f, Cor.MUDO, true, true))
        caixaTroco.addView(vTroco)
        c.addView(caixaTroco, cheio().apply { setMargins(0, dp(10), 0, dp(10)) })

        val valores = listOf(devido, 2000, 5000, 10000, 20000)
        val campoOutro = campo("Quanto o cliente deu, em reais", decimal = true)
        for (grupo in (valores.map { it as Int? } + listOf(null)).chunked(3)) {
            val l = linhaH()
            for (v in grupo) {
                val rot = when { v == null -> "Outro"; v == devido -> "Exato"; else -> brl(v) }
                l.addView(texto(rot, 16f, Cor.TEXTO, true, true).apply {
                    background = fundo(Cor.CARTAO, 10, Cor.LINHA, 1)
                    setPadding(0, dp(13), 0, dp(13))
                    setOnClickListener {
                        if (v == null) { campoOutro.visibility = View.VISIBLE; campoOutro.requestFocus() }
                        else { recebido = v; campoOutro.visibility = View.GONE; atualizar() }
                    }
                }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
            }
            c.addView(l, cheio())
        }
        campoOutro.visibility = View.GONE
        campoOutro.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, b: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) { recebido = lerReais(s?.toString() ?: ""); atualizar() }
        })
        c.addView(campoOutro, cheio().apply { setMargins(dp(4), dp(6), dp(4), 0) })

        confirmar.setOnClickListener {
            val r = recebido ?: return@setOnClickListener
            if (r < devido) return@setOnClickListener
            tirar(janela)
            if (aoConfirmar != null) aoConfirmar(r)
            else registrarVenda("dinheiro", "Dinheiro", UUID.randomUUID().toString(), recebido = r)
        }
        c.addView(confirmar, cheio().apply { topMargin = dp(12) })
        atualizar()
        janela = folha("Dinheiro · ${brl(devido)}", c)
    }

    private fun telaCortesia() {
        val c = coluna()
        var janela: View? = null
        var motivo = ""
        c.addView(texto("Para quem é a cortesia?", 14f, Cor.MUDO))
        val campoMotivo = campo("Outro motivo")
        val chips = mutableListOf<TextView>()
        for (grupo in listOf("Polícia Militar", "Bombeiros", "Equipe do evento", "Artistas").chunked(2)) {
            val l = linhaH()
            for (m in grupo) {
                val ch = texto(m, 14f, Cor.TEXTO, true, true).apply {
                    background = fundo(Cor.CARTAO, 10, Cor.LINHA, 1)
                    setPadding(dp(6), dp(12), dp(6), dp(12))
                }
                ch.setOnClickListener {
                    motivo = m; campoMotivo.setText("")
                    chips.forEach { x -> x.background = fundo(Cor.CARTAO, 10, Cor.LINHA, 1) }
                    ch.background = fundo(0x22E8921F, 10, Cor.LARANJA, 2)
                }
                chips += ch
                l.addView(ch, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
            }
            c.addView(l, cheio())
        }
        c.addView(campoMotivo, cheio().apply { setMargins(dp(4), dp(8), dp(4), 0) })
        c.addView(botao("PEDIR AUTORIZAÇÃO", Cor.LARANJA) {
            val m = campoMotivo.text.toString().trim().ifBlank { motivo }
            if (m.length < 3) { aviso("Escolha ou escreva o motivo"); return@botao }
            tirar(janela)
            val cid = UUID.randomUUID().toString()
            pedirPin("Cortesia precisa de gestor", "Só um gestor libera venda a R$ 0,00.", { pin, resposta ->
                registrarVenda("cortesia", "Cortesia", cid, pinGestor = pin, motivo = m, resposta = resposta)
            })
        }, cheio().apply { topMargin = dp(14) })
        janela = folha("Cortesia", c)
    }

    /**
     * Registra a venda no banco. Sem internet, a venda vai para a fila e a
     * ficha sai do mesmo jeito: o token da ficha é gerado aqui, então ela vale
     * assim que a venda subir. Cortesia não entra na fila: o PIN do gestor
     * precisa ser conferido na hora.
     */
    private fun registrarVenda(meio: String, rotulo: String, clientUuid: String,
                               recebido: Int? = null, pagamentoExterno: String? = null,
                               pinGestor: String? = null, motivo: String? = null,
                               resposta: ((String?) -> Unit)? = null) {
        val cortesia = meio == "cortesia"
        val total = if (cortesia) 0 else totalCarrinho()
        val itensReq = JSONArray()
        // Uma ficha (um QR) por unidade. O token nasce aqui para a ficha poder
        // sair mesmo sem internet; o banco grava cada uma quando a venda sobe.
        val fichasReq = JSONArray()
        val fichasImp = JSONArray()
        for ((id, q) in carrinho) {
            val p = produto(id) ?: continue
            itensReq.put(JSONObject().put("product_id", id).put("qty", q))
            repeat(q) {
                val tk = novoToken()
                fichasReq.put(JSONObject().put("token", tk).put("product_id", id))
                fichasImp.put(JSONObject().put("token", tk).put("nome", p.optString("nome"))
                    .put("preco", if (cortesia) 0 else p.optInt("preco")))
            }
        }
        val token = novoToken()
        val dados = JSONObject()
            .put("client_uuid", clientUuid)
            .put("caixa_id", caixa?.optString("caixa_id"))
            .put("meio", meio)
            .put("itens", itensReq)
            .put("fichas", fichasReq)
            .put("ticket_token", token)
            .put("vendido_em", agoraIso())
        if (recebido != null) dados.put("recebido_cents", recebido)
        if (pagamentoExterno != null) dados.put("pagamento_externo", pagamentoExterno)
        if (pinGestor != null) dados.put("pin_gestor", pinGestor)
        if (motivo != null) dados.put("motivo", motivo)
        val troco = if (recebido != null) recebido - total else 0

        val veu = if (resposta == null) mostrarEspera("Registrando a venda…") else null
        rede.execute {
            try {
                val r = Api.chamar(local.token, "vender", dados)
                online = true
                principal.post {
                    tirar(veu); resposta?.invoke(null)
                    r.optJSONObject("caixa")?.let { caixa = it }
                    concluir(fichasImp, total, rotulo, troco, false)
                }
                atualizarEstadoSilencioso()
            } catch (e: ErroApi) {
                if (e.semRede && !cortesia) {
                    online = false
                    dados.put("offline", true)
                    local.enfileirar(dados)
                    principal.post {
                        tirar(veu); resposta?.invoke(null)
                        baixarLocalmente(total, meio)
                        concluir(fichasImp, total, rotulo, troco, true)
                    }
                } else {
                    principal.post {
                        tirar(veu)
                        val msg: String = if (e.semRede) "Cortesia precisa de internet para conferir o PIN do gestor." else (e.message ?: "Erro")
                        when {
                            resposta != null -> resposta(msg)
                            pagamentoExterno != null -> alerta("Venda não registrada",
                                "A cobrança foi APROVADA (código $pagamentoExterno), mas o sistema recusou a venda:\n\n$msg\n\n" +
                                "Chame um gestor antes de entregar o produto.")
                            else -> alerta("Venda não registrada", msg)
                        }
                    }
                }
            } catch (e: Throwable) {
                principal.post {
                    tirar(veu)
                    val msg = e.message ?: e.javaClass.simpleName
                    if (resposta != null) resposta(msg)
                    else alerta("Venda não registrada", if (pagamentoExterno != null)
                        "A cobrança foi APROVADA (código $pagamentoExterno), mas houve um erro ao registrar:\n\n$msg\n\nChame um gestor antes de entregar o produto."
                        else msg)
                }
            }
        }
    }

    /** Sem internet, desconta o estoque e soma no caixa aqui mesmo, até a venda subir. */
    private fun baixarLocalmente(total: Int, meio: String) {
        for ((id, q) in carrinho) {
            val p = produto(id) ?: continue
            p.put("estoque", p.optInt("estoque") - q)
        }
        val cx = caixa ?: return
        cx.put("vendido", cx.optInt("vendido") + total)
        cx.put("vendas", cx.optInt("vendas") + 1)
        if (meio == "dinheiro") {
            cx.put("dinheiro", cx.optInt("dinheiro") + total)
            cx.put("na_gaveta", cx.optInt("na_gaveta") + total)
        }
    }

    private fun imprimirEmFundo(gerar: () -> android.graphics.Bitmap, depois: (() -> Unit)? = null) {
        hardware.execute {
            val t = terminal
            val erro = try { if (t == null) "Sem impressora neste aparelho" else t.imprimir(gerar()) } catch (e: Throwable) { e.message ?: "Falha na impressão" }
            principal.post {
                if (erro != null) aviso(erro)
                depois?.invoke()
            }
        }
    }

    private fun concluir(fichas: JSONArray, total: Int, rotulo: String, troco: Int, offline: Boolean) {
        val quando = dataHoraBrasilia()
        val n = fichas.length()
        // Imprime as fichas em sequência, uma por unidade.
        val imprimirTodas = {
            for (i in 0 until n) {
                val f = fichas.getJSONObject(i)
                imprimirEmFundo({
                    Impressos.ficha(local.nomeEvento, f.optString("nome"), f.optInt("preco"), rotulo,
                        quando, f.optString("token"), i + 1, n, offline)
                })
            }
        }
        imprimirTodas()
        telaConcluida(n, if (n == 1) "ficha" else "fichas", total, rotulo, troco, offline, imprimirTodas)
    }

    /** Tela verde do fim da venda — serve para o bar e para o ingresso. */
    private fun telaConcluida(n: Int, unidade: String, total: Int, rotulo: String, troco: Int,
                              offline: Boolean, reimprimir: () -> Unit, limparCarrinho: Boolean = true) {
        val cor = when { rotulo == "Cortesia" -> Cor.LARANJA; offline -> 0xFF8A6D1F.toInt(); else -> Cor.OK }
        val c = coluna().apply {
            setBackgroundColor(cor)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
            isClickable = true
        }
        c.addView(texto("✓", 64f, Cor.BRANCO, true, true))
        c.addView(texto(when { rotulo == "Cortesia" -> "CORTESIA LIBERADA"; offline -> "VENDA NA FILA"; else -> "VENDA REGISTRADA" },
            26f, Cor.BRANCO, true, true))
        c.addView(texto("${brl(total)} · $rotulo · $n $unidade", 17f, Cor.BRANCO, false, true).apply { setPadding(0, dp(6), 0, 0) })
        if (troco > 0) {
            c.addView(texto("TROCO ${brl(troco)}", 34f, Cor.BRANCO, true, true).apply {
                background = fundo(0x33000000, 12); setPadding(dp(16), dp(10), dp(16), dp(10))
            }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(18) })
        }
        val entregue = "Entregue ${if (n == 1) "o impresso" else "os $n impressos"} ao cliente."
        c.addView(texto(if (offline) "Sem internet: a venda sobe sozinha quando a rede voltar.\n$entregue"
                        else entregue, 15f, Cor.BRANCO, false, true).apply { setPadding(0, dp(18), 0, dp(22)) })
        val proxima = botao("PRÓXIMA VENDA", Cor.BRANCO, cor, 18f, 58) {}
        c.addView(proxima, cheio())
        c.addView(texto("Imprimir de novo", 15f, Cor.BRANCO, false, true).apply {
            setPadding(0, dp(16), 0, dp(4))
            setOnClickListener { reimprimir() }
        })
        val tela = empilhar(c)
        proxima.setOnClickListener {
            raiz.removeView(tela)
            if (limparCarrinho) carrinho.clear()
            desenharGrade(); atualizarRodape(); atualizarCabecalho(); atualizarStatus()
        }
    }

    // ====================================================================
    //  ingresso na portaria
    // ====================================================================

    /** Aba "Ingresso": um cartão por tipo de ingresso, com o preço do lote ativo. */
    private fun desenharIngressos(g: LinearLayout) {
        g.addView(texto("Toque no ingresso para escolher quantas pessoas.", 13f, Cor.MUDO).apply {
            setPadding(dp(6), dp(2), dp(6), dp(8))
        })
        for (i in 0 until ingressos.length()) {
            val l = ingressos.getJSONObject(i)
            val cartao = linhaH().apply {
                background = fundo(Cor.CARTAO, 12, Cor.LINHA, 1)
                setPadding(dp(14), dp(16), dp(14), dp(16))
                setOnClickListener { telaIngresso(l) }
            }
            val t = coluna()
            t.addView(texto("Ingresso ${l.optString("tipo")}", 18f, Cor.TEXTO, true))
            val rest = if (l.isNull("restantes")) "" else " · restam ${l.optInt("restantes")}"
            t.addView(texto("${l.optString("lote")}$rest", 13f, Cor.MUDO))
            cartao.addView(t, peso())
            cartao.addView(texto(brl(l.optInt("preco")), 22f, Cor.TEXTO, true))
            g.addView(cartao, cheio().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        }
    }

    private fun telaIngresso(lote: JSONObject) {
        val preco = lote.optInt("preco")
        var qtd = 1
        val c = coluna()
        var janela: View? = null
        c.addView(texto("${lote.optString("lote")} · ${brl(preco)} por pessoa", 14f, Cor.MUDO, false, true))
        c.addView(texto("QUANTAS PESSOAS?", 12f, Cor.MUDO, true, true).apply { setPadding(0, dp(14), 0, dp(6)) })
        val vQtd = texto("1", 40f, Cor.TEXTO, true, true)
        val vTotal = texto(brl(preco), 22f, Cor.OK, true, true)
        val l = linhaH().apply { gravity = Gravity.CENTER }
        val menos = texto("−", 30f, Cor.TEXTO, true, true).apply { background = fundo(Cor.TELA, 12, Cor.LINHA, 1) }
        val mais = texto("+", 30f, Cor.TEXTO, true, true).apply { background = fundo(Cor.TELA, 12, Cor.LINHA, 1) }
        fun atualizar() { vQtd.text = qtd.toString(); vTotal.text = "Total ${brl(qtd * preco)}" }
        menos.setOnClickListener { if (qtd > 1) { qtd--; atualizar() } }
        mais.setOnClickListener { if (qtd < 20) { qtd++; atualizar() } }
        l.addView(menos, LinearLayout.LayoutParams(dp(64), dp(64)))
        l.addView(vQtd, LinearLayout.LayoutParams(dp(90), ViewGroup.LayoutParams.WRAP_CONTENT))
        l.addView(mais, LinearLayout.LayoutParams(dp(64), dp(64)))
        c.addView(l, cheio())
        c.addView(vTotal, cheio().apply { topMargin = dp(8); bottomMargin = dp(10) })
        atualizar()

        fun opcao(titulo: String, cor: Int, aoTocar: () -> Unit): View =
            texto(titulo, 17f, cor, true, true).apply {
                background = fundo(Cor.CARTAO, 12, cor, 2)
                setPadding(dp(6), dp(16), dp(6), dp(16))
                setOnClickListener { tirar(janela); aoTocar() }
            }
        fun noCartao(tipo: Int, meio: String, rotulo: String) {
            val total = qtd * preco
            val q = qtd
            cobrarNaMaquininha(tipo, meio, rotulo, total) { cid, codigo ->
                registrarIngresso(lote, q, meio, rotulo, cid, pagamentoExterno = codigo)
            }
        }
        val l1 = linhaH()
        l1.addView(opcao("Crédito", Cor.TEXTO) { noCartao(PlugPag.TYPE_CREDITO, "credito", "Crédito") }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        l1.addView(opcao("Débito", Cor.TEXTO) { noCartao(PlugPag.TYPE_DEBITO, "debito", "Débito") }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        c.addView(l1, cheio())
        val l2 = linhaH()
        l2.addView(opcao("Pix", Cor.TEXTO) { noCartao(PlugPag.TYPE_PIX, "pix", "Pix") }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        l2.addView(opcao("Dinheiro", Cor.OK) {
            val q = qtd
            telaTroco(q * preco) { recebido ->
                registrarIngresso(lote, q, "dinheiro", "Dinheiro", UUID.randomUUID().toString(), recebido = recebido)
            }
        }, peso().apply { setMargins(dp(4), dp(4), dp(4), dp(4)) })
        c.addView(l2, cheio())
        janela = folha("Ingresso ${lote.optString("tipo")}", c)
    }

    private fun tokenIngresso(): String {
        val b = ByteArray(16); sorteio.nextBytes(b)
        return b.joinToString("") { "%02x".format(it) }
    }

    /**
     * Registra a venda do ingresso. Sem internet, vai para a fila igual à venda
     * do bar: os QR nascem aqui e passam a valer na entrada assim que a venda
     * sobe — por isso a portaria precisa de rede para validar.
     */
    private fun registrarIngresso(lote: JSONObject, qtd: Int, meio: String, rotulo: String, clientUuid: String,
                                  recebido: Int? = null, pagamentoExterno: String? = null) {
        val total = qtd * lote.optInt("preco")
        val tokens = JSONArray().apply { repeat(qtd) { put(tokenIngresso()) } }
        val dados = JSONObject()
            .put("_fila_acao", "vender_ingresso")
            .put("client_uuid", clientUuid)
            .put("caixa_id", caixa?.optString("caixa_id"))
            .put("meio", meio)
            .put("batch_id", lote.optString("batch_id"))
            .put("qtd", qtd)
            .put("tokens", tokens)
            .put("vendido_em", agoraIso())
        if (recebido != null) dados.put("recebido_cents", recebido)
        if (pagamentoExterno != null) dados.put("pagamento_externo", pagamentoExterno)
        val troco = if (recebido != null) recebido - total else 0

        val veu = mostrarEspera("Registrando o ingresso…")
        rede.execute {
            try {
                val r = Api.chamar(local.token, "vender_ingresso", dados)
                online = true
                principal.post {
                    tirar(veu)
                    r.optJSONObject("caixa")?.let { caixa = it }
                    concluirIngresso(lote, tokens, total, rotulo, troco, false)
                }
                atualizarEstadoSilencioso()
            } catch (e: ErroApi) {
                if (e.semRede) {
                    online = false
                    dados.put("offline", true)
                    local.enfileirar(dados)
                    principal.post {
                        tirar(veu)
                        caixa?.let { cx ->
                            cx.put("vendido", cx.optInt("vendido") + total)
                            cx.put("vendas", cx.optInt("vendas") + 1)
                            if (meio == "dinheiro") {
                                cx.put("dinheiro", cx.optInt("dinheiro") + total)
                                cx.put("na_gaveta", cx.optInt("na_gaveta") + total)
                            }
                        }
                        concluirIngresso(lote, tokens, total, rotulo, troco, true)
                    }
                } else {
                    principal.post {
                        tirar(veu)
                        alerta("Ingresso não registrado",
                            (if (pagamentoExterno != null) "A cobrança foi APROVADA (código $pagamentoExterno), mas o sistema recusou:\n\n" else "") +
                            (e.message ?: "Erro") +
                            (if (pagamentoExterno != null) "\n\nChame um gestor antes de liberar a entrada." else ""))
                    }
                }
            } catch (e: Throwable) {
                principal.post { tirar(veu); alerta("Ingresso não registrado", e.message ?: e.javaClass.simpleName) }
            }
        }
    }

    private fun concluirIngresso(lote: JSONObject, tokens: JSONArray, total: Int, rotulo: String,
                                 troco: Int, offline: Boolean) {
        val quando = dataHoraBrasilia()
        val n = tokens.length()
        val imprimirTodos = {
            for (i in 0 until n) {
                val tk = tokens.getString(i)
                imprimirEmFundo({
                    Impressos.ingresso(local.nomeEvento, lote.optString("tipo"), lote.optString("lote"),
                        lote.optInt("preco"), rotulo, quando, tk, i + 1, n, offline)
                })
            }
        }
        imprimirTodos()
        telaConcluida(n, if (n == 1) "ingresso" else "ingressos", total, rotulo, troco, offline, imprimirTodos, false)
    }

    // ====================================================================
    //  meu caixa, sangria e fechamento
    // ====================================================================

    private fun meuCaixa() {
        val id = caixa?.optString("caixa_id") ?: return
        naRede("Buscando seu caixa…", {
            Api.chamar(local.token, "meu_caixa", JSONObject().put("caixa_id", id))
        }, { r -> caixa = r; atualizarCabecalho(); mostrarMeuCaixa(false) },
            { e -> if (e.semRede) mostrarMeuCaixa(true) else alerta("Não deu certo", e.message ?: "") })
    }

    private fun mostrarMeuCaixa(semInternet: Boolean) {
        val r = caixa ?: return
        val c = coluna()
        var janela: View? = null
        if (semInternet) {
            c.addView(texto("Sem internet: os números podem estar um pouco atrasados.", 13f, Cor.LARANJA).apply {
                setPadding(0, 0, 0, dp(8))
            })
        }
        c.addView(texto("VENDI ATÉ AGORA", 12f, Cor.MUDO, true, true))
        c.addView(texto(brl(r.optInt("vendido")), 34f, Cor.TEXTO, true, true))
        c.addView(texto("${r.optInt("vendas")} vendas · ${r.optInt("itens")} itens · desde ${horaBrasilia(r.optString("aberto_em"))}",
            13f, Cor.MUDO, false, true).apply { setPadding(0, 0, 0, dp(12)) })

        val meios = r.optJSONObject("meios") ?: JSONObject()
        val bm = coluna().apply { background = fundo(Cor.TELA, 12); setPadding(dp(12), dp(8), dp(12), dp(8)) }
        bm.addView(parValor("Crédito", brl(meios.optInt("credito"))))
        bm.addView(parValor("Débito", brl(meios.optInt("debito"))))
        bm.addView(parValor("Pix", brl(meios.optInt("pix"))))
        bm.addView(parValor("Dinheiro", brl(meios.optInt("dinheiro"))))
        val cort = r.optJSONObject("cortesias")
        if (cort != null && cort.optInt("quantidade") > 0) {
            bm.addView(parValor("Cortesias (${cort.optInt("quantidade")})", brl(cort.optInt("valor")), cor = Cor.LARANJA))
        }
        c.addView(bm, cheio())

        val bg = coluna().apply { background = fundo(0x1A1D7760, 12, 0x551D7760, 1); setPadding(dp(12), dp(8), dp(12), dp(8)) }
        bg.addView(parValor("Fundo de troco", brl(r.optInt("fundo"))))
        bg.addView(parValor("Recebido em dinheiro", brl(r.optInt("dinheiro"))))
        if (r.optInt("sangrado") > 0) bg.addView(parValor("Já entreguei", "− " + brl(r.optInt("sangrado"))))
        bg.addView(parValor("Está comigo agora", brl(r.optInt("na_gaveta")), true, Cor.OK, 16f))
        c.addView(bg, cheio().apply { topMargin = dp(10) })

        c.addView(botaoContorno("Entregar dinheiro ao gestor", Cor.AZUL) { tirar(janela); telaSangria() },
            cheio().apply { topMargin = dp(14) })
        c.addView(botaoContorno("Fechar meu caixa", Cor.VERMELHO) { tirar(janela); telaFechamento() },
            cheio().apply { topMargin = dp(8) })
        c.addView(botaoContorno("Passar a maquininha para outra pessoa", Cor.MUDO) { sair() },
            cheio().apply { topMargin = dp(8) })
        janela = folha("Meu caixa · ${primeiroNome(operadorNome)}", c)
    }

    private fun telaSangria() {
        val r = caixa ?: return
        val naGaveta = r.optInt("na_gaveta")
        val fundoTroco = r.optInt("fundo")
        val c = coluna()
        var janela: View? = null
        val info = coluna().apply { background = fundo(Cor.TELA, 12); setPadding(dp(12), dp(10), dp(12), dp(10)) }
        info.addView(texto("ESTÁ NA GAVETA", 12f, Cor.MUDO, true, true))
        info.addView(texto(brl(naGaveta), 28f, Cor.TEXTO, true, true))
        info.addView(texto("O fundo de ${brl(fundoTroco)} pode ficar para continuar dando troco.", 12f, Cor.MUDO, false, true))
        c.addView(info, cheio())
        val v = campo("Quanto está entregando, em reais", decimal = true)
        c.addView(v, cheio().apply { topMargin = dp(12) })
        c.addView(botao("CONFIRMAR COM O GESTOR", Cor.AZUL) {
            val valor = lerReais(v.text.toString())
            if (valor == null || valor <= 0) { aviso("Digite o valor"); return@botao }
            if (valor > naGaveta) { aviso("Maior do que está na gaveta"); return@botao }
            tirar(janela)
            pedirPin("Quem está recebendo?", "O PIN do gestor confirma o recebimento de ${brl(valor)}.", { pin, resposta ->
                naRede(null, {
                    Api.chamar(local.token, "sangria", JSONObject()
                        .put("caixa_id", r.optString("caixa_id")).put("valor_cents", valor).put("pin_gestor", pin))
                }, { s ->
                    resposta(null)
                    s.optJSONObject("caixa")?.let { caixa = it }
                    val quem = s.optString("recebido_por")
                    val hora = agoraBrasilia()
                    val fica = caixa?.optInt("na_gaveta") ?: 0
                    // Duas vias: uma fica com o operador, outra vai com o dinheiro.
                    imprimirEmFundo({ Impressos.reciboSangria(operadorNome, valor, hora, quem, fica, "VIA DO OPERADOR") }) {
                        imprimirEmFundo({ Impressos.reciboSangria(operadorNome, valor, hora, quem, fica, "VIA DO GESTOR") })
                    }
                    atualizarCabecalho()
                    alerta("Dinheiro entregue", "${brl(valor)} para $quem às $hora.\nNa gaveta agora: ${brl(fica)}.\n\nSaem dois recibos: um fica com você, o outro vai com o dinheiro.")
                }, { e -> resposta(if (e.semRede) "Sem internet — a entrega precisa ser registrada online" else e.message) })
            })
        }, cheio().apply { topMargin = dp(12) })
        janela = folha("Entregar dinheiro", c)
    }

    private fun telaFechamento() {
        val pend = local.pendentes()
        if (pend > 0) {
            enviarFila(silencioso = false) { resto ->
                if (resto > 0) alerta("Ainda há vendas sem internet",
                    "$resto venda(s) feitas sem internet ainda não subiram. Conecte a maquininha à internet antes de fechar o caixa — senão o fechamento sai errado.")
                else telaFechamento()
            }
            return
        }
        val id = caixa?.optString("caixa_id") ?: return
        naRede("Conferindo o caixa…", {
            Api.chamar(local.token, "meu_caixa", JSONObject().put("caixa_id", id))
        }, { r -> caixa = r; mostrarFechamento(r) })
    }

    private fun mostrarFechamento(r: JSONObject) {
        val esperado = r.optInt("na_gaveta")
        val c = coluna()
        var janela: View? = null
        val b = coluna().apply { background = fundo(Cor.TELA, 12); setPadding(dp(12), dp(8), dp(12), dp(8)) }
        b.addView(parValor("Fundo de troco", brl(r.optInt("fundo"))))
        b.addView(parValor("Vendas em dinheiro", brl(r.optInt("dinheiro"))))
        if (r.optInt("sangrado") > 0) b.addView(parValor("Já entregue durante a festa", "− " + brl(r.optInt("sangrado"))))
        b.addView(parValor("Deve estar na gaveta", brl(esperado), true, Cor.TEXTO, 16f))
        c.addView(b, cheio())
        c.addView(texto("CONTE AS CÉDULAS E DIGITE O QUE ESTÁ ENTREGANDO", 12f, Cor.MUDO, true).apply { setPadding(0, dp(14), 0, dp(6)) })
        val campoValor = campo("Valor contado, em reais", decimal = true)
        c.addView(campoValor, cheio())
        val dif = texto("", 16f, Cor.TEXTO, true, true).apply { setPadding(0, dp(10), 0, dp(10)) }
        c.addView(dif, cheio())
        var confirmando = false
        val fechar = botao("FECHAR E IMPRIMIR", Cor.DESLIGADO) {}
        fechar.isEnabled = false

        campoValor.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, a: Int, bb: Int, d: Int) {}
            override fun onTextChanged(s: CharSequence?, a: Int, bb: Int, d: Int) {}
            override fun afterTextChanged(s: Editable?) {
                confirmando = false
                val v = lerReais(s?.toString() ?: "")
                if (v == null) {
                    dif.text = ""; fechar.isEnabled = false; fechar.background = fundo(Cor.DESLIGADO, 10)
                    fechar.text = "FECHAR E IMPRIMIR"; return
                }
                val d = v - esperado
                when {
                    d == 0 -> { dif.text = "Caixa bateu certinho"; dif.setTextColor(Cor.OK) }
                    d > 0 -> { dif.text = "Sobrou ${brl(d)}"; dif.setTextColor(Cor.AZUL) }
                    else -> { dif.text = "Faltou ${brl(-d)}"; dif.setTextColor(Cor.VERMELHO) }
                }
                fechar.isEnabled = true; fechar.background = fundo(Cor.OK, 10); fechar.text = "FECHAR E IMPRIMIR"
            }
        })

        fechar.setOnClickListener {
            val v = lerReais(campoValor.text.toString()) ?: return@setOnClickListener
            // Fechar não tem volta: pede um segundo toque.
            if (!confirmando) {
                confirmando = true
                fechar.text = "TOQUE DE NOVO PARA CONFIRMAR"
                fechar.background = fundo(Cor.VERMELHO, 10)
                return@setOnClickListener
            }
            fechar.isEnabled = false
            tirar(janela)
            naRede("Fechando o caixa…", {
                Api.chamar(local.token, "fechar_caixa", JSONObject()
                    .put("caixa_id", r.optString("caixa_id")).put("entregue_cents", v))
            }, { fim ->
                val quando = dataHoraBrasilia()
                imprimirEmFundo({ Impressos.fechamento(local.nomeEvento, fim, quando) })
                telaCaixaFechado(fim)
            })
        }
        c.addView(fechar, cheio().apply { topMargin = dp(4) })
        c.addView(texto("Sai um relatório para colocar junto com o dinheiro.", 13f, Cor.MUDO, false, true).apply {
            setPadding(0, dp(10), 0, 0)
        })
        janela = folha("Fechar caixa · ${primeiroNome(operadorNome)}", c)
    }

    /**
     * Depois de fechar, esta tela SUBSTITUI a do caixa (não fica por cima dela):
     * assim nem o CONCLUIR nem o botão voltar levam de novo a um caixa que já
     * foi fechado.
     */
    private fun telaCaixaFechado(r: JSONObject) {
        caixa = null
        operadorId = null
        carrinho.clear()
        vGrade = null; vStatus = null
        val dif = r.optInt("entregue") - r.optInt("esperado")
        val c = coluna().apply {
            setBackgroundColor(Cor.CARVAO)
            gravity = Gravity.CENTER
            setPadding(dp(24), dp(24), dp(24), dp(24))
            isClickable = true
        }
        c.addView(texto("CAIXA FECHADO", 28f, Cor.BRANCO, true, true))
        c.addView(texto("Destaque o relatório e coloque junto com o dinheiro.", 16f, Cor.CLARO, false, true).apply {
            setPadding(0, dp(10), 0, dp(20))
        })
        val b = coluna().apply { background = fundo(0x14FFFFFF, 12); setPadding(dp(14), dp(10), dp(14), dp(10)) }
        b.addView(parValor("Total vendido", brl(r.optInt("vendido")), cor = Cor.BRANCO))
        b.addView(parValor("Deve entregar", brl(r.optInt("esperado")), cor = Cor.BRANCO))
        b.addView(parValor("Entregue", brl(r.optInt("entregue")), true, Cor.BRANCO))
        if (dif != 0) b.addView(parValor(if (dif > 0) "Sobra" else "Falta", brl(kotlin.math.abs(dif)), true,
            if (dif > 0) 0xFF8FC1EA.toInt() else 0xFFF09B91.toInt()))
        c.addView(b, cheio())
        c.addView(botao("CONCLUIR", Cor.BRANCO, Cor.CARVAO, 18f, 56) { sair() }, cheio().apply { topMargin = dp(24) })
        val reimprimir = texto("Imprimir o relatório de novo", 15f, Cor.CLARO, false, true).apply {
            setPadding(0, dp(28), 0, dp(4))
        }
        var confirmar = false
        reimprimir.setOnClickListener {
            if (!confirmar) { confirmar = true; reimprimir.text = "Toque de novo para imprimir outra via"; return@setOnClickListener }
            confirmar = false
            reimprimir.text = "Imprimir o relatório de novo"
            imprimirEmFundo({ Impressos.fechamento(local.nomeEvento, r, dataHoraBrasilia()) })
        }
        c.addView(reimprimir)
        tirarCamadas()
        base(c)
    }

    // ====================================================================
    //  gestão na maquininha
    // ====================================================================

    private fun abrirGestao() {
        pedirPin("Gestão", "PIN de gestor.", { pin, resposta ->
            naRede(null, {
                Api.chamar(local.token, "validar_gestor", JSONObject().put("pin_gestor", pin))
            }, { r ->
                resposta(null)
                telaGestao(pin, r.optString("nome"), r.optBoolean("gerencia_evento"))
            }, { e -> resposta(if (e.semRede) "Sem internet para conferir o PIN" else e.message) })
        })
    }

    private fun telaGestao(pin: String, nome: String, gerencia: Boolean) {
        val c = coluna()
        var janela: View? = null

        c.addView(texto("CADASTRAR QUEM CHEGOU", 12f, Cor.MUDO, true))
        val n = campo("Nome completo")
        val p = campo("PIN de 4 números", numerico = true, max = 4).apply {
            transformationMethod = PasswordTransformationMethod.getInstance()
        }
        c.addView(n, cheio().apply { topMargin = dp(6) })
        c.addView(p, cheio().apply { topMargin = dp(6) })
        c.addView(botao("Cadastrar operador", Cor.AZUL) {
            val nm = n.text.toString().trim()
            val pn = p.text.toString().trim()
            if (nm.length < 2) { aviso("Digite o nome"); return@botao }
            if (!Regex("^[0-9]{4}$").matches(pn)) { aviso("O PIN precisa ter 4 números"); return@botao }
            naRede("Cadastrando…", {
                Api.chamar(local.token, "cadastrar_operador", JSONObject().put("nome", nm).put("pin", pn).put("pin_gestor", pin))
            }, { _ ->
                n.setText(""); p.setText("")
                aviso("$nm cadastrado")
                atualizarEstadoSilencioso()
            })
        }, cheio().apply { topMargin = dp(8) })

        if (gerencia) {
            c.addView(botaoContorno("Repor estoque", Cor.AZUL) { tirar(janela); telaRepor(pin) },
                cheio().apply { topMargin = dp(18) })
        }
        c.addView(botaoContorno("Atualizar cardápio", Cor.AZUL) {
            tirar(janela); carregarEstado { if (vGrade != null) { desenharAbas(); desenharGrade(); atualizarRodape() } else telaOperadores() }
        }, cheio().apply { topMargin = dp(8) })

        val pend = local.pendentes()
        c.addView(texto(if (pend > 0) "$pend venda(s) esperando internet" else "Nenhuma venda esperando internet",
            14f, if (pend > 0) Cor.LARANJA else Cor.MUDO).apply { setPadding(0, dp(16), 0, dp(4)) })
        if (pend > 0) c.addView(botaoContorno("Enviar agora", Cor.LARANJA) { enviarFila(silencioso = false) }, cheio())
        val rec = local.recusadas().length()
        if (rec > 0) c.addView(texto("$rec venda(s) recusada(s) pelo sistema — confira no painel.", 13f, Cor.VERMELHO))

        c.addView(texto("ATIVAÇÃO DO PINPAD", 12f, Cor.MUDO, true).apply { setPadding(0, dp(18), 0, dp(4)) })
        c.addView(texto("Código atual: ${local.codigoAtivacao}. Só muda ao passar para produção.", 13f, Cor.MUDO))
        val cod = campo("Novo código de ativação", numerico = true, max = 10)
        c.addView(cod, cheio().apply { topMargin = dp(6) })
        c.addView(botaoContorno("Salvar código", Cor.MUDO) {
            val v = cod.text.toString().trim()
            if (v.length < 4) { aviso("Código inválido"); return@botaoContorno }
            local.codigoAtivacao = v; aviso("Código salvo"); cod.setText("")
        }, cheio().apply { topMargin = dp(6) })

        var confirmar = false
        val despar = botaoContorno("Desparear esta maquininha", Cor.VERMELHO) {}
        despar.setOnClickListener {
            if (!confirmar) { confirmar = true; despar.text = "Toque de novo para desparear"; return@setOnClickListener }
            if (local.pendentes() > 0) { aviso("Há vendas esperando internet. Envie antes."); return@setOnClickListener }
            local.desparear(); tirarCamadas(); telaParear()
        }
        c.addView(despar, cheio().apply { topMargin = dp(18) })

        janela = folha("Gestão · ${primeiroNome(nome)}", c)
    }

    private fun telaRepor(pin: String) {
        val c = coluna()
        for (i in 0 until produtos.length()) {
            val prod = produtos.getJSONObject(i)
            val l = linhaH().apply { setPadding(0, dp(6), 0, dp(6)) }
            val t = coluna()
            t.addView(texto(prod.optString("nome"), 14f, Cor.TEXTO, true))
            val vEst = texto("em estoque: ${prod.optInt("estoque")}", 12f, if (prod.optInt("estoque") <= 0) Cor.VERMELHO else Cor.MUDO)
            t.addView(vEst)
            l.addView(t, peso())
            val q = campo("qtd", numerico = true, max = 5)
            l.addView(q, LinearLayout.LayoutParams(dp(78), ViewGroup.LayoutParams.WRAP_CONTENT))
            l.addView(texto("Repor", 14f, Cor.AZUL, true, true).apply {
                setPadding(dp(12), dp(12), dp(6), dp(12))
                setOnClickListener {
                    val qtd = q.text.toString().trim().toIntOrNull()
                    if (qtd == null || qtd == 0) { aviso("Digite a quantidade"); return@setOnClickListener }
                    naRede("Repondo…", {
                        Api.chamar(local.token, "repor", JSONObject()
                            .put("product_id", prod.optString("id")).put("qtd", qtd).put("pin_gestor", pin))
                    }, { r ->
                        val novo = r.optInt("estoque")
                        prod.put("estoque", novo)
                        vEst.text = "em estoque: $novo"
                        vEst.setTextColor(if (novo <= 0) Cor.VERMELHO else Cor.MUDO)
                        q.setText("")
                        if (vGrade != null) desenharGrade()
                    })
                }
            })
            c.addView(l, cheio())
        }
        folha("Repor estoque", c)
    }
}
