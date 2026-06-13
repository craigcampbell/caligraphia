package com.caligraphia.mobile

import android.content.Context
import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas as AndroidCanvas
import android.graphics.Color as AndroidColor
import android.graphics.Paint
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.MotionEvent
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.input.pointer.pointerInteropFilter
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.caligraphia.mobile.api.CaligraphiaApi
import com.caligraphia.mobile.api.CaligraphiaApiException
import com.caligraphia.mobile.model.PostDto
import com.caligraphia.mobile.model.UserDto
import com.caligraphia.mobile.posting.MIN_LETTER_DRAW_MS
import com.caligraphia.mobile.posting.toCanvasPostPayload
import java.io.File
import java.io.ByteArrayOutputStream
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val sharedImage = intent.sharedImageUri()

        setContent {
            CaligraphiaAndroidApp(initialSharedImage = sharedImage)
        }
    }
}

@Composable
private fun CaligraphiaAndroidApp(initialSharedImage: Uri?) {
    var selectedTab by remember { mutableStateOf(AndroidTab.Write) }
    var baseUrl by remember { mutableStateOf("http://10.0.2.2:3000") }
    val api = remember(baseUrl) { CaligraphiaApi(baseUrl) }
    var user by remember { mutableStateOf<UserDto?>(null) }
    var accountMessage by remember { mutableStateOf("Sign in to send and receive letters.") }

    LaunchedEffect(api) {
        runCatching { api.me() }
            .onSuccess {
                user = it
                accountMessage = "Signed in as ${it.username}"
            }
            .onFailure {
                user = null
            }
    }

    MaterialTheme {
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = Color(0xFFFAF7EF)
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                AndroidAccountPanel(
                    api = api,
                    user = user,
                    baseUrl = baseUrl,
                    accountMessage = accountMessage,
                    onBaseUrlChanged = { baseUrl = it },
                    onUserChanged = {
                        user = it
                        accountMessage = if (it == null) "Sign in to send and receive letters." else "Signed in as ${it.username}"
                    },
                    onMessageChanged = { accountMessage = it }
                )

                TabRow(selectedTabIndex = selectedTab.ordinal) {
                    AndroidTab.entries.forEach { tab ->
                        Tab(
                            selected = selectedTab == tab,
                            onClick = { selectedTab = tab },
                            text = { Text(tab.label) }
                        )
                    }
                }

                Box(modifier = Modifier.weight(1f)) {
                    when (selectedTab) {
                        AndroidTab.Write -> AndroidComposer(
                            initialSharedImage = initialSharedImage,
                            api = api,
                            isAuthenticated = user != null
                        )
                        AndroidTab.Postbox -> AndroidLetterList(
                            title = "Postbox",
                            api = api,
                            isAuthenticated = user != null,
                            loadPosts = { api.feed().posts }
                        )
                        AndroidTab.Inbox -> AndroidLetterList(
                            title = "Inbox",
                            api = api,
                            isAuthenticated = user != null,
                            loadPosts = { api.inbox().posts }
                        )
                    }
                }
            }
        }
    }
}

private enum class AndroidTab(val label: String) {
    Write("Write"),
    Postbox("Postbox"),
    Inbox("Inbox")
}

@Composable
private fun AndroidAccountPanel(
    api: CaligraphiaApi,
    user: UserDto?,
    baseUrl: String,
    accountMessage: String,
    onBaseUrlChanged: (String) -> Unit,
    onUserChanged: (UserDto?) -> Unit,
    onMessageChanged: (String) -> Unit
) {
    var email by remember { mutableStateOf("") }
    var tokenOrLink by remember { mutableStateOf("") }
    var isWorking by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFFF4ECDC))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                text = user?.let { "Signed in as ${it.username}" } ?: "Not signed in",
                color = Color(0xFF3B3024),
                modifier = Modifier.weight(1f)
            )
            OutlinedButton(
                onClick = {
                    isWorking = true
                    onMessageChanged("Checking session...")
                }
            ) {
                Text("Refresh")
            }
        }

        LaunchedEffect(isWorking, api) {
            if (!isWorking || accountMessage != "Checking session...") return@LaunchedEffect
            runCatching { api.me() }
                .onSuccess { onUserChanged(it) }
                .onFailure { onMessageChanged(userFacingMessage(it)) }
            isWorking = false
        }

        TextField(
            value = baseUrl,
            onValueChange = onBaseUrlChanged,
            label = { Text("API Base URL") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        if (user == null) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextField(
                    value = email,
                    onValueChange = { email = it },
                    label = { Text("Email") },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    enabled = email.isNotBlank() && !isWorking,
                    onClick = {
                        isWorking = true
                        onMessageChanged("Sending link...")
                    }
                ) {
                    Text("Send")
                }
            }

            LaunchedEffect(isWorking, accountMessage, email, api) {
                if (!isWorking || accountMessage != "Sending link...") return@LaunchedEffect
                runCatching { api.sendMagicLink(email) }
                    .onSuccess { devLink ->
                        if (devLink != null) {
                            tokenOrLink = devLink
                            onMessageChanged("Dev link received. Tap Verify.")
                        } else {
                            onMessageChanged("Magic link sent. Paste token or opened link.")
                        }
                    }
                    .onFailure { onMessageChanged(userFacingMessage(it)) }
                isWorking = false
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextField(
                    value = tokenOrLink,
                    onValueChange = { tokenOrLink = it },
                    label = { Text("Token or magic link") },
                    singleLine = true,
                    modifier = Modifier.weight(1f)
                )
                Button(
                    enabled = tokenOrLink.isNotBlank() && !isWorking,
                    onClick = {
                        isWorking = true
                        onMessageChanged("Verifying...")
                    }
                ) {
                    Text("Verify")
                }
            }

            LaunchedEffect(isWorking, accountMessage, tokenOrLink, api) {
                if (!isWorking || accountMessage != "Verifying...") return@LaunchedEffect
                runCatching { api.verifyMagicLink(tokenFromInput(tokenOrLink)) }
                    .onSuccess { verifiedUser ->
                        if (verifiedUser == null) {
                            onMessageChanged("Signup is needed in the web app first.")
                        } else {
                            onUserChanged(verifiedUser)
                        }
                    }
                    .onFailure { onMessageChanged(userFacingMessage(it)) }
                isWorking = false
            }
        }

        Text(accountMessage, color = Color(0xFF6D6255))
    }
}

@Composable
private fun AndroidLetterList(
    title: String,
    api: CaligraphiaApi,
    isAuthenticated: Boolean,
    loadPosts: suspend () -> List<PostDto>
) {
    var posts by remember { mutableStateOf<List<PostDto>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var selectedPostId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(title, api, isAuthenticated) {
        if (!isAuthenticated) return@LaunchedEffect
        isLoading = true
        errorMessage = null
        runCatching { loadPosts() }
            .onSuccess { posts = it }
            .onFailure { errorMessage = userFacingMessage(it) }
        isLoading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row {
            Text(title, style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            }
        }

        if (!isAuthenticated) {
            Text("Sign in above to load letters.", color = Color(0xFF6D6255))
            return@Column
        }

        if (errorMessage != null) {
            Text(errorMessage!!, color = Color(0xFFB3261E))
        }

        selectedPostId?.let { postId ->
            AndroidPostDetail(postId = postId, api = api, onBack = { selectedPostId = null })
            return@Column
        }

        if (!isLoading && posts.isEmpty() && errorMessage == null) {
            Text("No letters here yet.", color = Color(0xFF6D6255))
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                items(posts, key = { it.id }) { post ->
                    AndroidLetterCard(
                        post = post,
                        api = api,
                        onOpen = { selectedPostId = post.id }
                    )
                }
            }
        }
    }
}

@Composable
private fun AndroidLetterCard(post: PostDto, api: CaligraphiaApi, onOpen: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onOpen)
            .background(Color(0xFFFFFCF6), RoundedCornerShape(8.dp))
            .border(1.dp, Color(0xFFE0D5C0), RoundedCornerShape(8.dp))
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        RemoteLetterImage(url = post.canonicalImageUrl, api = api)

        Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.weight(1f)) {
            Text(post.user?.username ?: "A writer", color = Color(0xFF2C2416))
            Text(post.inkStyle ?: post.postType, color = Color(0xFF6D6255))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("★ ${post.counts.stamps}", color = Color(0xFF6D6255))
                Text("P.S. ${post.counts.comments}", color = Color(0xFF6D6255))
                Text("Scratches ${post.counts.scratches}", color = Color(0xFF6D6255))
            }
        }
    }
}

@Composable
private fun AndroidPostDetail(postId: String, api: CaligraphiaApi, onBack: () -> Unit) {
    var post by remember(postId, api) { mutableStateOf<PostDto?>(null) }
    var isLoading by remember(postId, api) { mutableStateOf(false) }
    var errorMessage by remember(postId, api) { mutableStateOf<String?>(null) }

    LaunchedEffect(postId, api) {
        isLoading = true
        errorMessage = null
        runCatching { api.post(postId) }
            .onSuccess { post = it }
            .onFailure { errorMessage = userFacingMessage(it) }
        isLoading = false
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = onBack) {
                Text("Back")
            }
            Text(
                post?.user?.username ?: "Letter",
                style = MaterialTheme.typography.titleMedium,
                color = Color(0xFF2C2416),
                modifier = Modifier.weight(1f)
            )
            if (isLoading) {
                CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
            }
        }

        if (errorMessage != null) {
            Text(errorMessage!!, color = Color(0xFFB3261E))
        }

        post?.let { letter ->
            RemoteLetterImage(
                url = letter.canonicalImageUrl,
                api = api,
                modifier = Modifier
                    .fillMaxWidth()
                    .aspectRatio(0.72f)
            )

            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFFCF6), RoundedCornerShape(8.dp))
                    .border(1.dp, Color(0xFFE0D5C0), RoundedCornerShape(8.dp))
                    .padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(letter.inkStyle ?: letter.postType, color = Color(0xFF3B3024))
                Text(letter.paperType ?: letter.format, color = Color(0xFF6D6255))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("★ ${letter.counts.stamps}", color = Color(0xFF6D6255))
                    Text("P.S. ${letter.counts.comments}", color = Color(0xFF6D6255))
                    Text("Scratches ${letter.counts.scratches}", color = Color(0xFF6D6255))
                }
                if (letter.ocrHashtags.isNotEmpty()) {
                    Text(letter.ocrHashtags.joinToString(" "), color = Color(0xFF6D6255))
                }
                if (letter.isPrivate) {
                    Text("Private", color = Color(0xFF6D6255))
                }
                if (letter.isDeadLetter) {
                    Text("Dead Letter", color = Color(0xFF6D6255))
                }
            }
        }
    }
}

@Composable
private fun RemoteLetterImage(
    url: String?,
    api: CaligraphiaApi,
    modifier: Modifier = Modifier.size(width = 62.dp, height = 82.dp)
) {
    var bitmap by remember(url, api) { mutableStateOf<Bitmap?>(null) }
    var failed by remember(url, api) { mutableStateOf(false) }

    LaunchedEffect(url, api) {
        failed = false
        bitmap = runCatching { api.loadBitmap(url) }
            .onFailure { failed = true }
            .getOrNull()
    }

    Box(
        modifier = modifier
            .background(Color(0xFFF4ECDC), RoundedCornerShape(6.dp)),
    ) {
        when {
            bitmap != null -> Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = "Letter artwork",
                modifier = Modifier.fillMaxSize()
            )
            failed -> Text("No image", color = Color(0xFF6D6255), modifier = Modifier.padding(6.dp))
            else -> CircularProgressIndicator(modifier = Modifier.padding(20.dp), strokeWidth = 2.dp)
        }
    }
}

@OptIn(ExperimentalComposeUiApi::class)
@Composable
private fun AndroidComposer(
    initialSharedImage: Uri?,
    api: CaligraphiaApi,
    isAuthenticated: Boolean
) {
    val context = LocalContext.current
    val strokes = remember { mutableStateListOf<StrokeData>() }
    var activeStroke by remember { mutableStateOf<StrokeData?>(null) }
    var importedImage by remember { mutableStateOf<Bitmap?>(null) }
    var hint by remember { mutableStateOf("Let the ink flow") }
    var selectedTool by remember { mutableStateOf(DrawingTool.Standard) }
    var selectedColor by remember { mutableStateOf(AndroidColor.rgb(26, 26, 46)) }
    var showCustomColor by remember { mutableStateOf(false) }
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }
    var strokeRevision by remember { mutableStateOf(0) }
    var firstStrokeAt by remember { mutableStateOf<Long?>(null) }
    var lastStrokeAt by remember { mutableStateOf<Long?>(null) }
    var isSending by remember { mutableStateOf(false) }
    var sendMessage by remember { mutableStateOf<String?>(null) }
    var isSendingPhoto by remember { mutableStateOf(false) }
    var photoSendMessage by remember { mutableStateOf<String?>(null) }
    val drawingDurationMs = ((lastStrokeAt ?: firstStrokeAt) ?: 0L) - (firstStrokeAt ?: 0L)
    val canSendCanvas = isAuthenticated &&
        strokes.isNotEmpty() &&
        drawingDurationMs >= MIN_LETTER_DRAW_MS &&
        !isSending

    val photoPicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        importedImage = uri?.let { context.decodeBitmap(it) }
        hint = if (importedImage != null) "Ready to send" else "Let the ink flow"
    }

    LaunchedEffect(initialSharedImage) {
        importedImage = initialSharedImage?.let { context.decodeBitmap(it) }
        if (importedImage != null) {
            hint = "Ready to send"
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            OutlinedButton(
                onClick = {
                    photoPicker.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                    )
                }
            ) {
                Text("Import Photo")
            }

            OutlinedButton(
                enabled = strokes.isNotEmpty() || importedImage != null,
                onClick = {
                    context.shareBitmap(renderLetterBitmap(strokes, importedImage))
                }
            ) {
                Text("Share")
            }

            Button(
                enabled = strokes.isNotEmpty(),
                onClick = {
                    strokes.removeLastOrNull()
                    hint = if (strokes.isEmpty()) "Let the ink flow" else "Ready to send"
                    strokeRevision += 1
                },
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1B1B1B))
            ) {
                Text("Undo")
            }
        }

        ToolPalette(
            selectedTool = selectedTool,
            selectedColor = selectedColor,
            showCustomColor = showCustomColor,
            onToolSelected = { tool ->
                selectedTool = tool
                selectedColor = tool.defaultColor(selectedColor)
            },
            onColorSelected = { color ->
                selectedColor = color
            },
            onToggleCustomColor = {
                showCustomColor = !showCustomColor
            }
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .aspectRatio(0.772f)
                .background(Color(0xFFFCFAF3), RoundedCornerShape(6.dp))
                .onSizeChanged { canvasSize = it }
                .pointerInteropFilter { event ->
                    when (event.actionMasked) {
                        MotionEvent.ACTION_DOWN -> {
                            if (firstStrokeAt == null) {
                                firstStrokeAt = event.eventTime
                            }
                            lastStrokeAt = event.eventTime
                            activeStroke = StrokeData(
                                points = mutableListOf(event.strokePoint(canvasSize)),
                                color = selectedColor,
                                tool = selectedTool
                            )
                            strokeRevision += 1
                            true
                        }
                        MotionEvent.ACTION_MOVE -> {
                            val stroke = activeStroke ?: return@pointerInteropFilter true
                            lastStrokeAt = event.eventTime
                            for (index in 0 until event.historySize) {
                                stroke.points.add(event.strokePoint(canvasSize, index))
                            }
                            stroke.points.add(event.strokePoint(canvasSize))
                            strokeRevision += 1
                            true
                        }
                        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                            val durationNow = event.eventTime - (firstStrokeAt ?: event.eventTime)
                            lastStrokeAt = event.eventTime
                            activeStroke?.let { stroke ->
                                if (stroke.points.isNotEmpty()) {
                                    strokes.add(stroke)
                                    hint = readinessHint(
                                        hasStrokes = strokes.isNotEmpty(),
                                        hasImportedImage = importedImage != null,
                                        drawingDurationMs = durationNow
                                    )
                                    strokeRevision += 1
                                }
                            }
                            activeStroke = null
                            true
                        }
                        else -> true
                    }
                }
        ) {
            LetterCanvas(
                strokes = strokes,
                activeStroke = activeStroke,
                importedImage = importedImage,
                revision = strokeRevision
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row {
                Text(hint, color = Color(0xFF6D6255), modifier = Modifier.weight(1f))
                Button(
                    enabled = strokes.isNotEmpty() || importedImage != null,
                    onClick = {
                        context.shareBitmap(renderLetterBitmap(strokes, importedImage))
                    }
                ) {
                    Text("Share")
                }
                Spacer(modifier = Modifier.width(8.dp))
                Button(
                    enabled = canSendCanvas,
                    onClick = {
                        isSending = true
                        sendMessage = "Sending..."
                    }
                ) {
                    Text(if (isSending) "Sending..." else "Send")
                }
            }

            if (importedImage != null) {
                Button(
                    enabled = isAuthenticated && !isSendingPhoto,
                    onClick = {
                        isSendingPhoto = true
                        photoSendMessage = "Sending photo..."
                    }
                ) {
                    Text(if (isSendingPhoto) "Sending photo..." else "Send Photo Letter")
                }
            }

            LaunchedEffect(isSending, sendMessage, strokes.size, drawingDurationMs, api) {
                if (!isSending || sendMessage != "Sending...") return@LaunchedEffect
                val snapshot = strokes.toList()
                runCatching {
                    api.createCanvasPost(
                        snapshot.toCanvasPostPayload(drawingDurationMs = drawingDurationMs)
                    )
                }
                    .onSuccess { post -> sendMessage = "Sent to postbox: ${post.id}" }
                    .onFailure { sendMessage = userFacingMessage(it) }
                isSending = false
            }

            LaunchedEffect(isSendingPhoto, photoSendMessage, importedImage, api) {
                val bitmap = importedImage
                if (!isSendingPhoto || photoSendMessage != "Sending photo..." || bitmap == null) {
                    return@LaunchedEffect
                }
                runCatching {
                    api.createPhotoPost(bitmap.toPngBytes())
                }
                    .onSuccess { post -> photoSendMessage = "Photo letter sent: ${post.id}" }
                    .onFailure { photoSendMessage = userFacingMessage(it) }
                isSendingPhoto = false
            }

            if (!isAuthenticated) {
                Text("Sign in above to send through Caligraphia.", color = Color(0xFF6D6255))
            } else if (strokes.isNotEmpty() && drawingDurationMs < MIN_LETTER_DRAW_MS) {
                Text("Keep writing before sending.", color = Color(0xFF6D6255))
            }
            sendMessage?.let {
                Text(it, color = if (it.startsWith("Sent")) Color(0xFF1E8449) else Color(0xFF6D6255))
            }
            photoSendMessage?.let {
                Text(it, color = if (it.contains("sent", ignoreCase = true)) Color(0xFF1E8449) else Color(0xFF6D6255))
            }
        }
    }
}

@Composable
private fun ToolPalette(
    selectedTool: DrawingTool,
    selectedColor: Int,
    showCustomColor: Boolean,
    onToolSelected: (DrawingTool) -> Unit,
    onColorSelected: (Int) -> Unit,
    onToggleCustomColor: () -> Unit
) {
    val swatches = listOf(
        AndroidColor.rgb(26, 26, 46),
        AndroidColor.rgb(192, 57, 43),
        AndroidColor.rgb(36, 113, 163),
        AndroidColor.rgb(39, 174, 96),
        AndroidColor.rgb(142, 68, 173),
        AndroidColor.rgb(111, 78, 55),
        AndroidColor.rgb(212, 175, 55),
        AndroidColor.rgb(255, 241, 168)
    )

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            DrawingTool.entries.forEach { tool ->
                OutlinedButton(
                    onClick = { onToolSelected(tool) },
                    enabled = true,
                    colors = ButtonDefaults.outlinedButtonColors(
                        containerColor = if (tool == selectedTool) Color(0xFFEDE4D4) else Color.Transparent
                    )
                ) {
                    Text(tool.label)
                }
            }
        }

        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            swatches.forEach { color ->
                Button(
                    onClick = { onColorSelected(color) },
                    modifier = Modifier
                        .size(34.dp)
                        .border(
                            width = if (color == selectedColor) 3.dp else 1.dp,
                            color = if (color == selectedColor) Color(0xFF1B1B1B) else Color(0x55222222),
                            shape = CircleShape
                        ),
                    shape = CircleShape,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(color)),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)
                ) {}
            }

            OutlinedButton(onClick = onToggleCustomColor) {
                Text("Custom")
            }
        }

        if (showCustomColor) {
            CustomColorControls(color = selectedColor, onColorSelected = onColorSelected)
        }
    }
}

@Composable
private fun CustomColorControls(color: Int, onColorSelected: (Int) -> Unit) {
    fun channel(shift: Int): Float = ((color shr shift) and 0xFF).toFloat()
    var red by remember(color) { mutableStateOf(channel(16)) }
    var green by remember(color) { mutableStateOf(channel(8)) }
    var blue by remember(color) { mutableStateOf(channel(0)) }

    fun updateColor() {
        onColorSelected(AndroidColor.rgb(red.toInt(), green.toInt(), blue.toInt()))
    }

    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        ColorSlider(label = "R", value = red, onValueChange = {
            red = it
            updateColor()
        })
        ColorSlider(label = "G", value = green, onValueChange = {
            green = it
            updateColor()
        })
        ColorSlider(label = "B", value = blue, onValueChange = {
            blue = it
            updateColor()
        })
    }
}

@Composable
private fun ColorSlider(label: String, value: Float, onValueChange: (Float) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, modifier = Modifier.weight(0.1f), color = Color(0xFF6D6255))
        Slider(
            value = value,
            onValueChange = onValueChange,
            valueRange = 0f..255f,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun LetterCanvas(
    strokes: List<StrokeData>,
    activeStroke: StrokeData?,
    importedImage: Bitmap?,
    revision: Int
) {
    @Suppress("UNUSED_VARIABLE")
    val redrawKey = revision

    if (importedImage != null) {
        Image(
            bitmap = importedImage.asImageBitmap(),
            contentDescription = "Imported drawing",
            modifier = Modifier.fillMaxSize()
        )
    }

    Canvas(modifier = Modifier.fillMaxSize()) {
        val lineColor = Color(0xFFE7DEC8)
        var y = 34.dp.toPx()
        while (y < size.height) {
            drawLine(lineColor, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
            y += 24.dp.toPx()
        }

        drawLine(
            Color(0x44B85050),
            Offset(size.width * 0.1f, 0f),
            Offset(size.width * 0.1f, size.height),
            strokeWidth = 1f
        )

        (strokes + listOfNotNull(activeStroke)).forEach { stroke ->
            drawStroke(stroke)
        }
    }
}

data class StrokeData(
    val points: MutableList<StrokePoint>,
    val color: Int,
    val tool: DrawingTool
)

data class StrokePoint(
    val x: Float,
    val y: Float,
    val pressure: Float,
    val time: Long
)

enum class DrawingTool(val apiId: String, val label: String) {
    Standard("standard", "Standard"),
    Runny("runny", "Runny"),
    Quill("quill", "Quill"),
    Calligraphy("calligraphy", "Calligraphy"),
    Italic("italic", "Italic"),
    Blackletter("blackletter", "Blackletter"),
    Copperplate("copperplate", "Copperplate"),
    Brush("brush", "Brush"),
    Watercolor("watercolor", "Watercolor"),
    GoldLeaf("goldLeaf", "Gold Leaf"),
    Illumination("illumination", "Illumine");

    fun defaultColor(currentColor: Int): Int =
        when (this) {
            GoldLeaf -> AndroidColor.rgb(212, 175, 55)
            Illumination -> AndroidColor.rgb(166, 20, 28)
            Watercolor -> if (currentColor == AndroidColor.rgb(26, 26, 46)) {
                AndroidColor.rgb(36, 113, 163)
            } else {
                currentColor
            }
            Calligraphy -> AndroidColor.rgb(55, 35, 24)
            else -> currentColor
        }
}

private fun DrawScope.drawStroke(stroke: StrokeData) {
    stroke.points.zipWithNext { first, second ->
        drawToolSegment(
            stroke.tool,
            Color(stroke.color),
            Offset(first.x * size.width, first.y * size.height),
            Offset(second.x * size.width, second.y * size.height),
            first.pressure,
            second.pressure
        )
    }
}

private fun DrawScope.drawToolSegment(
    tool: DrawingTool,
    color: Color,
    start: Offset,
    end: Offset,
    p1: Float,
    p2: Float
) {
    val dx = end.x - start.x
    val dy = end.y - start.y
    val distance = max(1f, sqrt(dx * dx + dy * dy))
    val pressure = ((p1 + p2) / 2f).coerceIn(0.1f, 1f)
    val width = when (tool) {
        DrawingTool.Standard -> max(2f, pressure * 10f)
        DrawingTool.Runny -> max(1.5f, pressure * 14f)
        DrawingTool.Quill -> max(1.2f, pressure * 6f)
        DrawingTool.Calligraphy -> max(5f, pressure * 18f)
        DrawingTool.Italic -> max(4f, pressure * 16f)
        DrawingTool.Blackletter -> max(7f, pressure * 23f)
        DrawingTool.Copperplate -> max(0.8f, pressure * 18f)
        DrawingTool.Brush -> max(2f, pressure * 26f * min(1.2f, 220f / (distance + 10f)))
        DrawingTool.Watercolor -> max(10f, pressure * 36f)
        DrawingTool.GoldLeaf -> max(5f, pressure * 24f)
        DrawingTool.Illumination -> max(8f, pressure * 28f)
    }

    when (tool) {
        DrawingTool.Watercolor -> {
            val offsets = listOf(-0.18f, 0f, 0.16f)
            offsets.forEachIndexed { index, offset ->
                drawLine(
                    color = color.copy(alpha = 0.13f + index * 0.04f),
                    start = start + Offset(width * offset, width * offset * 0.35f),
                    end = end + Offset(width * offset * -0.35f, width * offset),
                    strokeWidth = width * (0.72f + index * 0.15f),
                    cap = StrokeCap.Round
                )
            }
        }
        DrawingTool.GoldLeaf -> {
            drawLine(Color(0xFF6D4B10).copy(alpha = 0.45f), start, end, width * 1.18f, StrokeCap.Round)
            drawLine(color, start, end, width, StrokeCap.Round)
            drawLine(Color(0xFFFFF4AD).copy(alpha = 0.58f), start, end, max(1f, width * 0.22f), StrokeCap.Round)
        }
        DrawingTool.Illumination -> {
            drawLine(color.copy(alpha = 0.82f), start, end, width, StrokeCap.Round)
            drawLine(Color(0xFFD4AF37).copy(alpha = 0.78f), start, end, max(2f, width * 0.28f), StrokeCap.Round)
        }
        DrawingTool.Italic, DrawingTool.Blackletter, DrawingTool.Calligraphy -> {
            drawLine(color.copy(alpha = 0.92f), start, end, width, StrokeCap.Square)
            drawLine(color.copy(alpha = 0.55f), start, end, max(1f, width * 0.18f), StrokeCap.Round)
        }
        DrawingTool.Copperplate -> {
            drawLine(color.copy(alpha = 0.94f), start, end, width, StrokeCap.Round)
        }
        DrawingTool.Brush -> {
            drawLine(color.copy(alpha = 0.74f + pressure * 0.2f), start, end, width, StrokeCap.Round)
        }
        DrawingTool.Quill -> {
            drawLine(color.copy(alpha = 0.82f), start, end, width, StrokeCap.Round)
        }
        DrawingTool.Runny -> {
            drawLine(color.copy(alpha = 0.74f), start, end, width, StrokeCap.Round)
            drawLine(color.copy(alpha = 0.22f), start + Offset(0f, width * 0.45f), end + Offset(0f, width * 0.65f), max(1f, width * 0.35f), StrokeCap.Round)
        }
        DrawingTool.Standard -> {
            drawLine(color, start, end, width, StrokeCap.Round)
        }
    }
}

private fun MotionEvent.strokePoint(canvasSize: IntSize, historyIndex: Int? = null): StrokePoint {
    val xValue = historyIndex?.let { getHistoricalX(it) } ?: x
    val yValue = historyIndex?.let { getHistoricalY(it) } ?: y
    val pressureValue = historyIndex?.let { getHistoricalPressure(it) } ?: pressure
    val timeValue = historyIndex?.let { getHistoricalEventTime(it) } ?: eventTime
    val safeWidth = max(1, canvasSize.width).toFloat()
    val safeHeight = max(1, canvasSize.height).toFloat()

    return StrokePoint(
        x = (xValue / safeWidth).coerceIn(0f, 1f),
        y = (yValue / safeHeight).coerceIn(0f, 1f),
        pressure = pressureValue.coerceIn(0.1f, 1f),
        time = timeValue
    )
}

private fun readinessHint(
    hasStrokes: Boolean,
    hasImportedImage: Boolean,
    drawingDurationMs: Long
): String {
    if (hasImportedImage) return "Ready to send"
    if (!hasStrokes) return "Let the ink flow"
    val remainingSeconds = ((MIN_LETTER_DRAW_MS - drawingDurationMs).coerceAtLeast(0L) + 999L) / 1000L
    return if (remainingSeconds == 0L) "Ready to send" else "Keep writing ${remainingSeconds}s"
}

private fun Intent.sharedImageUri(): Uri? {
    if (action != Intent.ACTION_SEND) return null
    if (type?.startsWith("image/") != true) return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
    } else {
        @Suppress("DEPRECATION")
        getParcelableExtra(Intent.EXTRA_STREAM) as? Uri
    }
}

private fun Context.decodeBitmap(uri: Uri): Bitmap? =
    contentResolver.openInputStream(uri)?.use(BitmapFactory::decodeStream)

private fun renderLetterBitmap(strokes: List<StrokeData>, importedImage: Bitmap?): Bitmap {
    val width = 1600
    val height = 2071
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    val canvas = AndroidCanvas(bitmap)
    canvas.drawColor(AndroidColor.rgb(252, 250, 243))

    importedImage?.let {
        val dest = android.graphics.Rect(0, 0, width, height)
        canvas.drawBitmap(it, null, dest, null)
    }

    val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = AndroidColor.rgb(231, 222, 200)
        strokeWidth = 2f
    }
    var y = 80f
    while (y < height) {
        canvas.drawLine(0f, y, width.toFloat(), y, linePaint)
        y += 58f
    }

    val inkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
    }

    strokes.forEach { stroke ->
        inkPaint.color = stroke.color
        stroke.points.zipWithNext { first, second ->
            renderAndroidToolSegment(
                canvas = canvas,
                paint = inkPaint,
                tool = stroke.tool,
                color = stroke.color,
                x1 = first.x * width,
                y1 = first.y * height,
                x2 = second.x * width,
                y2 = second.y * height,
                p1 = first.pressure,
                p2 = second.pressure
            )
        }
    }

    return bitmap
}

private fun renderAndroidToolSegment(
    canvas: AndroidCanvas,
    paint: Paint,
    tool: DrawingTool,
    color: Int,
    x1: Float,
    y1: Float,
    x2: Float,
    y2: Float,
    p1: Float,
    p2: Float
) {
    val dx = x2 - x1
    val dy = y2 - y1
    val distance = max(1f, sqrt(dx * dx + dy * dy))
    val pressure = ((p1 + p2) / 2f).coerceIn(0.1f, 1f)
    val width = when (tool) {
        DrawingTool.Standard -> max(3f, pressure * 18f)
        DrawingTool.Runny -> max(3f, pressure * 24f)
        DrawingTool.Quill -> max(2f, pressure * 10f)
        DrawingTool.Calligraphy -> max(8f, pressure * 32f)
        DrawingTool.Italic -> max(7f, pressure * 28f)
        DrawingTool.Blackletter -> max(10f, pressure * 38f)
        DrawingTool.Copperplate -> max(1f, pressure * 30f)
        DrawingTool.Brush -> max(4f, pressure * 44f * min(1.2f, 420f / (distance + 18f)))
        DrawingTool.Watercolor -> max(16f, pressure * 58f)
        DrawingTool.GoldLeaf -> max(8f, pressure * 38f)
        DrawingTool.Illumination -> max(12f, pressure * 44f)
    }

    fun drawLine(lineColor: Int, alpha: Int, strokeWidth: Float, cap: Paint.Cap = Paint.Cap.ROUND) {
        paint.color = lineColor
        paint.alpha = alpha.coerceIn(0, 255)
        paint.strokeWidth = strokeWidth
        paint.strokeCap = cap
        canvas.drawLine(x1, y1, x2, y2, paint)
    }

    when (tool) {
        DrawingTool.Watercolor -> {
            val offsets = listOf(-0.18f, 0f, 0.16f)
            offsets.forEachIndexed { index, offset ->
                paint.color = color
                paint.alpha = 34 + index * 10
                paint.strokeWidth = width * (0.72f + index * 0.15f)
                paint.strokeCap = Paint.Cap.ROUND
                canvas.drawLine(
                    x1 + width * offset,
                    y1 + width * offset * 0.35f,
                    x2 + width * offset * -0.35f,
                    y2 + width * offset,
                    paint
                )
            }
        }
        DrawingTool.GoldLeaf -> {
            drawLine(AndroidColor.rgb(109, 75, 16), 115, width * 1.18f)
            drawLine(color, 232, width)
            drawLine(AndroidColor.rgb(255, 244, 173), 148, max(1f, width * 0.22f))
        }
        DrawingTool.Illumination -> {
            drawLine(color, 210, width)
            drawLine(AndroidColor.rgb(212, 175, 55), 200, max(2f, width * 0.28f))
        }
        DrawingTool.Italic, DrawingTool.Blackletter, DrawingTool.Calligraphy -> {
            drawLine(color, 235, width, Paint.Cap.SQUARE)
            drawLine(color, 140, max(1f, width * 0.18f))
        }
        DrawingTool.Copperplate -> drawLine(color, 240, width)
        DrawingTool.Brush -> drawLine(color, (188 + pressure * 52).toInt(), width)
        DrawingTool.Quill -> drawLine(color, 210, width)
        DrawingTool.Runny -> {
            drawLine(color, 188, width)
            drawLine(color, 56, max(1f, width * 0.35f))
        }
        DrawingTool.Standard -> drawLine(color, 255, width)
    }

    paint.alpha = 255
}

private fun tokenFromInput(input: String): String {
    val trimmed = input.trim()
    val parsed = runCatching { Uri.parse(trimmed) }.getOrNull()
    return parsed?.getQueryParameter("token") ?: trimmed
}

private fun userFacingMessage(error: Throwable): String =
    when (error) {
        is CaligraphiaApiException -> {
            if (error.status == 401) "Not authenticated. Sign in and try again." else error.message
        }
        else -> error.message ?: "Something went wrong."
    }

private fun Context.shareBitmap(bitmap: Bitmap) {
    val directory = File(cacheDir, "shared").apply { mkdirs() }
    val file = File(directory, "caligraphia-letter-${System.currentTimeMillis()}.png")
    FileOutputStream(file).use { output ->
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
    }

    val uri = FileProvider.getUriForFile(this, "$packageName.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "image/png"
        putExtra(Intent.EXTRA_STREAM, uri)
        clipData = ClipData.newUri(contentResolver, "Caligraphia letter", uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    startActivity(Intent.createChooser(intent, "Share letter"))
}

private fun Bitmap.toPngBytes(): ByteArray {
    val output = ByteArrayOutputStream()
    compress(Bitmap.CompressFormat.PNG, 100, output)
    return output.toByteArray()
}
