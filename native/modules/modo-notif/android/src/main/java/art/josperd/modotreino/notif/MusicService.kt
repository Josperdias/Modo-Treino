package art.josperd.modotreino.notif

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder

/** Serviço em primeiro plano do player: mantém a música viva com o app em segundo plano, mostra o cartão e escuta os botões do fone/Bluetooth. */
class MusicService : Service() {
  private var session: MediaSession? = null
  private var foreground = false

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    Cards.ensureChannels(this)
    try {
      session = MediaSession(this, "ModoTreino").also { s ->
        @Suppress("DEPRECATION")
        s.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS or MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS)
        s.setCallback(object : MediaSession.Callback() {
          override fun onPlay() { Bus.dispatch("music", "play") }
          override fun onPause() { Bus.dispatch("music", "pause") }
          override fun onSkipToNext() { Bus.dispatch("music", "next") }
          override fun onSkipToPrevious() { Bus.dispatch("music", "prev") }
          override fun onStop() { Bus.dispatch("music", "close") }
          // Permite que controladores de mídia do Android solicitem a nova posição.
          // Não altera o layout artístico da notificação RemoteViews.
          override fun onSeekTo(pos: Long) { Bus.dispatch("music", "seek:${pos.coerceAtLeast(0L)}") }
        })
      }
    } catch (e: Exception) { session = null } // fone/Bluetooth são um extra: sem eles o cartão continua
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val s = Store.music
    if (intent?.action == ACTION_STOP || s == null) {
      shutdown()
      return START_NOT_STICKY
    }
    val n = try { CardBuilder.music(this, s) } catch (e: Exception) { CardBuilder.musicPlain(this, s) }
    try {
      if (s.playing) {
        if (!foreground) {
          if (Build.VERSION.SDK_INT >= 29) startForeground(Cards.ID_MUSIC, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
          else startForeground(Cards.ID_MUSIC, n)
          foreground = true
        } else Cards.manager(this).notify(Cards.ID_MUSIC, n)
      } else {
        // pausado: o cartão pode ser dispensado com um deslize (a música já está parada)
        if (foreground) { stopForeground(STOP_FOREGROUND_DETACH); foreground = false }
        Cards.manager(this).notify(Cards.ID_MUSIC, n)
      }
    } catch (e: Exception) {
      // Android recusou o primeiro plano (app em segundo plano): mostra só o cartão
      try { Cards.manager(this).notify(Cards.ID_MUSIC, n) } catch (e2: Exception) { /* sem permissão de notificação */ }
    }
    updateSession(s)
    return START_NOT_STICKY
  }

  private fun updateSession(s: MusicState) {
    val ms = session ?: return
    try {
      ms.setMetadata(
        MediaMetadata.Builder()
          .putString(MediaMetadata.METADATA_KEY_TITLE, s.title)
          .putString(MediaMetadata.METADATA_KEY_ARTIST, s.subtitle)
          .putLong(MediaMetadata.METADATA_KEY_DURATION, s.duration * 1000L)
          .build()
      )
      var actions = PlaybackState.ACTION_PLAY or PlaybackState.ACTION_PAUSE or PlaybackState.ACTION_PLAY_PAUSE or PlaybackState.ACTION_STOP
      if (!s.live && s.skip) actions = actions or PlaybackState.ACTION_SKIP_TO_NEXT or PlaybackState.ACTION_SKIP_TO_PREVIOUS
      if (!s.live && s.duration > 0) actions = actions or PlaybackState.ACTION_SEEK_TO
      ms.setPlaybackState(
        PlaybackState.Builder()
          .setActions(actions)
          .setState(if (s.playing) PlaybackState.STATE_PLAYING else PlaybackState.STATE_PAUSED, s.position * 1000L, if (s.playing) 1f else 0f)
          .build()
      )
      if (!ms.isActive) ms.isActive = true
    } catch (e: Exception) { /* extra */ }
  }

  /** Deslizar o app para fora da lista de recentes encerra o player (e avisa o app, se ainda estiver vivo). */
  override fun onTaskRemoved(rootIntent: Intent?) {
    Bus.dispatch("music", "close")
    Store.music = null
    shutdown()
    super.onTaskRemoved(rootIntent)
  }

  private fun shutdown() {
    // Quem chamou startForegroundService() exige um startForeground() em até 5 s, mesmo que a gente vá parar logo em seguida.
    if (!foreground) {
      try { startForeground(Cards.ID_MUSIC, CardBuilder.musicPlain(this, MusicState(title = "Modo Treino"))) } catch (e: Exception) { /* sem permissão: nada a mostrar */ }
    }
    try { stopForeground(STOP_FOREGROUND_REMOVE) } catch (e: Exception) { /* já fora */ }
    foreground = false
    Cards.cancel(this, Cards.ID_MUSIC)
    stopSelf()
  }

  override fun onDestroy() {
    try { session?.isActive = false; session?.release() } catch (e: Exception) { /* nada */ }
    session = null
    super.onDestroy()
  }

  companion object {
    const val ACTION_STOP = "art.josperd.modotreino.notif.STOP"
  }
}
