package io.github.noahg123.zengarden

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.SystemClock
import android.view.ViewGroup
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

/**
 * Zen Garden is a thin shell around the live site. All content and design come from
 * GitHub Pages, so the daily update reaches the app without reinstalling.
 */
class MainActivity : ComponentActivity() {

    private companion object {
        const val HOME = "https://noahg-123.github.io/Zen-Garden/"
        const val SITE_HOST = "noahg-123.github.io"
        const val SITE_PATH = "/Zen-Garden"
        val BG = 0xFFEEF2F5.toInt()
        val INK = 0xFF1D3145.toInt()
        // Coming back after this long reloads, so the morning brief is always fresh.
        const val RELOAD_AFTER_MS = 20 * 60 * 1000L
    }

    private lateinit var web: WebView
    private lateinit var swipe: SwipeRefreshLayout
    private var pausedAt = 0L
    private var showingOfflinePage = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.light(BG, BG),
            navigationBarStyle = SystemBarStyle.light(BG, BG),
        )
        super.onCreate(savedInstanceState)

        web = WebView(this).apply {
            setBackgroundColor(BG)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mediaPlaybackRequiresUserGesture = true
            webViewClient = Client()
        }

        swipe = SwipeRefreshLayout(this).apply {
            setColorSchemeColors(INK)
            setOnRefreshListener { refresh() }
            addView(web, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }

        val root = FrameLayout(this).apply {
            setBackgroundColor(BG)
            addView(swipe, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        }
        // Keep the page clear of the status bar, camera cutout and gesture bar.
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            WindowInsetsCompat.CONSUMED
        }
        setContentView(root)

        // Back moves between tabs, then leaves the app.
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack() && !showingOfflinePage) {
                    web.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                    isEnabled = true
                }
            }
        })

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(HOME)
    }

    private fun refresh() {
        if (showingOfflinePage) web.loadUrl(HOME) else web.reload()
    }

    override fun onPause() {
        super.onPause()
        pausedAt = SystemClock.elapsedRealtime()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
        if (pausedAt > 0 && SystemClock.elapsedRealtime() - pausedAt > RELOAD_AFTER_MS) refresh()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    private fun isSite(uri: Uri): Boolean =
        uri.scheme == "https" && uri.host == SITE_HOST && (uri.path ?: "").startsWith(SITE_PATH)

    private inner class Client : WebViewClient() {
        // Zen Garden pages stay in the app; articles and sources open in your browser.
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            if (isSite(uri)) return false
            try {
                startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE))
            } catch (e: ActivityNotFoundException) {
                // no browser installed; ignore the tap
            }
            return true
        }

        override fun onPageFinished(view: WebView, url: String) {
            swipe.isRefreshing = false
            if (url.startsWith("https://")) showingOfflinePage = false
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            swipe.isRefreshing = false
            showingOfflinePage = true
            val html = """
                <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
                <body style="margin:0;background:#EEF2F5;color:#1D3145;font-family:sans-serif;
                  display:flex;align-items:center;justify-content:center;height:100vh;text-align:center">
                  <div style="padding:24px;max-width:320px">
                    <p style="font-size:20px;margin:0 0 8px">No connection</p>
                    <p style="font-size:16px;color:#5B6E81;margin:0">Zen Garden needs the internet the first time it opens.
                    Pull down to try again.</p>
                  </div>
                </body></html>
            """.trimIndent()
            view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
        }
    }
}
