package com.caligraphia.mobile.posting

import android.graphics.Color
import com.caligraphia.mobile.DrawingTool
import com.caligraphia.mobile.StrokeData

const val MIN_LETTER_DRAW_MS = 15_000L
const val MIN_POSTCARD_DRAW_MS = 8_000L

data class CanvasPostStrokePoint(
    val time: Long,
    val x: Float,
    val y: Float,
    val pressure: Float,
    val color: String,
    val ink: String
)

data class CanvasPostPayload(
    val canvasStrokeData: List<CanvasPostStrokePoint>,
    val drawingDurationMs: Long,
    val paper: String = "ruled",
    val inkStyle: String = "standard",
    val format: String = "letter",
    val recipientId: String? = null,
    val isPrivate: Boolean = false,
    val isDeadLetter: Boolean = false,
    val delivery: String? = null
) {
    fun toBackendMap(): Map<String, Any?> = mapOf(
        "canvas_stroke_data" to canvasStrokeData.map { it.toBackendMap() },
        "drawing_duration_ms" to drawingDurationMs,
        "paper" to paper,
        "ink_style" to inkStyle,
        "format" to format,
        "recipient_id" to recipientId,
        "is_private" to isPrivate,
        "is_dead_letter" to isDeadLetter,
        "delivery" to delivery
    ).filterValues { it != null }
}

fun List<StrokeData>.toCanvasPostPayload(
    drawingDurationMs: Long,
    paper: String = "ruled",
    format: String = "letter",
    recipientId: String? = null,
    isPrivate: Boolean = false,
    isDeadLetter: Boolean = false,
    delivery: String? = null
): CanvasPostPayload {
    val flattened = flatMap { stroke ->
        stroke.points.map { point ->
            CanvasPostStrokePoint(
                time = point.time,
                x = point.x,
                y = point.y,
                pressure = point.pressure,
                color = stroke.color.toHexColor(),
                ink = stroke.tool.apiId
            )
        }
    }
    val primaryInk = lastOrNull()?.tool?.apiId ?: DrawingTool.Standard.apiId

    return CanvasPostPayload(
        canvasStrokeData = flattened,
        drawingDurationMs = drawingDurationMs,
        paper = paper,
        inkStyle = primaryInk,
        format = format,
        recipientId = recipientId,
        isPrivate = isPrivate || recipientId != null || isDeadLetter,
        isDeadLetter = isDeadLetter,
        delivery = delivery
    )
}

private fun CanvasPostStrokePoint.toBackendMap(): Map<String, Any> = mapOf(
    "time" to time,
    "x" to x,
    "y" to y,
    "pressure" to pressure,
    "color" to color,
    "ink" to ink
)

private fun Int.toHexColor(): String =
    "#%02x%02x%02x".format(Color.red(this), Color.green(this), Color.blue(this))
