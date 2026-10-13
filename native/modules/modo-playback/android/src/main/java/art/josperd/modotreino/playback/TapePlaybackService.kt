package art.josperd.modotreino.playback

import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

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
    mediaSession = MediaSession.Builder(this, player).build()
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
}
