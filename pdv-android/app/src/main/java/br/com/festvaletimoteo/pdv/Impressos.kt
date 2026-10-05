package br.com.festvaletimoteo.pdv

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import org.json.JSONArray
import org.json.JSONObject

/**
 * Papel que sai da impressora: ficha de retirada, recibo de entrega de dinheiro
 * e relatório de fechamento. Tudo é desenhado numa imagem de 384 pontos — a
 * largura da bobina de 58 mm — e mandado para a impressora do terminal.
 */
private class Papel {
    private val largura = 384
    private val margem = 14f
    private val itens = mutableListOf<Pair<Float, (Canvas, Float) -> Unit>>()

    private fun pincel(tamanho: Float, negrito: Boolean = false) = Paint().apply {
        color = Color.BLACK
        isAntiAlias = true
        textSize = tamanho
        typeface = if (negrito) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }

    fun centro(texto: String, tamanho: Float = 22f, negrito: Boolean = false) {
        val p = pincel(tamanho, negrito)
        for (l in quebrar(texto, p, largura - 2 * margem)) {
            itens += (tamanho + 8f) to { c, y ->
                c.drawText(l, (largura - p.measureText(l)) / 2f, y + tamanho, p)
            }
        }
    }

    fun texto(texto: String, tamanho: Float = 20f, negrito: Boolean = false) {
        val p = pincel(tamanho, negrito)
        for (l in quebrar(texto, p, largura - 2 * margem)) {
            itens += (tamanho + 7f) to { c, y -> c.drawText(l, margem, y + tamanho, p) }
        }
    }

    /** Texto à esquerda (quebra se for longo) e valor alinhado à direita na 1ª linha. */
    fun linha(esquerda: String, direita: String, tamanho: Float = 20f, negrito: Boolean = false) {
        val p = pincel(tamanho, negrito)
        val larguraDir = p.measureText(direita)
        val linhas = quebrar(esquerda, p, largura - 2 * margem - larguraDir - 12f)
        linhas.forEachIndexed { i, l ->
            itens += (tamanho + 7f) to { c, y ->
                c.drawText(l, margem, y + tamanho, p)
                if (i == 0) c.drawText(direita, largura - margem - larguraDir, y + tamanho, p)
            }
        }
    }

    fun tracejado() {
        val p = Paint().apply { color = Color.BLACK; strokeWidth = 2f }
        itens += 16f to { c, y ->
            var x = margem
            while (x < largura - margem) {
                c.drawLine(x, y + 8f, minOf(x + 8f, largura - margem), y + 8f, p)
                x += 14f
            }
        }
    }

    fun espaco(altura: Float) { itens += altura to { _, _ -> } }

    fun assinatura(rotulo: String) {
        texto(rotulo, 18f)
        espaco(26f)
        val p = Paint().apply { color = Color.BLACK; strokeWidth = 2f }
        itens += 12f to { c, y -> c.drawLine(margem, y + 4f, largura - margem, y + 4f, p) }
    }

    fun qr(conteudo: String, tamanho: Int = 220) {
        val matriz = QRCodeWriter().encode(
            conteudo, BarcodeFormat.QR_CODE, tamanho, tamanho,
            mapOf(EncodeHintType.MARGIN to 1),
        )
        val img = Bitmap.createBitmap(tamanho, tamanho, Bitmap.Config.ARGB_8888)
        for (x in 0 until tamanho) for (y in 0 until tamanho) {
            img.setPixel(x, y, if (matriz.get(x, y)) Color.BLACK else Color.WHITE)
        }
        itens += (tamanho + 8f) to { c, y -> c.drawBitmap(img, (largura - tamanho) / 2f, y + 4f, null) }
    }

    fun desenhar(): Bitmap {
        val altura = (itens.sumOf { it.first.toDouble() } + 30).toInt()
        val bmp = Bitmap.createBitmap(largura, altura, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(Color.WHITE)
        var y = 10f
        for ((h, d) in itens) { d(c, y); y += h }
        return bmp
    }

    private fun quebrar(texto: String, p: Paint, max: Float): List<String> {
        val saida = mutableListOf<String>()
        var atual = ""
        for (palavra in texto.split(" ")) {
            val tentativa = if (atual.isEmpty()) palavra else "$atual $palavra"
            if (p.measureText(tentativa) <= max || atual.isEmpty()) atual = tentativa
            else { saida += atual; atual = palavra }
        }
        if (atual.isNotEmpty()) saida += atual
        return saida.ifEmpty { listOf("") }
    }
}

object Impressos {

    /**
     * Ficha de retirada. Vai para a mão do cliente e é lida pela barraca.
     * NÃO leva o nome do operador — decisão do Ricardo.
     * O QR carrega só o token, que é o que a tela de retirada lê.
     */
    fun ficha(evento: String, itens: JSONArray, total: Int, meio: String,
              quando: String, token: String, troco: Int, offline: Boolean): Bitmap {
        val p = Papel()
        p.centro("FEST VALE", 30f, true)
        p.centro("FICHA DE RETIRADA", 20f, true)
        if (evento.isNotBlank()) p.centro(evento, 16f)
        p.tracejado()
        for (i in 0 until itens.length()) {
            val it = itens.getJSONObject(i)
            val q = it.optInt("qtd")
            p.linha("${q}x ${it.optString("nome")}", brl(q * it.optInt("preco")), 22f, true)
        }
        p.tracejado()
        p.linha("TOTAL", brl(total), 24f, true)
        p.linha(meio, quando, 18f)
        if (troco > 0) p.linha("Troco", brl(troco), 18f)
        p.espaco(6f)
        p.qr(token)
        p.centro(token.uppercase(), 18f, true)
        if (offline) p.centro("(registrada sem internet)", 15f)
        p.espaco(10f)
        p.centro("Apresente esta ficha na barraca", 16f)
        return p.desenhar()
    }

    /** Recibo de entrega de dinheiro no meio da festa — sai em duas vias. */
    fun reciboSangria(operador: String, valor: Int, quando: String,
                      recebidoPor: String, naGaveta: Int, via: String): Bitmap {
        val p = Papel()
        p.centro("FEST VALE", 28f, true)
        p.centro("ENTREGA DE DINHEIRO", 20f, true)
        p.centro(via, 16f)
        p.tracejado()
        p.linha("Operador", operador, 20f)
        p.linha("Recebido por", recebidoPor, 20f)
        p.linha("Hora", quando, 20f)
        p.tracejado()
        p.linha("ENTREGUE", brl(valor), 26f, true)
        p.linha("Fica na gaveta", brl(naGaveta), 18f)
        p.espaco(12f)
        p.assinatura("Assinatura de quem recebeu")
        p.espaco(8f)
        p.assinatura("Assinatura do operador")
        return p.desenhar()
    }

    /**
     * Relatório de fechamento. Vai DENTRO do envelope com o dinheiro, para o
     * financeiro conferir depois, com calma.
     */
    fun fechamento(evento: String, r: JSONObject, quando: String): Bitmap {
        val p = Papel()
        val meios = r.optJSONObject("meios") ?: JSONObject()
        val cort = r.optJSONObject("cortesias") ?: JSONObject()
        val esperado = r.optInt("esperado")
        val entregue = r.optInt("entregue")
        val dif = entregue - esperado

        p.centro("FEST VALE", 30f, true)
        p.centro("FECHAMENTO DE CAIXA", 20f, true)
        if (evento.isNotBlank()) p.centro(evento, 16f)
        p.tracejado()
        p.linha("Operador", r.optJSONObject("operador")?.optString("nome") ?: "", 20f, true)
        p.linha("Abertura", horaBrasilia(r.optString("aberto_em")), 20f)
        p.linha("Fechamento", quando, 20f)
        p.tracejado()
        p.texto("VENDAS", 20f, true)
        p.linha("Crédito", brl(meios.optInt("credito")), 20f)
        p.linha("Débito", brl(meios.optInt("debito")), 20f)
        p.linha("Pix", brl(meios.optInt("pix")), 20f)
        p.linha("Dinheiro", brl(meios.optInt("dinheiro")), 20f)
        if (cort.optInt("quantidade") > 0) {
            p.linha("Cortesias (${cort.optInt("quantidade")})", brl(cort.optInt("valor")), 18f)
        }
        p.linha("Total vendido", brl(r.optInt("vendido")), 22f, true)
        p.linha("Vendas / itens", "${r.optInt("vendas")} / ${r.optInt("itens")}", 18f)
        p.tracejado()
        p.texto("DINHEIRO", 20f, true)
        p.linha("Fundo de troco", brl(r.optInt("fundo")), 20f)
        p.linha("Vendas em dinheiro", brl(r.optInt("dinheiro")), 20f)
        val sangrias = r.optJSONArray("sangrias") ?: JSONArray()
        for (i in 0 until sangrias.length()) {
            val s = sangrias.getJSONObject(i)
            p.linha("Entregue às ${horaBrasilia(s.optString("em"))}", "- " + brl(s.optInt("valor")), 18f)
        }
        p.linha("Deve entregar", brl(esperado), 22f, true)
        p.linha("Entregue", brl(entregue), 22f, true)
        p.linha(
            when { dif == 0 -> "Diferença"; dif > 0 -> "SOBRA"; else -> "FALTA" },
            brl(kotlin.math.abs(dif)), 22f, dif != 0,
        )
        p.espaco(14f)
        p.assinatura("Assinatura do operador")
        p.espaco(8f)
        p.assinatura("Conferido por")
        p.espaco(8f)
        p.qr("FECH:" + r.optString("caixa_id"), 160)
        return p.desenhar()
    }
}
