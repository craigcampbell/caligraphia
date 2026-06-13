package com.caligraphia.mobile.model

data class PostCountsDto(
    val scratches: Int = 0,
    val comments: Int = 0,
    val interactions: Int = 0,
    val stamps: Int = 0
)

data class UserDto(
    val id: String,
    val username: String,
    val nomDePlume: String? = null
)

data class PostDto(
    val id: String,
    val userId: String,
    val postType: String,
    val imageUrl: String? = null,
    val finalImageUrl: String? = null,
    val uploadedPhotoUrl: String? = null,
    val paperType: String? = null,
    val inkStyle: String? = null,
    val stampCount: Int = 0,
    val recipientId: String? = null,
    val isPrivate: Boolean = false,
    val needsReview: Boolean = false,
    val format: String = "letter",
    val deliverAt: String? = null,
    val isDeadLetter: Boolean = false,
    val ocrText: String? = null,
    val ocrHashtags: List<String> = emptyList(),
    val createdAt: String,
    val deletedAt: String? = null,
    val user: UserDto? = null,
    val counts: PostCountsDto = PostCountsDto()
) {
    val canonicalImageUrl: String?
        get() = imageUrl ?: finalImageUrl ?: uploadedPhotoUrl
}

data class FeedResponseDto(
    val posts: List<PostDto>,
    val nextCursor: String? = null
)

data class InboxResponseDto(
    val posts: List<PostDto>,
    val nextCursor: String? = null,
    val unreadCount: Int = 0
)
