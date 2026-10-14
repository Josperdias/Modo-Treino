@file:OptIn(androidx.media3.common.util.UnstableApi::class)

package art.josperd.modotreino.playback

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * POC de reprodução nativa de UMA fila por serviço. Media3 controla a passagem de faixas
 * mesmo sem React montado; MediaSessionService mantém a sessão para fone/Bluetooth/Android.
 * Não há motor React tocando em paralelo nem alteração nas artes/fitas.
 */
class TapePlaybackService : MediaSessionService() {
  private var mediaSession: MediaSession? = null
  private var exoPlayer: ExoPlayer? = null
  private val main = Handler(Looper.getMainLooper())
  private var retries = 0
  private var favorite = false
  private var sleepVolume = 1f
  private var sleepEndAt = 0L
  private val sleepFade = object : Runnable {
    override fun run() {
      val p = exoPlayer ?: return
      val left = sleepEndAt - android.os.SystemClock.elapsedRealtime()
      if (left <= 0) { sleepEndAt = 0L; p.pause(); p.volume = sleepVolume; return }
      if (left <= FADE_MS) p.volume = sleepVolume * (left.toFloat() / FADE_MS)
      main.postDelayed(this, 400)
    }
  }

  /** Dormir: no fim do tempo a música some devagar (8 s) e pausa; o volume volta ao que era para a próxima vez. 0 cancela. */
  private fun setSleep(ms: Long) {
    val p = exoPlayer ?: return
    main.removeCallbacks(sleepFade)
    if (sleepEndAt != 0L) p.volume = sleepVolume   // cancelou no meio do fade: devolve o volume
    sleepEndAt = 0L
    if (ms <= 0) return
    sleepVolume = p.volume
    sleepEndAt = android.os.SystemClock.elapsedRealtime() + ms
    main.postDelayed(sleepFade, 400)
  }

  /** Botão ♥ do player do sistema (notificação e tela de bloqueio). Ele só avisa o app; quem guarda na bag Favoritas é o JavaScript. */
  private fun favButton(on: Boolean): CommandButton =
    CommandButton.Builder(if (on) CommandButton.ICON_HEART_FILLED else CommandButton.ICON_HEART_UNFILLED)
      .setDisplayName(if (on) "Tirar das favoritas" else "Favoritar")
      .setSessionCommand(SessionCommand(ACTION_FAV, Bundle.EMPTY))
      .build()

  private inner class Callback : MediaSession.Callback {
    override fun onConnect(session: MediaSession, controller: MediaSession.ControllerInfo): MediaSession.ConnectionResult {
      val commands = MediaSession.ConnectionResult.DEFAULT_SESSION_COMMANDS.buildUpon()
        .add(SessionCommand(ACTION_FAV, Bundle.EMPTY))
        .add(SessionCommand(ACTION_FAV_STATE, Bundle.EMPTY))
        .add(SessionCommand(ACTION_SLEEP, Bundle.EMPTY))
        .build()
      return MediaSession.ConnectionResult.AcceptedResultBuilder(session)
        .setAvailableSessionCommands(commands)
        .setCustomLayout(ImmutableList.of(favButton(favorite)))
        .build()
    }

    override fun onCustomCommand(session: MediaSession, controller: MediaSession.ControllerInfo, customCommand: SessionCommand, args: Bundle): ListenableFuture<SessionResult> {
      when (customCommand.customAction) {
        ACTION_FAV -> PlaybackBus.emit("fav")
        ACTION_SLEEP -> setSleep(args.getLong("ms", 0L))
        ACTION_FAV_STATE -> {
          favorite = args.getBoolean("on", false)
          session.setCustomLayout(ImmutableList.of(favButton(favorite)))
        }
      }
      return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
    }
  }

  /** Arquivo apagado/ilegível: pula para a próxima fita em vez de travar a fila com a tela bloqueada.
   * Rádio (http/https) que cai: tenta reconectar até 3 vezes (2 s, 4 s, 6 s); só então segue para a próxima, se houver. */
  private fun recover(player: ExoPlayer) {
    val scheme = player.currentMediaItem?.localConfiguration?.uri?.scheme
    val live = scheme == "http" || scheme == "https"
    if (live && retries < 3) {
      retries++
      main.postDelayed({ if (exoPlayer === player) player.prepare() }, 2000L * retries)
    } else if (player.hasNextMediaItem()) {
      retries = 0
      player.seekToNextMediaItem()
      player.prepare()
    }
  }

  override fun onCreate() {
    super.onCreate()
    val attributes = AudioAttributes.Builder()
      .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
      .setUsage(C.USAGE_MEDIA)
      .build()
    val player = ExoPlayer.Builder(this)
      // Rádio por internet com a tela apagada precisa também do Wi-Fi acordado (WAKE_MODE_NETWORK inclui o wake lock de CPU).
      .setWakeMode(C.WAKE_MODE_NETWORK)
      .build()
    player.setAudioAttributes(attributes, true) // Android gerencia audio focus e becoming noisy.
    player.setHandleAudioBecomingNoisy(true)
    player.addListener(object : Player.Listener {
      override fun onPlayerError(error: PlaybackException) { recover(player) }
      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) { retries = 0 }
      override fun onPlaybackStateChanged(playbackState: Int) { if (playbackState == Player.STATE_READY) retries = 0 }
    })
    exoPlayer = player
    mediaSession = MediaSession.Builder(this, player)
      .setCallback(Callback())
      .setBitmapLoader(CapaLoader(this))   // a capa é a fita do app, não um ícone genérico
      .build()
    // Ícone pequeno da notificação: o cassete do app (se o módulo de notificações estiver no APK).
    val provider = DefaultMediaNotificationProvider(this)
    val small = resources.getIdentifier("ic_stat_tape", "drawable", packageName)
    if (small != 0) provider.setSmallIcon(small)
    setMediaNotificationProvider(provider)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

  // Mantemos o comportamento padrão: swipe nas recentes não encerra áudio em execução;
  // Android pode interromper por force-stop/otimizações de bateria, sem prometer imunidade.
  override fun onDestroy() {
    main.removeCallbacksAndMessages(null)
    mediaSession?.release()
    mediaSession = null
    exoPlayer?.release()
    exoPlayer = null
    super.onDestroy()
  }

  companion object {
    const val ACTION_FAV = "mt_fav"
    const val ACTION_FAV_STATE = "mt_fav_state"
    const val ACTION_SLEEP = "mt_sleep"
    private const val FADE_MS = 8000L
  }
}
