package art.josperd.modotreino.playback

import android.content.ComponentName
import android.os.Looper
import android.os.Handler
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.FutureCallback
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Ponte EXPERIMENTAL. O serviço é o único proprietário do ExoPlayer.
 * Nenhum áudio é iniciado automaticamente ao importar este módulo.
 */
class ModoPlaybackModule : Module() {
  private val context get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val main = Handler(Looper.getMainLooper())
  private var pending: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null
  private var disposed = false
  private val listener = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      if (!disposed) sendEvent("onState", snapshot(player))
    }
  }

  private fun snapshot(player: Player): Map<String, Any?> = mapOf(
    "mediaId" to player.currentMediaItem?.mediaId,
    "title" to player.currentMediaItem?.mediaMetadata?.title?.toString(),
    "artist" to player.currentMediaItem?.mediaMetadata?.artist?.toString(),
    "uri" to player.currentMediaItem?.localConfiguration?.uri?.toString(),
    "index" to player.currentMediaItemIndex.coerceAtLeast(0),
    "playing" to player.isPlaying,
    "playWhenReady" to player.playWhenReady,
    "status" to player.playbackState,
    "positionMs" to player.currentPosition.coerceAtLeast(0L),
    "durationMs" to (if (player.duration == C.TIME_UNSET) 0L else player.duration.coerceAtLeast(0L)),
    "count" to player.mediaItemCount,
    "repeat" to (player.repeatMode == Player.REPEAT_MODE_ALL),
    "shuffle" to player.shuffleModeEnabled,
    "rate" to player.playbackParameters.speed,
    "volume" to player.volume,
    // Título que a própria rádio transmite (ICY "StreamTitle"): o ExoPlayer o põe em mediaMetadata por cima do nome da estação.
    "streamTitle" to player.mediaMetadata.title?.toString()?.takeIf { it.isNotBlank() && it != player.currentMediaItem?.mediaMetadata?.title?.toString() }
  )

  /** `art`: índice 0–7 da cor da fita, ou "radio". Vira `capa://N`, que o CapaLoader do serviço transforma na imagem do app. */
  private fun capaUri(art: Any?): android.net.Uri? = when (art) {
    is Number -> android.net.Uri.parse("capa://${art.toInt().coerceIn(0, 7)}")
    is String -> if (art == "radio") android.net.Uri.parse("capa://radio") else null
    else -> null
  }

  private fun withPlayer(promise: Promise, command: (MediaController) -> Unit) {
    main.post {
      if (disposed) { promise.reject("E_DISPOSED", "O módulo foi destruído", null); return@post }
      var ready = controller
      if (ready != null && !ready.isConnected) {
        // O serviço foi encerrado (notificação dispensada, "limpar tudo", otimização de bateria):
        // descarta o controlador velho e reconecta, senão os botões ficariam mudos até reiniciar o app.
        ready.removeListener(listener)
        val stale = pending
        if (stale != null) MediaController.releaseFuture(stale) else ready.release()
        controller = null
        pending = null
        ready = null
      }
      if (ready != null) {
        try { command(ready); promise.resolve(snapshot(ready)) }
        catch (error: Exception) { promise.reject("E_PLAYBACK", error.message ?: "Falha no player", error) }
        return@post
      }
      val future = pending ?: MediaController.Builder(
        context,
        SessionToken(context, ComponentName(context, TapePlaybackService::class.java))
      ).buildAsync().also { pending = it }
      Futures.addCallback(future, object : FutureCallback<MediaController> {
        override fun onSuccess(result: MediaController) {
          main.post {
            if (disposed) { MediaController.releaseFuture(future); return@post }
            if (controller == null) { controller = result; result.addListener(listener) }
            try { command(result); promise.resolve(snapshot(result)) }
            catch (error: Exception) { promise.reject("E_PLAYBACK", error.message ?: "Falha no player", error) }
          }
        }
        override fun onFailure(error: Throwable) {
          main.post {
            pending = null
            promise.reject("E_CONNECT", error.message ?: "Sem MediaSession nativa", error)
          }
        }
      }, MoreExecutors.directExecutor())
    }
  }

  override fun definition() = ModuleDefinition {
    Name("ModoPlayback")
    Events("onState", "onAction")

    OnCreate { PlaybackBus.listener = { action -> sendEvent("onAction", mapOf("action" to action)) } }

    OnDestroy {
      PlaybackBus.listener = null
      disposed = true
      main.post {
        controller?.removeListener(listener)
        pending?.let { MediaController.releaseFuture(it) }
        controller = null
        pending = null
      }
    }

    AsyncFunction("loadQueue") { items: List<Map<String, Any?>>, index: Int, autoplay: Boolean, promise: Promise ->
      // Segurança: uma fila vazia ou URL vazia não inicia uma sessão indevidamente.
      if (items.isEmpty() || items.size > 10000) {
        promise.reject("E_QUEUE", "Fila inválida ou vazia", null)
      } else if (index !in items.indices) {
        promise.reject("E_INDEX", "Índice fora da fila", null)
      } else {
        try {
          val prepared = items.map { item ->
            val id = (item["id"] as? String)?.takeIf { it.isNotBlank() }
              ?: throw IllegalArgumentException("Fita sem ID")
            val uri = (item["uri"] as? String)?.takeIf { it.startsWith("content://") || it.startsWith("file://") || it.startsWith("https://") || it.startsWith("http://") }
              ?: throw IllegalArgumentException("URI de fita inválida")
            val source = item["source"] as? String ?: "file"
            val metadata = MediaMetadata.Builder()
              .setTitle((item["title"] as? String).orEmpty().take(160))
              .setArtist((item["artist"] as? String).orEmpty().take(160))
              .apply { capaUri(item["art"])?.let { setArtworkUri(it) } }
              .build()
            val builder = MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata)
            if (source == "radio" && uri.substringBefore('?').endsWith(".m3u8", true))
              builder.setMimeType(MimeTypes.APPLICATION_M3U8)
            builder.build()
          }
          withPlayer(promise) { player ->
            // Não deixar o canal JS tocando: essa obrigação cabe ao ADAPTADOR antes do opt-in.
            player.setMediaItems(prepared, index, 0L)
            player.prepare()
            player.playWhenReady = autoplay
          }
        } catch (error: Exception) { promise.reject("E_QUEUE", error.message ?: "Fila inválida", error) }
      }
    }
    // "Tocar a seguir" sem reiniciar o ExoPlayer nem reposicionar a música atual.
    // Uma cópia futura do mesmo ID é movida, nunca duplica arquivos ou altera bags.
    AsyncFunction("insertNext") { item: Map<String, Any?>, promise: Promise ->
      val id = (item["id"] as? String)?.takeIf { it.isNotBlank() }
      val uri = (item["uri"] as? String)?.takeIf {
        it.startsWith("content://") || it.startsWith("file://") || it.startsWith("https://") || it.startsWith("http://")
      }
      if (id == null || uri == null) {
        promise.reject("E_ITEM", "Fita sem ID ou URI permitida", null)
      } else {
        val metadata = MediaMetadata.Builder()
          .setTitle((item["title"] as? String).orEmpty().take(160))
          .setArtist((item["artist"] as? String).orEmpty().take(160))
          .apply { capaUri(item["art"])?.let { setArtworkUri(it) } }
          .build()
        val upcoming = MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata).build()
        withPlayer(promise) { player ->
          val current = player.currentMediaItemIndex
          if (player.mediaItemCount == 0 || current !in 0 until player.mediaItemCount) {
            throw IllegalStateException("Nenhuma música está selecionada")
          }
          for (i in player.mediaItemCount - 1 downTo 0) {
            if (i != player.currentMediaItemIndex && player.getMediaItemAt(i).mediaId == id) player.removeMediaItem(i)
          }
          player.addMediaItem((player.currentMediaItemIndex + 1).coerceAtMost(player.mediaItemCount), upcoming)
        }
      }
    }
    AsyncFunction("play") { promise: Promise -> withPlayer(promise) { it.play() } }
    AsyncFunction("pause") { promise: Promise -> withPlayer(promise) { it.pause() } }
    AsyncFunction("next") { promise: Promise -> withPlayer(promise) { it.seekToNextMediaItem() } }
    AsyncFunction("previous") { promise: Promise -> withPlayer(promise) { it.seekToPreviousMediaItem() } }
    AsyncFunction("seekTo") { millis: Double, promise: Promise ->
      if (!millis.isFinite() || millis < 0) promise.reject("E_POSITION", "Posição inválida", null)
      else withPlayer(promise) { it.seekTo(millis.toLong()) }
    }
    AsyncFunction("setRepeat") { repeat: Boolean, promise: Promise ->
      withPlayer(promise) { it.repeatMode = if (repeat) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF }
    }
    AsyncFunction("setShuffle") { shuffle: Boolean, promise: Promise ->
      withPlayer(promise) { it.shuffleModeEnabled = shuffle }
    }
    AsyncFunction("setVolume") { volume: Double, promise: Promise ->
      withPlayer(promise) { it.volume = volume.toFloat().coerceIn(0f, 1f) }
    }
    AsyncFunction("setRate") { rate: Double, promise: Promise ->
      withPlayer(promise) { it.setPlaybackSpeed(rate.toFloat().coerceIn(0.5f, 2f)) }
    }
    // Estilo da notificação de música: "card" (cartão ilustrado, padrão) ou "system" (player do Android com barra arrastável).
    AsyncFunction("setNotificationStyle") { style: String ->
      val value = if (style == "system" || style == "full") style else "card"
      context.getSharedPreferences(TapePlaybackService.PREFS, android.content.Context.MODE_PRIVATE).edit().putString(TapePlaybackService.KEY_STYLE, value).apply()
      // Com o serviço já de pé, ele refaz a notificação na hora; sem serviço, vale na próxima música (não liga o player só por isso).
      main.post {
        val c = controller
        if (c != null && c.isConnected) c.sendCustomCommand(androidx.media3.session.SessionCommand(TapePlaybackService.ACTION_STYLE, android.os.Bundle.EMPTY), android.os.Bundle().apply { putString("style", value) })
      }
      value
    }
    // Capa do álbum que vem DENTRO do arquivo de música (tag ID3/MP4): salva uma cópia no cache e devolve o caminho; null se a música não tem capa.
    AsyncFunction("extractCover") { uri: String ->
      val retriever = android.media.MediaMetadataRetriever()
      try {
        val parsed = android.net.Uri.parse(uri)
        if (parsed.scheme == null || parsed.scheme == "file") retriever.setDataSource(parsed.path ?: uri) else retriever.setDataSource(context, parsed)
        val bytes = retriever.embeddedPicture
        if (bytes == null || bytes.isEmpty()) {
          null
        } else {
          val dir = java.io.File(context.cacheDir, "capas-extraidas").apply { mkdirs() }
          val file = java.io.File(dir, Integer.toHexString(uri.hashCode()) + "-" + bytes.size + ".img")
          if (!file.exists()) file.writeBytes(bytes)
          "file://" + file.absolutePath
        }
      } catch (e: Exception) {
        null
      } finally {
        try { retriever.release() } catch (e: Exception) { /* já liberado */ }
      }
    }
    AsyncFunction("getNotificationStyle") {
      context.getSharedPreferences(TapePlaybackService.PREFS, android.content.Context.MODE_PRIVATE).getString(TapePlaybackService.KEY_STYLE, "card") ?: "card"
    }

    // Timer para dormir no próprio serviço: continua valendo com o app em segundo plano (o do JavaScript pode ser suspenso pelo Android). 0 = cancelar.
    AsyncFunction("setSleepTimer") { minutes: Int, promise: Promise ->
      withPlayer(promise) {
        it.sendCustomCommand(androidx.media3.session.SessionCommand(TapePlaybackService.ACTION_SLEEP, android.os.Bundle.EMPTY), android.os.Bundle().apply { putLong("ms", minutes.coerceIn(0, 720) * 60_000L) })
      }
    }

    // ♥ do player do sistema: o JS diz se a música atual está nas favoritas e o serviço troca o ícone (cheio/vazio).
    AsyncFunction("setFavorite") { on: Boolean, promise: Promise ->
      withPlayer(promise) {
        it.sendCustomCommand(androidx.media3.session.SessionCommand(TapePlaybackService.ACTION_FAV_STATE, android.os.Bundle.EMPTY), android.os.Bundle().apply { putBoolean("on", on) })
      }
    }
    AsyncFunction("getState") { promise: Promise -> withPlayer(promise) {} }
    // Limpa a fila, mas não apaga arquivos do celular; o serviço decide quando encerrar.
    AsyncFunction("clear") { promise: Promise -> withPlayer(promise) { it.stop(); it.clearMediaItems() } }
  }
}
