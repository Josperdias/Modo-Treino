package art.josperd.modotreino.apk

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest

/** Baixa o APK da atualização pelo gerenciador de downloads do Android: aparece em Downloads e numa notificação, continua com o app fechado
 * e dispensa a permissão de "instalar apps desconhecidos" do próprio Modo Treino. O app só acompanha o progresso e confere o SHA-256. */
class ModoApkModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()
  private val manager: DownloadManager
    get() = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager

  override fun definition() = ModuleDefinition {
    Name("ModoApk")

    /** Enfileira o download e devolve o número dele (ou -1 se o Android recusar). */
    Function("enqueue") { url: String, fileName: String, title: String ->
      fun request(publicDir: Boolean): DownloadManager.Request {
        val r = DownloadManager.Request(Uri.parse(url))
          .setTitle(title)
          .setDescription("Modo Treino")
          .setMimeType("application/vnd.android.package-archive")
          .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
          .addRequestHeader("User-Agent", "ModoTreino")
        if (publicDir) r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
        else r.setDestinationInExternalFilesDir(context, Environment.DIRECTORY_DOWNLOADS, fileName)
        return r
      }
      try {
        manager.enqueue(request(true)).toDouble()
      } catch (e: Exception) {
        try { manager.enqueue(request(false)).toDouble() } catch (e2: Exception) { -1.0 }
      }
    }

    /** Situação do download: pending | running | paused | done | failed | missing, com bytes recebidos/total. */
    Function("status") { id: Double ->
      val q = DownloadManager.Query().setFilterById(id.toLong())
      val c = manager.query(q)
      try {
        if (c == null || !c.moveToFirst()) {
          mapOf<String, Any?>("state" to "missing", "received" to 0.0, "total" to 0.0, "reason" to 0)
        } else {
          val st = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
          val state = when (st) {
            DownloadManager.STATUS_PENDING -> "pending"
            DownloadManager.STATUS_RUNNING -> "running"
            DownloadManager.STATUS_PAUSED -> "paused"
            DownloadManager.STATUS_SUCCESSFUL -> "done"
            else -> "failed"
          }
          mapOf<String, Any?>(
            "state" to state,
            "received" to c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).toDouble(),
            "total" to c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).toDouble(),
            "reason" to c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)),
          )
        }
      } finally { c?.close() }
    }

    /** Cancela (e apaga o arquivo parcial ou pronto). */
    Function("remove") { id: Double ->
      try { manager.remove(id.toLong()); true } catch (e: Exception) { false }
    }

    /** SHA-256 do arquivo baixado, em hexadecimal minúsculo (vazio se não deu para ler). */
    AsyncFunction("sha256") { id: Double ->
      try {
        val pfd: ParcelFileDescriptor = manager.openDownloadedFile(id.toLong())
        val md = MessageDigest.getInstance("SHA-256")
        ParcelFileDescriptor.AutoCloseInputStream(pfd).use { input ->
          val buf = ByteArray(64 * 1024)
          while (true) {
            val n = input.read(buf)
            if (n < 0) break
            md.update(buf, 0, n)
          }
        }
        md.digest().joinToString("") { "%02x".format(it) }
      } catch (e: Exception) { "" }
    }

    /** Abre a tela de Downloads do Android: tocar no arquivo abre o instalador (o sistema é quem libera a instalação). */
    Function("openDownloads") {
      val intent = Intent(DownloadManager.ACTION_VIEW_DOWNLOADS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try { context.startActivity(intent); true } catch (e: Exception) { false }
    }
  }
}
