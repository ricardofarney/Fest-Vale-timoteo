package br.com.festvaletimoteo.pdv

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Erro vindo do banco (mensagem já em português, pronta para a tela) ou da
 * falta de rede. A diferença importa: venda sem rede vai para a fila; venda
 * recusada pelo banco não.
 */
class ErroApi(mensagem: String, val semRede: Boolean = false) : Exception(mensagem)

/**
 * A maquininha fala com o banco por uma porta só: a função pdv_api.
 *
 * A chave abaixo é a pública do site — a mesma que qualquer navegador recebe.
 * Ela não dá acesso a nada sozinha: toda ação exige o token que a maquininha
 * ganha no pareamento, e o banco confere esse token antes de qualquer coisa.
 */
object Api {
    private const val ENDERECO = "https://dwynfydbtkwwppwblkbu.supabase.co/rest/v1/rpc/pdv_api"
    private const val CHAVE_PUBLICA = "sb_publishable_SyvYKquTkB6QIc8HsBRzKw_5pk0nTa-"

    /**
     * "Sem internet" com a causa técnica entre parênteses — foi assim que
     * descobrimos que o chip do PagBank não alcança o nosso servidor.
     */
    private fun semConexao(e: IOException): String =
        "Sem conexão com a internet (${e.javaClass.simpleName})"

    /** Chamada bloqueante: nunca usar na thread da tela. */
    fun chamar(token: String?, acao: String, dados: JSONObject = JSONObject()): JSONObject {
        val corpo = JSONObject()
            .put("_token", token ?: JSONObject.NULL)
            .put("_acao", acao)
            .put("_dados", dados)

        val conexao: HttpURLConnection
        try {
            conexao = URL(ENDERECO).openConnection() as HttpURLConnection
            conexao.requestMethod = "POST"
            conexao.connectTimeout = 8_000
            conexao.readTimeout = 20_000
            conexao.doOutput = true
            conexao.setRequestProperty("apikey", CHAVE_PUBLICA)
            conexao.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            conexao.setRequestProperty("Accept", "application/json")
            conexao.outputStream.use { it.write(corpo.toString().toByteArray(Charsets.UTF_8)) }
        } catch (e: IOException) {
            throw ErroApi(semConexao(e), semRede = true)
        }

        try {
            val codigo = conexao.responseCode
            val fluxo = if (codigo in 200..299) conexao.inputStream else conexao.errorStream
            val texto = fluxo?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""

            if (codigo in 200..299) {
                if (texto.isBlank() || texto == "null") return JSONObject()
                return JSONObject(texto)
            }
            // O banco devolve {"message": "..."} — é exatamente o que a tela mostra.
            val mensagem = try {
                JSONObject(texto).optString("message", "")
            } catch (e: Exception) {
                ""
            }
            if (codigo >= 500 && mensagem.isBlank()) {
                throw ErroApi("O servidor não respondeu. Tente de novo.", semRede = true)
            }
            throw ErroApi(if (mensagem.isBlank()) "Erro $codigo" else mensagem)
        } catch (e: IOException) {
            throw ErroApi(semConexao(e), semRede = true)
        } finally {
            conexao.disconnect()
        }
    }
}
