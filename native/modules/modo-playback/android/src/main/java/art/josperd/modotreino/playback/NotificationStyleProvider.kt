@file:OptIn(androidx.media3.common.util.UnstableApi::class)

package art.josperd.modotreino.playback

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList

/**
 * Notificação de música do motor Media3, em dois estilos que o usuário escolhe em Ajustes:
 *  - "card": o CARTÃO ILUSTRADO do app (azul-céu pontilhado, fita colorida, botões em adesivo), os mesmos layouts do módulo de notificações;
 *  - "system": o player do próprio Android (barra de posição arrastável, ♥ e capa do app);
 *  - "full" (laboratório): o mesmo cartão SEM pedir a moldura do Android (só tem efeito em builds com targetSdk menor que 31, ver docs/MANUTENCAO.md).
 * O cartão é desenhado aqui, mas os layouts e imagens vêm do módulo `modo-notif`, achados pelo NOME no pacote do app (sem dependência de código entre módulos).
 * Os botões do cartão falam direto com o player do serviço: funcionam mesmo com o app fechado.
 */
class NotificationStyleProvider(
  private val context: Context,
  private val style: () -> String,
  private val favorite: () -> Boolean,
) : MediaNotification.Provider {
  private val system = DefaultMediaNotificationProvider(context).also { p ->
    val small = id("ic_stat_tape", "drawable")
    if (small != 0) p.setSmallIcon(small)
  }
  private var lastSession: MediaSession? = null
  private var lastFactory: MediaNotification.ActionFactory? = null
  private val bitmaps = HashMap<String, Bitmap?>()

  private fun id(name: String, type: String): Int = context.resources.getIdentifier(name, type, context.packageName)

  override fun createNotification(
    mediaSession: MediaSession,
    customLayout: ImmutableList<CommandButton>,
    actionFactory: MediaNotification.ActionFactory,
    onNotificationChangedCallback: MediaNotification.Provider.Callback,
  ): MediaNotification {
    lastSession = mediaSession
    lastFactory = actionFactory
    if (style() == "system" || id("card_music_big", "layout") == 0) {
      return system.createNotification(mediaSession, customLayout, actionFactory, onNotificationChangedCallback)
    }
    return card(mediaSession, actionFactory)
  }

  /** "full" (teste): o cartão sem a moldura do Android. Só o sistema decide: com `targetSdk` 31+ ele ignora e põe a moldura mesmo assim. */
  private fun framed(): Boolean = style() != "full"

  override fun handleCustomCommand(session: MediaSession, action: String, extras: Bundle): Boolean =
    system.handleCustomCommand(session, action, extras)

  /** Recria o cartão com a posição atual (o serviço chama a cada poucos segundos enquanto toca, para a barra andar). */
  fun refreshCard(): MediaNotification? {
    val s = lastSession ?: return null
    val f = lastFactory ?: return null
    if (style() == "system") return null
    return card(s, f)
  }

  private fun bitmap(name: String): Bitmap? = synchronized(bitmaps) {
    bitmaps.getOrPut(name) {
      val res = id(name, "drawable")
      if (res == 0) null else BitmapFactory.decodeResource(context.resources, res)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.getNotificationChannel(CHANNEL) == null) {
      val c = NotificationChannel(CHANNEL, "Música tocando", NotificationManager.IMPORTANCE_LOW)
      c.description = "Cartão com a fita (ou rádio) que está tocando, com anterior, tocar/pausar e próxima."
      c.setShowBadge(false)
      c.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      nm.createNotificationChannel(c)
    }
  }

  private fun clock(sec: Long): String = "%d:%02d".format(sec / 60, sec % 60)

  private fun card(session: MediaSession, factory: MediaNotification.ActionFactory): MediaNotification {
    ensureChannel()
    val player = session.player
    val item = player.currentMediaItem
    val itemTitle = item?.mediaMetadata?.title?.toString().orEmpty()
    val streamTitle = player.mediaMetadata.title?.toString()?.takeIf { it.isNotBlank() && it != itemTitle }
    val artHost = (player.mediaMetadata.artworkUri ?: item?.mediaMetadata?.artworkUri)?.host
    val live = artHost == "radio"
    val art = artHost?.toIntOrNull()?.coerceIn(0, 7) ?: 0
    val playing = player.isPlaying || player.playWhenReady
    val title = if (live) (streamTitle ?: itemTitle.ifBlank { "Rádio ao vivo" }) else itemTitle.ifBlank { "Fita" }
    val subtitle = if (live) (if (streamTitle != null) itemTitle else "ao vivo") else item?.mediaMetadata?.artist?.toString().orEmpty()
    val kicker = if (live) "Rádio ao vivo" else "Fita"
    val posSec = (player.currentPosition.coerceAtLeast(0L)) / 1000
    val durSec = if (player.duration == C.TIME_UNSET) 0L else player.duration.coerceAtLeast(0L) / 1000

    val pkg = context.packageName
    val small = RemoteViews(pkg, id(if (live) "card_radio_small" else "card_music_small", "layout"))
    val big = RemoteViews(pkg, id(if (live) "card_radio_big" else "card_music_big", "layout"))
    val bmp = bitmap(if (live) "art_planet" else "art_fita_$art")
    val playPending = factory.createMediaActionPendingIntent(session, Player.COMMAND_PLAY_PAUSE.toLong())
    val prevPending = factory.createMediaActionPendingIntent(session, Player.COMMAND_SEEK_TO_PREVIOUS.toLong())
    val nextPending = factory.createMediaActionPendingIntent(session, Player.COMMAND_SEEK_TO_NEXT.toLong())
    val open = openApp()
    for (v in arrayOf(small, big)) {
      if (bmp != null) v.setImageViewBitmap(id("art", "id"), bmp)
      v.setTextViewText(id("title", "id"), title)
      v.setTextViewText(id("subtitle", "id"), subtitle)
      v.setImageViewResource(id("play", "id"), id(if (playing) "ic_pause" else "ic_play", "drawable"))
      v.setContentDescription(id("play", "id"), if (playing) "Pausar" else "Tocar")
      v.setOnClickPendingIntent(id("play", "id"), playPending)
      if (!live) {
        v.setOnClickPendingIntent(id("prev", "id"), prevPending)
        v.setOnClickPendingIntent(id("next", "id"), nextPending)
      }
    }
    big.setTextViewText(id("kicker", "id"), kicker)
    val fav = favorite()
    big.setImageViewResource(id("fav", "id"), id(if (fav) "ic_heart_fill" else "ic_heart", "drawable"))
    big.setContentDescription(id("fav", "id"), if (fav) "Tirar das favoritas" else "Favoritar")
    // O Media3 só entrega o PendingIntent de um comando personalizado dentro de uma Action: usa-se a do ♥ (o ícone da Action não aparece, o cartão tem o seu).
    val favAction = factory.createCustomAction(session, IconCompat.createWithResource(context, id("ic_heart", "drawable").takeIf { it != 0 } ?: android.R.drawable.btn_star), "Favoritar", TapePlaybackService.ACTION_FAV, Bundle.EMPTY)
    big.setOnClickPendingIntent(id("fav", "id"), favAction.actionIntent)
    if (open != null) big.setOnClickPendingIntent(id("open", "id"), open)
    if (!live) {
      big.setTextViewText(id("pos", "id"), clock(posSec))
      big.setTextViewText(id("dur", "id"), if (durSec > 0) clock(durSec) else "--:--")
      big.setProgressBar(id("bar", "id"), 1000, if (durSec > 0) (1000L * posSec / durSec).toInt().coerceIn(0, 1000) else 0, false)
    }

    val smallIcon = id("ic_stat_tape", "drawable").takeIf { it != 0 } ?: android.R.drawable.ic_media_play
    val builder = NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(smallIcon)
      .setContentTitle(title)
      .setContentText(subtitle)
      .apply { if (framed()) setStyle(NotificationCompat.DecoratedCustomViewStyle()) }
      .setCustomContentView(small)
      .setCustomBigContentView(big)
      .setDeleteIntent(factory.createMediaActionPendingIntent(session, Player.COMMAND_STOP.toLong()))
      .setOngoing(playing)
      .setOnlyAlertOnce(true)
      .setShowWhen(false)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
    if (open != null) builder.setContentIntent(open)
    return MediaNotification(NOTIFICATION_ID, builder.build())
  }

  private fun openApp(): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(context, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  companion object {
    const val CHANNEL = "mt_musica"
    /** Mesmo número da notificação padrão do Media3: trocar de estilo substitui a notificação, não cria outra. */
    const val NOTIFICATION_ID = 1001
  }
}
