package tj.hamnavo

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.media.projection.MediaProjectionConfig
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import tj.hamnavo.core.NetUtil

class MainActivity : Activity() {
    companion object {
        private const val REQ_SEND_PERMS = 1
        private const val REQ_RECV_PERMS = 2
        private const val REQ_PROJECTION = 3
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var senderStatus: TextView
    private lateinit var receiverStatus: TextView
    private lateinit var logView: TextView
    private lateinit var beepButton: Button
    private lateinit var ipInput: EditText

    private val refresher = object : Runnable {
        override fun run() {
            updateStatus()
            handler.postDelayed(this, 250)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        fun header(res: Int) = TextView(this).apply {
            setText(res)
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, pad, 0, pad / 2)
        }
        fun text(res: Int) = TextView(this).apply { setText(res); textSize = 15f }
        fun status(viewId: Int) = TextView(this).apply {
            id = viewId
            textSize = 15f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, pad / 2, 0, pad / 2)
        }
        fun button(viewId: Int, res: Int, onClick: () -> Unit) = Button(this).apply {
            id = viewId
            setText(res)
            isAllCaps = false
            setOnClickListener { onClick() }
        }

        senderStatus = status(R.id.status_sender)
        receiverStatus = status(R.id.status_receiver)
        logView = TextView(this).apply {
            id = R.id.log_view
            textSize = 12f
            typeface = Typeface.MONOSPACE
            setTextIsSelectable(true)
            setPadding(0, pad, 0, 0)
        }
        ipInput = EditText(this).apply {
            id = R.id.ip_input
            setHint(R.string.hint_ip)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            isSingleLine = true
        }
        beepButton = button(R.id.btn_beep, R.string.btn_beep) { toggleBeep() }

        root.addView(text(R.string.intro))
        root.addView(header(R.string.section_sender))
        root.addView(text(R.string.hint_sender))
        root.addView(button(R.id.btn_hotspot, R.string.btn_hotspot) { openHotspotSettings() })
        root.addView(button(R.id.btn_send, R.string.btn_send) { startSending() })
        root.addView(beepButton)
        root.addView(senderStatus)
        root.addView(header(R.string.section_receiver))
        root.addView(text(R.string.hint_receiver))
        root.addView(ipInput)
        root.addView(button(R.id.btn_receive, R.string.btn_receive) { startReceiving() })
        root.addView(receiverStatus)
        root.addView(View(this).apply { minimumHeight = pad })
        root.addView(button(R.id.btn_stop, R.string.btn_stop) { stopAll() })
        root.addView(button(R.id.btn_battery, R.string.btn_battery) { askIgnoreBatteryOptimizations() })
        root.addView(logView)

        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresher)
    }

    override fun onPause() {
        handler.removeCallbacks(refresher)
        super.onPause()
    }

    private fun neededPermissions(vararg perms: String): Array<String> = perms
        .filter { Build.VERSION.SDK_INT >= 33 || it != Manifest.permission.POST_NOTIFICATIONS }
        .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        .toTypedArray()

    private fun startSending() {
        // One phone has one role: a phone that sends must not also play the stream.
        ReceiverService.stop(this)
        if (AppState.senderRunning) return
        val missing = neededPermissions(Manifest.permission.RECORD_AUDIO, Manifest.permission.POST_NOTIFICATIONS)
        if (missing.isEmpty()) requestProjection() else requestPermissions(missing, REQ_SEND_PERMS)
    }

    private fun requestProjection() {
        val mpm = getSystemService(MediaProjectionManager::class.java)
        val intent = if (Build.VERSION.SDK_INT >= 34) {
            mpm.createScreenCaptureIntent(MediaProjectionConfig.createConfigForDefaultDisplay())
        } else {
            mpm.createScreenCaptureIntent()
        }
        @Suppress("DEPRECATION")
        startActivityForResult(intent, REQ_PROJECTION)
    }

    private fun toggleBeep() {
        if (!AppState.senderRunning) return
        startService(Intent(this, SenderService::class.java).setAction(SenderService.ACTION_BEEP))
    }

    private fun startReceiving() {
        SenderService.stop(this)
        val missing = neededPermissions(Manifest.permission.POST_NOTIFICATIONS)
        if (missing.isEmpty()) launchReceiver() else requestPermissions(missing, REQ_RECV_PERMS)
    }

    private fun launchReceiver() {
        startForegroundService(
            Intent(this, ReceiverService::class.java)
                .setAction(ReceiverService.ACTION_START)
                .putExtra(ReceiverService.EXTRA_HOST, ipInput.text.toString())
        )
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        when (requestCode) {
            REQ_SEND_PERMS ->
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    requestProjection()
                } else {
                    Toast.makeText(this, R.string.need_mic, Toast.LENGTH_LONG).show()
                }
            REQ_RECV_PERMS -> launchReceiver()
        }
    }

    @Deprecated("Activity result API of plain android.app.Activity")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PROJECTION) return
        if (resultCode != RESULT_OK || data == null) {
            Toast.makeText(this, R.string.projection_denied, Toast.LENGTH_LONG).show()
            return
        }
        startForegroundService(
            Intent(this, SenderService::class.java)
                .setAction(SenderService.ACTION_START)
                .putExtra(SenderService.EXTRA_CODE, resultCode)
                .putExtra(SenderService.EXTRA_DATA, data)
        )
    }

    private fun stopAll() {
        SenderService.stop(this)
        ReceiverService.stop(this)
    }

    private fun openHotspotSettings() {
        val intents = listOf(
            Intent("android.settings.TETHER_SETTINGS"),
            Intent(Settings.ACTION_WIRELESS_SETTINGS),
        )
        for (i in intents) {
            try {
                startActivity(i)
                return
            } catch (_: Exception) {
            }
        }
    }

    private fun askIgnoreBatteryOptimizations() {
        val pm = getSystemService(PowerManager::class.java)
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            Toast.makeText(this, R.string.battery_ok, Toast.LENGTH_SHORT).show()
            return
        }
        try {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
            )
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun updateStatus() {
        senderStatus.text = if (AppState.senderRunning) {
            val ips = NetUtil.localIpv4Addresses().joinToString(", ").ifEmpty { "—" }
            var s = getString(
                R.string.sender_on, ips, AppState.senderClients, AppState.levelBar(AppState.senderCaptureLevel)
            )
            if (SystemClock.uptimeMillis() - AppState.senderLastSoundAt > 5000) s += "\n" + getString(R.string.sender_no_sound)
            s
        } else {
            getString(R.string.sender_off)
        }
        beepButton.setText(if (AppState.senderBeepActive) R.string.btn_beep_stop else R.string.btn_beep)
        beepButton.isEnabled = AppState.senderRunning
        receiverStatus.text = if (AppState.receiverRunning) {
            getString(R.string.receiver_on, AppState.receiverStatus, AppState.levelBar(AppState.receiverLevel))
        } else {
            getString(R.string.receiver_off)
        }
        logView.text = AppState.logText()
    }
}
