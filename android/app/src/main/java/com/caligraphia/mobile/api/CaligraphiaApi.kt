package com.caligraphia.mobile.api

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.caligraphia.mobile.model.FeedResponseDto
import com.caligraphia.mobile.model.InboxResponseDto
import com.caligraphia.mobile.model.PostCountsDto
import com.caligraphia.mobile.model.PostDto
import com.caligraphia.mobile.model.UserDto
import com.caligraphia.mobile.posting.CanvasPostPayload
import java.net.CookieHandler
import java.net.CookieManager
import java.net.CookiePolicy
import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

class CaligraphiaApi(private val baseUrl: String) {
    init {
        if (CookieHandler.getDefault() == null) {
            CookieHandler.setDefault(CookieManager(null, CookiePolicy.ACCEPT_ALL))
        }
    }

    suspend fun me(): UserDto = withContext(Dispatchers.IO) {
        parseUser(requestJson("/api/auth/me").getJSONObject("user"))
    }

    suspend fun sendMagicLink(email: String): String? = withContext(Dispatchers.IO) {
        val response = requestJson(
            path = "/api/auth/send-magic-link",
            method = "POST",
            body = JSONObject().put("email", email)
        )
        response.optNullableString("devMagicLink")
    }

    suspend fun verifyMagicLink(token: String): UserDto? = withContext(Dispatchers.IO) {
        val response = requestJson(
            path = "/api/auth/verify-magic-link",
            method = "POST",
            body = JSONObject().put("token", token)
        )
        if (response.optBoolean("needsSignup", false)) {
            null
        } else {
            response.optJSONObject("user")?.let(::parseUser)
        }
    }

    suspend fun feed(limit: Int = 40): FeedResponseDto = withContext(Dispatchers.IO) {
        val response = requestJson("/api/posts?limit=$limit")
        FeedResponseDto(
            posts = response.getJSONArray("posts").toPostList(),
            nextCursor = response.optNullableString("nextCursor")
        )
    }

    suspend fun inbox(limit: Int = 40): InboxResponseDto = withContext(Dispatchers.IO) {
        val response = requestJson("/api/posts/inbox?limit=$limit")
        InboxResponseDto(
            posts = response.getJSONArray("posts").toPostList(),
            nextCursor = response.optNullableString("nextCursor"),
            unreadCount = response.optInt("unreadCount", 0)
        )
    }

    suspend fun post(id: String): PostDto = withContext(Dispatchers.IO) {
        requestJson("/api/posts/$id").getJSONObject("post").toPost()
    }

    suspend fun createCanvasPost(payload: CanvasPostPayload): PostDto = withContext(Dispatchers.IO) {
        requestJson(
            path = "/api/posts",
            method = "POST",
            body = payload.toBackendMap().toJsonObject()
        ).getJSONObject("post").toPost()
    }

    suspend fun createPhotoPost(
        imageBytes: ByteArray,
        filename: String = "caligraphia-photo.png",
        mimeType: String = "image/png"
    ): PostDto = withContext(Dispatchers.IO) {
        val boundary = "Boundary-${System.currentTimeMillis()}"
        val connection = URL(resolve("/api/posts")).openConnection() as HttpURLConnection
        connection.requestMethod = "POST"
        connection.doOutput = true
        connection.connectTimeout = 10_000
        connection.readTimeout = 30_000
        connection.setRequestProperty("Accept", "application/json")
        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=$boundary")

        connection.outputStream.use { output ->
            output.write("--$boundary\r\n".toByteArray())
            output.write("Content-Disposition: form-data; name=\"photo\"; filename=\"$filename\"\r\n".toByteArray())
            output.write("Content-Type: $mimeType\r\n\r\n".toByteArray())
            output.write(imageBytes)
            output.write("\r\n--$boundary--\r\n".toByteArray())
        }

        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (status !in 200..299) {
            val message = runCatching { JSONObject(text).optString("error") }.getOrNull()
            throw CaligraphiaApiException(status, message ?: "HTTP $status")
        }
        JSONObject(text).getJSONObject("post").toPost()
    }

    suspend fun loadBitmap(urlOrPath: String?): Bitmap? = withContext(Dispatchers.IO) {
        if (urlOrPath.isNullOrBlank()) return@withContext null
        val connection = URL(resolve(urlOrPath)).openConnection() as HttpURLConnection
        connection.requestMethod = "GET"
        connection.connectTimeout = 10_000
        connection.readTimeout = 20_000
        connection.inputStream.use(BitmapFactory::decodeStream)
    }

    private fun requestJson(
        path: String,
        method: String = "GET",
        body: JSONObject? = null
    ): JSONObject {
        val connection = URL(resolve(path)).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.setRequestProperty("Accept", "application/json")
        connection.connectTimeout = 10_000
        connection.readTimeout = 20_000

        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { output ->
                output.write(body.toString().toByteArray(Charsets.UTF_8))
            }
        }

        val status = connection.responseCode
        val stream = if (status in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        if (status !in 200..299) {
            val message = runCatching { JSONObject(text).optString("error") }.getOrNull()
            throw CaligraphiaApiException(status, message ?: "HTTP $status")
        }
        return if (text.isBlank()) JSONObject() else JSONObject(text)
    }

    private fun resolve(pathOrUrl: String): String {
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
            return pathOrUrl
        }
        return baseUrl.trimEnd('/') + "/" + pathOrUrl.trimStart('/')
    }

    private fun JSONArray.toPostList(): List<PostDto> =
        List(length()) { index -> getJSONObject(index).toPost() }

    private fun JSONObject.toPost(): PostDto {
        val countsJson = optJSONObject("counts") ?: optJSONObject("_count")
        return PostDto(
            id = getString("id"),
            userId = getString("userId"),
            postType = optString("postType", "canvas"),
            imageUrl = optNullableString("imageUrl"),
            finalImageUrl = optNullableString("finalImageUrl"),
            uploadedPhotoUrl = optNullableString("uploadedPhotoUrl"),
            paperType = optNullableString("paperType"),
            inkStyle = optNullableString("inkStyle"),
            stampCount = optInt("stampCount", 0),
            recipientId = optNullableString("recipientId"),
            isPrivate = optBoolean("isPrivate", false),
            needsReview = optBoolean("needsReview", false),
            format = optString("format", "letter"),
            deliverAt = optNullableString("deliverAt"),
            isDeadLetter = optBoolean("isDeadLetter", false),
            ocrText = optNullableString("ocrText"),
            ocrHashtags = optJSONArray("ocrHashtags")?.toStringList().orEmpty(),
            createdAt = optString("createdAt", ""),
            deletedAt = optNullableString("deletedAt"),
            user = optJSONObject("user")?.let(::parseUser),
            counts = countsJson?.toCounts() ?: PostCountsDto(stamps = optInt("stampCount", 0))
        )
    }

    private fun JSONObject.toCounts(): PostCountsDto =
        PostCountsDto(
            scratches = optInt("scratches", 0),
            comments = optInt("comments", 0),
            interactions = optInt("interactions", 0),
            stamps = optInt("stamps", 0)
        )

    private fun JSONArray.toStringList(): List<String> =
        List(length()) { index -> optString(index) }.filter { it.isNotBlank() }

    private fun parseUser(json: JSONObject): UserDto =
        UserDto(
            id = json.getString("id"),
            username = json.optString("username", "writer"),
            nomDePlume = json.optNullableString("nomDePlume")
        )

    private fun JSONObject.optNullableString(name: String): String? =
        if (has(name) && !isNull(name)) optString(name).takeIf { it.isNotBlank() } else null

    private fun Map<String, Any?>.toJsonObject(): JSONObject {
        val json = JSONObject()
        forEach { (key, value) ->
            json.put(key, value.toJsonValue())
        }
        return json
    }

    private fun Any?.toJsonValue(): Any? =
        when (this) {
            is Map<*, *> -> {
                val json = JSONObject()
                forEach { (key, value) ->
                    if (key is String) {
                        json.put(key, value.toJsonValue())
                    }
                }
                json
            }
            is Iterable<*> -> JSONArray().also { array ->
                forEach { item -> array.put(item.toJsonValue()) }
            }
            else -> this
        }
}

class CaligraphiaApiException(
    val status: Int,
    override val message: String
) : Exception(message)
