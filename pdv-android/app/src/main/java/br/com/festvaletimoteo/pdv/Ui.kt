package br.com.festvaletimoteo.pdv

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.InputFilter
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** Paleta tirada da logo do Fest Vale: carvão no cromo, as quatro cores do "FEST". */
object Cor {
    val CARVAO = 0xFF2F3031.toInt()
    val CARVAO_2 = 0xFF3D3F41.toInt()
    val TELA = 0xFFF2F4F6.toInt()
    val CARTAO = 0xFFFFFFFF.toInt()
    val TEXTO = 0xFF1B1F23.toInt()
    val MUDO = 0xFF6B747D.toInt()
    val CLARO = 0xFFA8B0B6.toInt()
    val LINHA = 0xFFDDE3E9.toInt()
    val AZUL = 0xFF3084C5.toInt()
    val LARANJA = 0xFFE8921F.toInt()
    val VERDE = 0xFF46A049.toInt()
    val VERMELHO = 0xFFC0392B.toInt()
    val OK = 0xFF1D7760.toInt()
    val DESLIGADO = 0xFFB9C0C6.toInt()
    val BRANCO = 0xFFFFFFFF.toInt()
    val VEU = 0x99141618.toInt()
}

fun corDaCategoria(c: String): Int = when (c) {
    "Cervejas" -> Cor.LARANJA
    "Sem álcool" -> Cor.AZUL
    "Drinks" -> Cor.VERMELHO
    "Comida" -> Cor.VERDE
    else -> Cor.MUDO
}

// ----------------------------------------------------------------- formatos

fun brl(centavos: Int): String {
    val neg = centavos < 0
    val v = kotlin.math.abs(centavos.toLong())
    val reais = (v / 100).toString().reversed().chunked(3).joinToString(".").reversed()
    return (if (neg) "-" else "") + "R$ " + reais + "," + (v % 100).toString().padStart(2, '0')
}

/** Lê "125", "125,50", "125.5" e devolve centavos; null se não for número. */
fun lerReais(texto: String): Int? {
    val t = texto.trim().replace(".", "").replace(",", ".")
    if (t.isEmpty()) return null
    val n = t.toDoubleOrNull() ?: return null
    return Math.round(n * 100).toInt()
}

private val fusoBrasilia: TimeZone = TimeZone.getTimeZone("America/Sao_Paulo")

/** Hora no fuso de Brasília — o Ricardo pediu: nunca mostrar horário em UTC. */
fun agoraBrasilia(): String =
    SimpleDateFormat("HH:mm", Locale("pt", "BR")).apply { timeZone = fusoBrasilia }.format(Date())

fun dataHoraBrasilia(): String =
    SimpleDateFormat("dd/MM HH:mm", Locale("pt", "BR")).apply { timeZone = fusoBrasilia }.format(Date())

/** Momento da venda, para o banco guardar a hora real mesmo se a venda subir depois. */
fun agoraIso(): String =
    SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        .apply { timeZone = TimeZone.getTimeZone("UTC") }.format(Date())

/** Converte um horário vindo do banco para HH:mm de Brasília. Sem java.time: a P2-B é Android 7. */
fun horaBrasilia(iso: String?): String {
    if (iso.isNullOrBlank() || iso == "null" || iso.length < 19) return "—"
    return try {
        val base = iso.substring(0, 19)
        val m = Regex("([+-])(\\d{2}):?(\\d{2})$").find(iso)
        val entrada = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        entrada.timeZone = TimeZone.getTimeZone(
            if (m != null) "GMT${m.groupValues[1]}${m.groupValues[2]}:${m.groupValues[3]}" else "UTC")
        val d = entrada.parse(base) ?: return "—"
        SimpleDateFormat("HH:mm", Locale("pt", "BR")).apply { timeZone = fusoBrasilia }.format(d)
    } catch (e: Exception) {
        "—"
    }
}

fun iniciais(nome: String): String {
    val p = nome.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (p.isEmpty()) return "?"
    return (p[0].take(1) + (if (p.size > 1) p[1].take(1) else "")).uppercase()
}

fun primeiroNome(nome: String): String = nome.trim().split(Regex("\\s+")).firstOrNull() ?: nome

// ----------------------------------------------------------- construtores

fun Activity.dp(n: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, n.toFloat(), resources.displayMetrics).toInt()

fun Activity.fundo(cor: Int, raio: Int = 0, borda: Int? = null, larguraBorda: Int = 1): GradientDrawable =
    GradientDrawable().apply {
        setColor(cor)
        cornerRadius = dp(raio).toFloat()
        if (borda != null) setStroke(dp(larguraBorda), borda)
    }

fun Activity.texto(t: String, tamanho: Float = 15f, cor: Int = Cor.TEXTO,
                   negrito: Boolean = false, centro: Boolean = false): TextView =
    TextView(this).apply {
        text = t
        textSize = tamanho
        setTextColor(cor)
        if (negrito) typeface = Typeface.DEFAULT_BOLD
        if (centro) gravity = Gravity.CENTER
    }

fun Activity.botao(t: String, cor: Int = Cor.OK, corTexto: Int = Cor.BRANCO,
                   tamanho: Float = 16f, altura: Int = 52, aoTocar: () -> Unit): Button =
    Button(this).apply {
        text = t
        isAllCaps = false
        textSize = tamanho
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(corTexto)
        background = fundo(cor, 10)
        minHeight = dp(altura)
        setPadding(dp(12), 0, dp(12), 0)
        setOnClickListener { aoTocar() }
    }

/** Botão só com contorno, para ações secundárias. */
fun Activity.botaoContorno(t: String, cor: Int = Cor.AZUL, tamanho: Float = 15f, aoTocar: () -> Unit): Button =
    Button(this).apply {
        text = t
        isAllCaps = false
        textSize = tamanho
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(cor)
        background = fundo(Color.TRANSPARENT, 10, cor, 2)
        minHeight = dp(46)
        setOnClickListener { aoTocar() }
    }

fun Activity.campo(dica: String, numerico: Boolean = false, decimal: Boolean = false,
                   max: Int = 0, escuro: Boolean = false): EditText =
    EditText(this).apply {
        hint = dica
        textSize = 17f
        setSingleLine(true)
        inputType = when {
            decimal -> InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            numerico -> InputType.TYPE_CLASS_NUMBER
            else -> InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_WORDS
        }
        if (max > 0) filters = arrayOf(InputFilter.LengthFilter(max))
        setPadding(dp(12), dp(10), dp(12), dp(10))
        if (escuro) {
            setTextColor(Cor.BRANCO); setHintTextColor(Cor.CLARO)
            background = fundo(0x1FFFFFFF, 9, 0x33FFFFFF, 1)
        } else {
            setTextColor(Cor.TEXTO); setHintTextColor(Cor.MUDO)
            background = fundo(Cor.TELA, 9, Cor.LINHA, 1)
        }
    }

fun Activity.coluna(): LinearLayout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
fun Activity.linhaH(): LinearLayout = LinearLayout(this).apply {
    orientation = LinearLayout.HORIZONTAL
    gravity = Gravity.CENTER_VERTICAL
}

fun cheio(): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)

fun peso(p: Float = 1f): LinearLayout.LayoutParams =
    LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, p)

fun View.margem(a: Activity, cima: Int = 0, baixo: Int = 0, lados: Int = 0): View {
    val lp = (layoutParams as? ViewGroup.MarginLayoutParams) ?: cheio()
    lp.setMargins(a.dp(lados), a.dp(cima), a.dp(lados), a.dp(baixo))
    layoutParams = lp
    return this
}

/** Linha "rótulo ............ valor" usada nos resumos de caixa. */
fun Activity.parValor(rotulo: String, valor: String, forte: Boolean = false,
                      cor: Int = Cor.TEXTO, tamanho: Float = 15f): LinearLayout =
    linhaH().apply {
        addView(texto(rotulo, tamanho, if (forte) cor else Cor.MUDO, forte), peso())
        addView(texto(valor, tamanho + (if (forte) 2f else 0f), cor, true))
        setPadding(0, dp(3), 0, dp(3))
    }
