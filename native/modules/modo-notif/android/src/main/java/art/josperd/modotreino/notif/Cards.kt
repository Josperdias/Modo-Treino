package art.josperd.modotreino.notif

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.RectF
import android.os.Build
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews

/** Monta as duas notificações do Modo Treino com o visual do app: cartão de contorno de tinta e sombra dura, fita colorida, botões em "adesivo". */
object Cards {
  const val CH_MUSIC = "mt_musica"
  const val CH_WORKOUT = "mt_treino"
  const val ID_MUSIC = 7101
  const val ID_WORKOUT = 7102
  const val ACTION = "art.josperd.modotreino.notif.ACTION"
  
  private val FITAS = intArrayOf(
    R.drawable.art_fita_0, R.drawable.art_fita_1, R.drawable.art_fita_2, R.drawable.art_fita_3,
    R.drawable.art_fita_4, R.drawable.art_fita_5, R.drawable.art_fita_6, R.drawable.art_fita_7,
  )
  private val artCache = HashMap<Int, Bitmap>()

  fun manager(ctx: Context): NotificationManager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  /** Os canais precisam existir antes da notificação. (Canais antigos de versões anteriores são removidos.) */
  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < 26) return
    val nm = manager(ctx)
    for (old in arrayOf("treino", "musica2", "treino2")) nm.deleteNotificationChannel(old)
    if (nm.getNotificationChannel(CH_MUSIC) == null) {
      val c = NotificationChannel(CH_MUSIC, "Música tocando", NotificationManager.IMPORTANCE_LOW)
      c.description = "Cartão com a fita (ou rádio) que está tocando, com anterior, tocar/pausar e próxima."
      c.setShowBadge(false)
      c.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      nm.createNotificationChannel(c)
    }
    if (nm.getNotificationChannel(CH_WORKOUT) == null) {
      val c = NotificationChannel(CH_WORKOUT, "Treino em andamento", NotificationManager.IMPORTANCE_LOW)
      c.description = "Cartão com o exercício atual, as séries e o descanso, com botões para concluir a série."
      c.setShowBadge(false)
      c.enableVibration(false)
      c.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      nm.createNotificationChannel(c)
    }
  }

  private fun act(ctx: Context, kind: String, action: String): PendingIntent {
    if (action == "open") return open(ctx)
    val i = Intent(ctx, ActionReceiver::class.java).setAction("$ACTION.$kind.$action").putExtra("kind", kind).putExtra("action", action)
    return PendingIntent.getBroadcast(ctx, 0, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Notificação dispensada pelo usuário (deslizar). */
  fun deleteIntent(ctx: Context, kind: String, action: String): PendingIntent {
    val i = Intent(ctx, ActionReceiver::class.java).setAction("$ACTION.$kind.$action.delete").putExtra("kind", kind).putExtra("action", action)
    return PendingIntent.getBroadcast(ctx, 1, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Tocar no corpo da notificação volta para o app. */
  fun open(ctx: Context): PendingIntent {
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent()
    return PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Fita ou planeta: PNG com fundo transparente, usado como está. */
  private fun art(ctx: Context, res: Int): Bitmap = synchronized(artCache) {
    artCache.getOrPut(res) { BitmapFactory.decodeResource(ctx.resources, res) }
  }

  /** Ilustração do exercício: recurso do app (release) ou arquivo. Reduzida para não pesar na notificação; mantém a proporção inteira ("contain"). */
  private val exCache = HashMap<String, Bitmap?>()
  private fun exerciseArt(ctx: Context, name: String, maxH: Int): Bitmap? = synchronized(exCache) {
    if (name.isEmpty()) return null
    exCache.getOrPut("$name@$maxH") {
      try {
        val opts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        fun decode(o: BitmapFactory.Options): Bitmap? {
          val id = ctx.resources.getIdentifier(name.substringAfterLast('/').substringBeforeLast('.'), "drawable", ctx.packageName)
          return when {
            id != 0 -> BitmapFactory.decodeResource(ctx.resources, id, o)
            name.startsWith("file:") -> BitmapFactory.decodeFile(name.removePrefix("file://"), o)
            name.startsWith("/") -> BitmapFactory.decodeFile(name, o)
            else -> null
          }
        }
        decode(opts)
        if (opts.outHeight <= 0) return@getOrPut null
        val dec = BitmapFactory.Options().apply { inSampleSize = maxOf(1, opts.outHeight / maxH) }
        val raw = decode(dec) ?: return@getOrPut null
        val scale = maxH.toFloat() / raw.height
        val sw = (raw.width * scale).toInt().coerceAtLeast(1)
        val out = Bitmap.createScaledBitmap(raw, sw, maxH, true)
        if (out !== raw) raw.recycle()
        // cantos arredondados (a moldura de tinta é do layout)
        val rounded = Bitmap.createBitmap(out.width, out.height, Bitmap.Config.ARGB_8888)
        val cv = Canvas(rounded)
        val p = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
        val rr = out.width * 0.07f
        cv.drawRoundRect(RectF(0f, 0f, out.width.toFloat(), out.height.toFloat()), rr, rr, p)
        p.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        cv.drawBitmap(out, 0f, 0f, p)
        out.recycle()
        rounded
      } catch (e: Throwable) { null }
    }
  }

  internal fun clock(sec: Int): String = "%d:%02d".format(sec / 60, sec % 60)

  /* ----------------------------------------------------------------- música */

  fun musicViews(ctx: Context, s: MusicState): Pair<RemoteViews, RemoteViews> =
    if (s.live) radioViews(ctx, s) else fitaViews(ctx, s)

  private fun fitaViews(ctx: Context, s: MusicState): Pair<RemoteViews, RemoteViews> {
    val small = RemoteViews(ctx.packageName, R.layout.card_music_small)
    val big = RemoteViews(ctx.packageName, R.layout.card_music_big)
    val bmp = art(ctx, FITAS[s.art.coerceIn(0, FITAS.size - 1)])
    val showSkip = s.skip
    for (v in arrayOf(small, big)) {
      v.setImageViewBitmap(R.id.art, bmp)
      v.setTextViewText(R.id.title, s.title)
      v.setTextViewText(R.id.subtitle, s.subtitle)
      v.setImageViewResource(R.id.play, if (s.playing) R.drawable.ic_pause else R.drawable.ic_play)
      v.setContentDescription(R.id.play, if (s.playing) "Pausar" else "Tocar")
      v.setOnClickPendingIntent(R.id.play, act(ctx, "music", "toggle"))
      v.setOnClickPendingIntent(R.id.prev, act(ctx, "music", "prev"))
      v.setOnClickPendingIntent(R.id.next, act(ctx, "music", "next"))
      v.setViewVisibility(R.id.prev, if (showSkip) View.VISIBLE else View.GONE)
      v.setViewVisibility(R.id.next, if (showSkip) View.VISIBLE else View.GONE)
    }
    big.setTextViewText(R.id.kicker, s.kicker)
    big.setImageViewResource(R.id.fav, if (s.fav) R.drawable.ic_heart_fill else R.drawable.ic_heart)
    big.setContentDescription(R.id.fav, if (s.fav) "Tirar das favoritas" else "Favoritar")
    big.setOnClickPendingIntent(R.id.fav, act(ctx, "music", "fav"))
    big.setOnClickPendingIntent(R.id.open, act(ctx, "music", "open"))
    big.setTextViewText(R.id.pos, clock(s.position))
    big.setTextViewText(R.id.dur, if (s.duration > 0) clock(s.duration) else "--:--")
    big.setProgressBar(R.id.bar, 1000, if (s.duration > 0) (1000L * s.position / s.duration).toInt().coerceIn(0, 1000) else 0, false)
    return small to big
  }

  /** Rádio ao vivo: espaço estrelado com o planeta de pontinhos; sem anterior/próxima nem barra de tempo. */
  private fun radioViews(ctx: Context, s: MusicState): Pair<RemoteViews, RemoteViews> {
    val small = RemoteViews(ctx.packageName, R.layout.card_radio_small)
    val big = RemoteViews(ctx.packageName, R.layout.card_radio_big)
    val bmp = art(ctx, R.drawable.art_planet)
    for (v in arrayOf(small, big)) {
      v.setImageViewBitmap(R.id.art, bmp)
      v.setTextViewText(R.id.title, s.title)
      v.setTextViewText(R.id.subtitle, s.subtitle)
      v.setImageViewResource(R.id.play, if (s.playing) R.drawable.ic_pause else R.drawable.ic_play)
      v.setContentDescription(R.id.play, if (s.playing) "Pausar" else "Tocar")
      v.setOnClickPendingIntent(R.id.play, act(ctx, "music", "toggle"))
    }
    big.setTextViewText(R.id.kicker, s.kicker)
    big.setImageViewResource(R.id.fav, if (s.fav) R.drawable.ic_heart_fill else R.drawable.ic_heart)
    big.setContentDescription(R.id.fav, if (s.fav) "Tirar das favoritas" else "Favoritar")
    big.setOnClickPendingIntent(R.id.fav, act(ctx, "music", "fav"))
    big.setOnClickPendingIntent(R.id.open, act(ctx, "music", "open"))
    return small to big
  }

  /* ----------------------------------------------------------------- treino */

  fun workoutViews(ctx: Context, s: WorkoutState, nowMs: Long = System.currentTimeMillis()): Pair<RemoteViews, RemoteViews> {
    val small = RemoteViews(ctx.packageName, R.layout.card_workout_small)
    val big = RemoteViews(ctx.packageName, R.layout.card_workout_big)
    val resting = s.restPaused || s.restEndsAt > nowMs
    val persona = if (s.persona == "loira") R.drawable.ic_flower else R.drawable.ic_star
    val artBig = exerciseArt(ctx, s.image, 256)
    val artSmall = exerciseArt(ctx, s.image, 96)
    val icon = when (s.primaryAction) { "pause" -> R.drawable.ic_pause; "resume" -> R.drawable.ic_play; else -> R.drawable.ic_check }
    for (v in arrayOf(small, big)) {
      v.setTextViewText(R.id.title, s.title)
      v.setImageViewResource(R.id.primary, icon)
      v.setContentDescription(R.id.primary, s.primaryLabel)
      v.setContentDescription(R.id.secondary, s.secondaryLabel)
      v.setOnClickPendingIntent(R.id.primary, act(ctx, "workout", s.primaryAction))
      v.setOnClickPendingIntent(R.id.secondary, act(ctx, "workout", s.secondaryAction))
      v.setViewVisibility(R.id.pill_text, if (resting) View.GONE else View.VISIBLE)
      v.setViewVisibility(R.id.clock, if (resting) View.VISIBLE else View.GONE)
      if (!resting) v.setTextViewText(R.id.pill_text, s.pill)
    }
    if (artBig != null) big.setImageViewBitmap(R.id.art, artBig) else big.setImageViewResource(R.id.art, persona)
    if (artSmall != null) small.setImageViewBitmap(R.id.art, artSmall) else small.setImageViewResource(R.id.art, persona)
    big.setTextViewText(R.id.kicker, s.kicker)
    big.setOnClickPendingIntent(R.id.open, act(ctx, "workout", "open"))
    if (resting) {
      // o próprio Android conta o tempo: não precisa atualizar a notificação a cada segundo
      val leftMs = if (s.restPaused) s.restLeft * 1000L else s.restEndsAt - nowMs
      val base = SystemClock.elapsedRealtime() + leftMs
      for (v in arrayOf(small, big)) {
        v.setChronometerCountDown(R.id.clock, true)
        v.setChronometer(R.id.clock, base, "Descanso %s", !s.restPaused)
      }
    }
    return small to big
  }

  fun cancel(ctx: Context, id: Int) {
    try { manager(ctx).cancel(id) } catch (e: Exception) { /* nada a cancelar */ }
  }

  /** O que o Android está fazendo com as nossas notificações (para o teste em Ajustes). */
  fun diagnose(ctx: Context): Map<String, Any?> {
    val nm = manager(ctx)
    fun imp(id: String): Int = if (Build.VERSION.SDK_INT >= 26) (nm.getNotificationChannel(id)?.importance ?: -1) else 3
    return mapOf(
      "enabled" to nm.areNotificationsEnabled(),
      "music" to imp(CH_MUSIC),
      "workout" to imp(CH_WORKOUT),
      "sdk" to Build.VERSION.SDK_INT,
      "device" to "${Build.MANUFACTURER} ${Build.MODEL}",
    )
  }
}
