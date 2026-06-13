import Foundation

public enum PostType: String, Codable, Sendable {
    case canvas
    case photo
}

public enum LetterFormat: String, Codable, Sendable {
    case letter
    case postcard
}

public enum PaperPreset: String, Codable, CaseIterable, Identifiable, Sendable {
    case blank
    case ruled
    case graph
    case watercolor
    case vellum
    case midnight

    public var id: String { rawValue }
}

public enum InkPreset: String, Codable, CaseIterable, Identifiable, Sendable {
    case standard
    case runny
    case quill
    case calligraphy
    case italic
    case blackletter
    case copperplate
    case brush
    case watercolor
    case goldLeaf
    case illumination

    public var id: String { rawValue }

    public var displayName: String {
        switch self {
        case .standard: "Standard"
        case .runny: "Runny"
        case .quill: "Quill"
        case .calligraphy: "Callig."
        case .italic: "Italic"
        case .blackletter: "Blackletter"
        case .copperplate: "Copperplate"
        case .brush: "Brush"
        case .watercolor: "Watercolor"
        case .goldLeaf: "Gold Leaf"
        case .illumination: "Illumine"
        }
    }
}

public struct CaligraphiaUser: Codable, Identifiable, Equatable, Sendable {
    public let id: String
    public let username: String
    public let nomDePlume: String?
    public let stampBalance: Int?
    public let stampRefillAt: Date?
    public let totalStampsEarned: Int?
    public let createdAt: Date?

    public init(
        id: String,
        username: String,
        nomDePlume: String? = nil,
        stampBalance: Int? = nil,
        stampRefillAt: Date? = nil,
        totalStampsEarned: Int? = nil,
        createdAt: Date? = nil
    ) {
        self.id = id
        self.username = username
        self.nomDePlume = nomDePlume
        self.stampBalance = stampBalance
        self.stampRefillAt = stampRefillAt
        self.totalStampsEarned = totalStampsEarned
        self.createdAt = createdAt
    }
}

public struct PostCounts: Codable, Equatable, Sendable {
    public let scratches: Int?
    public let comments: Int?
    public let interactions: Int?
    public let stamps: Int?

    public init(
        scratches: Int? = nil,
        comments: Int? = nil,
        interactions: Int? = nil,
        stamps: Int? = nil
    ) {
        self.scratches = scratches
        self.comments = comments
        self.interactions = interactions
        self.stamps = stamps
    }
}

public struct CaligraphiaPost: Decodable, Identifiable, Equatable, Sendable {
    public let id: String
    public let userId: String
    public let postType: PostType
    public let paperType: String?
    public let inkStyle: String?
    public let imageUrl: String?
    public let finalImageUrl: String?
    public let uploadedPhotoUrl: String?
    public let stampCount: Int
    public let recipientId: String?
    public let isPrivate: Bool
    public let needsReview: Bool?
    public let format: LetterFormat?
    public let deliverAt: Date?
    public let isDeadLetter: Bool?
    public let ocrText: String?
    public let ocrHashtags: [String]
    public let createdAt: Date
    public let deletedAt: Date?
    public let user: CaligraphiaUser?
    public let counts: PostCounts?
    public let stamped: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case userId
        case postType
        case paperType
        case inkStyle
        case imageUrl
        case finalImageUrl
        case uploadedPhotoUrl
        case stampCount
        case recipientId
        case isPrivate
        case needsReview
        case format
        case deliverAt
        case isDeadLetter
        case ocrText
        case ocrHashtags
        case createdAt
        case deletedAt
        case user
        case counts
        case legacyCounts = "_count"
        case stamped
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        id = try container.decode(String.self, forKey: .id)
        userId = try container.decode(String.self, forKey: .userId)
        postType = try container.decode(PostType.self, forKey: .postType)
        paperType = try container.decodeIfPresent(String.self, forKey: .paperType)
        inkStyle = try container.decodeIfPresent(String.self, forKey: .inkStyle)
        imageUrl = try container.decodeIfPresent(String.self, forKey: .imageUrl)
        finalImageUrl = try container.decodeIfPresent(String.self, forKey: .finalImageUrl)
        uploadedPhotoUrl = try container.decodeIfPresent(String.self, forKey: .uploadedPhotoUrl)
        stampCount = try container.decodeIfPresent(Int.self, forKey: .stampCount) ?? 0
        recipientId = try container.decodeIfPresent(String.self, forKey: .recipientId)
        isPrivate = try container.decodeIfPresent(Bool.self, forKey: .isPrivate) ?? false
        needsReview = try container.decodeIfPresent(Bool.self, forKey: .needsReview)
        format = try container.decodeIfPresent(LetterFormat.self, forKey: .format)
        deliverAt = try container.decodeIfPresent(Date.self, forKey: .deliverAt)
        isDeadLetter = try container.decodeIfPresent(Bool.self, forKey: .isDeadLetter)
        ocrText = try container.decodeIfPresent(String.self, forKey: .ocrText)
        ocrHashtags = try container.decodeIfPresent([String].self, forKey: .ocrHashtags) ?? []
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        deletedAt = try container.decodeIfPresent(Date.self, forKey: .deletedAt)
        user = try container.decodeIfPresent(CaligraphiaUser.self, forKey: .user)
        counts = try container.decodeIfPresent(PostCounts.self, forKey: .counts)
            ?? container.decodeIfPresent(PostCounts.self, forKey: .legacyCounts)
        stamped = try container.decodeIfPresent(Bool.self, forKey: .stamped)
    }
}

public struct FeedResponse: Decodable, Equatable, Sendable {
    public let posts: [CaligraphiaPost]
    public let nextCursor: String?
}

public struct InboxResponse: Decodable, Equatable, Sendable {
    public let posts: [CaligraphiaPost]
    public let nextCursor: String?
    public let unreadCount: Int
}

public struct MeResponse: Decodable, Equatable, Sendable {
    public let user: CaligraphiaUser
}

public struct MagicLinkResponse: Decodable, Equatable, Sendable {
    public let success: Bool
    public let devMagicLink: String?
}

public struct VerifyMagicLinkResponse: Decodable, Equatable, Sendable {
    public let needsSignup: Bool
    public let signupToken: String?
    public let email: String?
    public let user: CaligraphiaUser?
}

public struct PostDetailResponse: Decodable, Equatable, Sendable {
    public let post: CaligraphiaPost
}

public struct NativePostResponse: Decodable, Equatable, Sendable {
    public let post: CaligraphiaPost
}

public struct NativeDrawingPostPayload: Encodable, Sendable {
    public let nativeDrawingDataBase64: String
    public let renderedImageDataBase64: String
    public let drawingDurationMs: Int
    public let paper: PaperPreset
    public let inkStyle: InkPreset
    public let format: LetterFormat
    public let recipientId: String?
    public let isPrivate: Bool
    public let isDeadLetter: Bool
    public let delivery: String?

    public init(
        nativeDrawingData: Data,
        renderedImageData: Data,
        drawingDurationMs: Int,
        paper: PaperPreset,
        inkStyle: InkPreset,
        format: LetterFormat = .letter,
        recipientId: String? = nil,
        isPrivate: Bool = false,
        isDeadLetter: Bool = false,
        delivery: String? = nil
    ) {
        self.nativeDrawingDataBase64 = nativeDrawingData.base64EncodedString()
        self.renderedImageDataBase64 = renderedImageData.base64EncodedString()
        self.drawingDurationMs = drawingDurationMs
        self.paper = paper
        self.inkStyle = inkStyle
        self.format = format
        self.recipientId = recipientId
        self.isPrivate = isPrivate
        self.isDeadLetter = isDeadLetter
        self.delivery = delivery
    }

    enum CodingKeys: String, CodingKey {
        case nativeDrawingDataBase64 = "native_drawing_data_base64"
        case renderedImageDataBase64 = "rendered_image_data_base64"
        case drawingDurationMs = "drawing_duration_ms"
        case paper
        case inkStyle = "ink_style"
        case format
        case recipientId = "recipient_id"
        case isPrivate = "is_private"
        case isDeadLetter = "is_dead_letter"
        case delivery
    }
}
