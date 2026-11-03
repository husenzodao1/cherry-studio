package tj.hamnavo

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
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
import android.view.Gravity
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Space
import android.widget.TextView
import android.widget.Toast
import tj.hamnavo.core.NetUtil

/** One screen: choose a role, press the ring. */
class MainActivity : Activity() {
    companion object {
        private const val REQ_SEND_PERMS = 1
        private const val REQ_RECV_PERMS = 2
        private const val REQ_PROJECTION = 3
        private const val PREFS = "hamnavo"
    }

    private val handler = Handler(Looper.getMainLooper())
    private var sending = true

    private var fg = 0
    private var muted = 0
    private var faint = 0
    private var bg = 0

    private lateinit var modeSend: TextView
    private lateinit var modeReceive: TextView
    private lateinit var ring: RingButton
    private lateinit var status: TextView
    private lateinit var sub: TextView
    private lateinit var ipInput: EditText
    private lateinit var beep: TextView
    private lateinit var hotspot: TextView
    private lateinit var ipToggle: TextView
    private lateinit var battery: TextView
    private lateinit var logToggle: TextView
    private lateinit var logView: TextView

    private val refresher = object : Runnable {
        override fun run() {
            updateUi()
            handler.postDelayed(this, 100)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val night = resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
        bg = if (night) 0xFF0B0B0B.toInt() else 0xFFFFFFFF.toInt()
        fg = if (night) 0xFFF2F2F2.toInt() else 0xFF111111.toInt()
        muted = if (night) 0xFF7A7A7A.toInt() else 0xFF9A9A9A.toInt()
        faint = if (night) 0xFF2A2A2A.toInt() else 0xFFE8E8E8.toInt()

        val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        sending = if (AppState.receiverRunning) false else if (AppState.sender != AppState.Sender.OFF) true else prefs.getBoolean("send", true)
        val dp = resources.displayMetrics.density

        fun label(text: Int, size: Float, color: Int, id: Int = View.NO_ID) = TextView(this).apply {
            this.id = id
            setText(text)
            textSize = size
            setTextColor(color)
            gravity = Gravity.CENTER
            typeface = Typeface.create("sans-serif-light", Typeface.NORMAL)
        }
        fun action(text: Int, id: Int, onClick: () -> Unit) = label(text, 13f, muted, id).apply {
            setPadding((14 * dp).toInt(), (12 * dp).toInt(), (14 * dp).toInt(), (12 * dp).toInt())
            setOnClickListener { onClick() }
        }
        fun space(h: Int = 0, weight: Float = 0f) = Space(this).apply {
            layoutParams = LinearLayout.LayoutParams(1, (h * dp).toInt(), weight)
        }

        modeSend = label(R.string.mode_send, 17f, fg, R.id.mode_send).apply {
            setPadding((14 * dp).toInt(), (10 * dp).toInt(), (14 * dp).toInt(), (10 * dp).toInt())
            setOnClickListener { chooseRole(true) }
        }
        modeReceive = label(R.string.mode_receive, 17f, muted, R.id.mode_receive).apply {
            setPadding((14 * dp).toInt(), (10 * dp).toInt(), (14 * dp).toInt(), (10 * dp).toInt())
            setOnClickListener { chooseRole(false) }
        }
        ring = RingButton(this).apply {
            id = R.id.btn_main
            color = fg
            faintColor = faint
            layoutParams = LinearLayout.LayoutParams((232 * dp).toInt(), (232 * dp).toInt())
            setOnClickListener { onMain() }
        }
        status = label(R.string.tap, 15f, muted, R.id.status_line)
        sub = label(R.string.tap, 12f, muted, R.id.status_sub).apply { text = "" }
        ipInput = EditText(this).apply {
            id = R.id.ip_input
            setHint(R.string.hint_ip)
            setTextColor(fg)
            setHintTextColor(faint)
            textSize = 16f
            gravity = Gravity.CENTER
            background = null
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            isSingleLine = true
            setText(prefs.getString("ip", ""))
            visibility = if (text.isNullOrEmpty()) View.GONE else View.VISIBLE
        }
        beep = action(R.string.act_beep, R.id.btn_beep) {
            if (AppState.senderRunning) {
                startService(Intent(this, SenderService::class.java).setAction(SenderService.ACTION_BEEP))
            }
        }
        hotspot = action(R.string.act_wifi, R.id.btn_hotspot) { openHotspotSettings() }
        ipToggle = action(R.string.act_ip, R.id.btn_ip) {
            ipInput.visibility = if (ipInput.visibility == View.VISIBLE) View.GONE else View.VISIBLE
            if (ipInput.visibility == View.VISIBLE) ipInput.requestFocus()
        }
        battery = action(R.string.act_battery, R.id.btn_battery) { askIgnoreBatteryOptimizations() }
        logToggle = action(R.string.act_log, R.id.btn_log) {
            logView.visibility = if (logView.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }
        logView = TextView(this).apply {
            id = R.id.log_view
            textSize = 10f
            setTextColor(muted)
            typeface = Typeface.MONOSPACE
            visibility = View.GONE
            setTextIsSelectable(true)
        }

        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding((24 * dp).toInt(), (28 * dp).toInt(), (24 * dp).toInt(), (16 * dp).toInt())
            addView(label(R.string.brand, 12f, muted).apply { letterSpacing = 0.3f })
            addView(space(weight = 1f))
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                addView(modeSend)
                addView(modeReceive)
            })
            addView(space(36))
            addView(ring)
            addView(space(24))
            addView(status)
            addView(sub)
            addView(ipInput)
            addView(space(weight = 1f))
            addView(LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER
                listOf(beep, hotspot, ipToggle, battery, logToggle).forEach { addView(it) }
            })
            addView(logView)
        }
        setContentView(FrameLayout(this).apply {
            setBackgroundColor(bg)
            addView(column, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        })
        // After setContentView: the window's insets controller needs the decor view.
        styleSystemBars(night)
        updateUi()
    }

    private fun styleSystemBars(night: Boolean) {
        window.statusBarColor = bg
        window.navigationBarColor = bg
        if (Build.VERSION.SDK_INT >= 30) {
            val light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
            window.insetsController?.setSystemBarsAppearance(if (night) 0 else light, light)
        } else if (!night) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility =
                View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR or View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR
        }
    }

    override fun onResume() {
        super.onResume()
        handler.post(refresher)
    }

    override fun onPause() {
        handler.removeCallbacks(refresher)
        getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putBoolean("send", sending)
            .putString("ip", ipInput.text.toString().trim())
            .apply()
        super.onPause()
    }

    /** One phone has one role: choosing the other one ends the current one. */
    private fun chooseRole(send: Boolean) {
        if (send == sending) return
        sending = send
        if (send) ReceiverService.stop(this) else SenderService.stop(this)
        updateUi()
    }

    private fun onMain() {
        if (sending) {
            when (AppState.sender) {
                AppState.Sender.STREAMING -> SenderService.pause(this)
                AppState.Sender.READY -> SenderService.resume(this)
                AppState.Sender.OFF -> startSending()
            }
        } else {
            if (AppState.receiverRunning) ReceiverService.stop(this) else startReceiving()
        }
    }

    private fun neededPermissions(vararg perms: String): Array<String> = perms
        .filter { Build.VERSION.SDK_INT >= 33 || it != Manifest.permission.POST_NOTIFICATIONS }
        .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        .toTypedArray()

    private fun startSending() {
        ReceiverService.stop(this)
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

    private fun openHotspotSettings() {
        for (i in listOf(Intent("android.settings.TETHER_SETTINGS"), Intent(Settings.ACTION_WIRELESS_SETTINGS))) {
            try {
                startActivity(i)
                return
            } catch (_: Exception) {
            }
        }
    }

    private fun askIgnoreBatteryOptimizations() {
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (_: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun updateUi() {
        modeSend.setTextColor(if (sending) fg else muted)
        modeReceive.setTextColor(if (sending) muted else fg)

        if (sending) {
            val streaming = AppState.senderRunning
            ring.mode = when {
                !streaming -> RingButton.Mode.IDLE
                AppState.senderClients == 0 -> RingButton.Mode.WAITING
                else -> RingButton.Mode.ACTIVE
            }
            ring.level = AppState.senderCaptureLevel
            status.text = when {
                AppState.sender == AppState.Sender.READY -> getString(R.string.ready)
                !streaming -> getString(R.string.tap)
                AppState.senderClients == 0 -> getString(R.string.sender_waiting)
                else -> getString(R.string.sender_live, AppState.senderClients, AppState.senderDelayMs)
            }
            sub.text = when {
                streaming && SystemClock.uptimeMillis() - AppState.senderLastSoundAt > 5000 -> getString(R.string.no_sound)
                streaming -> NetUtil.localIpv4Addresses().joinToString("  ")
                else -> ""
            }
            ring.contentDescription = getString(if (streaming) R.string.main_desc_stop else R.string.main_desc_start)
            beep.setTextColor(if (AppState.senderBeepActive) fg else muted)
            beep.isEnabled = streaming
            beep.alpha = if (streaming) 1f else 0.4f
        } else {
            val running = AppState.receiverRunning
            ring.mode = when {
                !running -> RingButton.Mode.IDLE
                AppState.receiverConnectedTo == null -> RingButton.Mode.WAITING
                else -> RingButton.Mode.ACTIVE
            }
            ring.level = AppState.receiverLevel
            status.text = if (running) AppState.receiverStatus else getString(R.string.tap)
            sub.text = ""
            ring.contentDescription = getString(if (running) R.string.main_desc_stop else R.string.main_desc_start)
        }
        ring.invalidate()
        beep.visibility = if (sending) View.VISIBLE else View.GONE
        hotspot.visibility = if (sending) View.VISIBLE else View.GONE
        ipToggle.visibility = if (sending) View.GONE else View.VISIBLE
        if (sending) ipInput.visibility = View.GONE
        battery.visibility = if (getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(packageName)) View.GONE else View.VISIBLE
        sub.visibility = if (sub.text.isNullOrEmpty()) View.GONE else View.VISIBLE
        if (logView.visibility == View.VISIBLE) logView.text = AppState.logText()

        // A visible screen keeps Wi-Fi in its low-latency mode on the receiving phone: shortest delay.
        if (AppState.receiverRunning) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}
