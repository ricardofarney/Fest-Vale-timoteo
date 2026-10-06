package br.com.festvaletimoteo.pdv

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * O que a maquininha guarda nela mesma: o pareamento, o último cardápio que
 * conseguiu baixar (para não ficar sem cardápio se a internet cair) e a fila
 * de vendas feitas sem conexão.
 */
class Local(contexto: Context) {
    private val prefs = contexto.getSharedPreferences("pdv", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("token", null)
        set(v) { prefs.edit().putString("token", v).apply() }

    var nomeEvento: String
        get() = prefs.getString("evento", "") ?: ""
        set(v) { prefs.edit().putString("evento", v).apply() }

    /** Código de ativação do pinpad. 749879 é o do ambiente de testes do PagBank. */
    var codigoAtivacao: String
        get() = prefs.getString("ativacao", "749879") ?: "749879"
        set(v) { prefs.edit().putString("ativacao", v).apply() }

    var estadoEmCache: JSONObject?
        get() = prefs.getString("estado", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
        set(v) { prefs.edit().putString("estado", v?.toString()).apply() }

    // ------------------------------------------------------------------ fila

    @Synchronized
    fun fila(): JSONArray =
        prefs.getString("fila", null)?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()

    @Synchronized
    private fun gravarFila(a: JSONArray) {
        // commit, não apply: venda na fila não pode se perder se a bateria acabar.
        prefs.edit().putString("fila", a.toString()).commit()
    }

    @Synchronized
    fun enfileirar(venda: JSONObject) {
        val a = fila()
        a.put(venda)
        gravarFila(a)
    }

    @Synchronized
    fun pendentes(): Int = fila().length()

    /** Vendas que o banco recusou mesmo com internet — ficam guardadas para o gestor ver. */
    @Synchronized
    fun recusadas(): JSONArray =
        prefs.getString("recusadas", null)?.let { runCatching { JSONArray(it) }.getOrNull() } ?: JSONArray()

    /**
     * Tenta mandar a fila, na ordem em que as vendas aconteceram.
     * Para no primeiro erro de rede; uma venda recusada pelo banco sai da fila
     * e vai para "recusadas", para não travar as outras.
     * Devolve quantas ainda estão pendentes.
     */
    @Synchronized
    fun enviarFila(): Int {
        val tok = token ?: return pendentes()
        var a = fila()
        while (a.length() > 0) {
            val venda = a.getJSONObject(0)
            try {
                // Venda do bar ou ingresso da portaria: a ação vai junto na fila.
                Api.chamar(tok, venda.optString("_fila_acao", "vender"), venda)
            } catch (e: ErroApi) {
                if (e.semRede) break
                val r = recusadas()
                r.put(JSONObject().put("venda", venda).put("motivo", e.message ?: ""))
                prefs.edit().putString("recusadas", r.toString()).commit()
            }
            val resto = JSONArray()
            for (i in 1 until a.length()) resto.put(a.get(i))
            gravarFila(resto)
            a = resto
        }
        return a.length()
    }

    fun desparear() {
        prefs.edit().remove("token").remove("evento").remove("estado").apply()
    }
}
