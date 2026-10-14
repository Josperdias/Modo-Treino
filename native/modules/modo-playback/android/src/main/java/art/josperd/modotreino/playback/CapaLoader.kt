@file:OptIn(androidx.media3.common.util.UnstableApi::class)

package art.josperd.modotreino.playback

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.BitmapLoader
import androidx.media3.datasource.DataSourceBitmapLoader
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Entrega ao player do Android a CAPA do app (a fita colorida sobre o azul-céu pontilhado, ou o planeta da rádio) em vez de uma capa genérica.
 * A fila só carrega um endereço curtinho `capa://3` (ou `capa://radio`); a imagem sai daqui, de 9 PNGs de 512x512 em cache.
 * Qualquer outro endereço (capa de álbum real, no futuro) segue o caminho normal do Media3.
 */
class CapaLoader(private val context: Context) : BitmapLoader {
  private val fallback = DataSourceBitmapLoader(context)
  private val cache = HashMap<String, Bitmap>()

  private fun capa(name: String): Bitmap? = synchronized(cache) {
    cache[name] ?: run {
      val res = if (name == "radio") "capa_radio" else "capa_fita_${name.toIntOrNull()?.coerceIn(0, 7) ?: 0}"
      val id = context.resources.getIdentifier(res, "drawable", context.packageName)
      if (id == 0) null else BitmapFactory.decodeResource(context.resources, id)?.also { cache[name] = it }
    }
  }

  override fun supportsMimeType(mimeType: String): Boolean = fallback.supportsMimeType(mimeType)
  override fun decodeBitmap(data: ByteArray): ListenableFuture<Bitmap> = fallback.decodeBitmap(data)
  override fun loadBitmap(uri: Uri): ListenableFuture<Bitmap> {
    if (uri.scheme == "capa") {
      val bmp = capa(uri.host ?: "0")
      if (bmp != null) return Futures.immediateFuture(bmp)
    }
    return fallback.loadBitmap(uri)
  }
  override fun loadBitmapFromMetadata(metadata: MediaMetadata): ListenableFuture<Bitmap>? {
    val uri = metadata.artworkUri
    if (uri != null && uri.scheme == "capa") return loadBitmap(uri)
    return fallback.loadBitmapFromMetadata(metadata)
  }
}
