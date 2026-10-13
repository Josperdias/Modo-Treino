package art.josperd.modotreino.playback

import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
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
    exoPlayer = player
    mediaSession = MediaSession.Builder(this, player).build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

  // Mantemos o comportamento padrão: swipe nas recentes não encerra áudio em execução;
  // Android pode interromper por force-stop/otimizações de bateria, sem prometer imunidade.
  override fun onDestroy() {
    mediaSession?.release()
    mediaSession = null
    exoPlayer?.release()
    exoPlayer = null
    super.onDestroy()
  }
}
