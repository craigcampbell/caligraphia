import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct CaligraphiaAPIClient {
    public let baseURL: URL
    public let session: URLSession

    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    public init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            try Self.decodeDate(decoder)
        }
        self.decoder = decoder
    }

    public func me() async throws -> CaligraphiaUser {
        let response: MeResponse = try await send(path: "/api/auth/me", method: "GET")
        return response.user
    }

    public func sendMagicLink(email: String) async throws -> MagicLinkResponse {
        try await send(
            path: "/api/auth/send-magic-link",
            method: "POST",
            body: ["email": email]
        )
    }

    public func verifyMagicLink(token: String) async throws -> VerifyMagicLinkResponse {
        try await send(
            path: "/api/auth/verify-magic-link",
            method: "POST",
            body: ["token": token]
        )
    }

    public func feed(cursor: String? = nil, limit: Int = 20) async throws -> FeedResponse {
        var queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor {
            queryItems.append(URLQueryItem(name: "cursor", value: cursor))
        }
        return try await send(path: "/api/posts", method: "GET", queryItems: queryItems)
    }

    public func inbox(cursor: String? = nil, limit: Int = 20) async throws -> InboxResponse {
        var queryItems = [URLQueryItem(name: "limit", value: String(limit))]
        if let cursor {
            queryItems.append(URLQueryItem(name: "cursor", value: cursor))
        }
        return try await send(path: "/api/posts/inbox", method: "GET", queryItems: queryItems)
    }

    public func post(id: String) async throws -> CaligraphiaPost {
        let response: PostDetailResponse = try await send(path: "/api/posts/\(id)", method: "GET")
        return response.post
    }

    public func createNativeDrawingPost(_ payload: NativeDrawingPostPayload) async throws -> CaligraphiaPost {
        let response: NativePostResponse = try await send(
            path: "/api/posts",
            method: "POST",
            body: payload
        )
        return response.post
    }

    public func createPhotoPost(
        imageData: Data,
        filename: String = "caligraphia-photo.png",
        mimeType: String = "image/png"
    ) async throws -> CaligraphiaPost {
        let boundary = "Boundary-\(UUID().uuidString)"
        let body = multipartBody(
            boundary: boundary,
            fieldName: "photo",
            filename: filename,
            mimeType: mimeType,
            data: imageData
        )
        let response: NativePostResponse = try await sendRaw(
            path: "/api/posts",
            method: "POST",
            contentType: "multipart/form-data; boundary=\(boundary)",
            body: body
        )
        return response.post
    }

    private func send<Response: Decodable>(
        path: String,
        method: String,
        queryItems: [URLQueryItem] = [],
        body: Encodable? = nil
    ) async throws -> Response {
        var components = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)
        if !queryItems.isEmpty {
            components?.queryItems = queryItems
        }
        guard let url = components?.url else {
            throw APIError.invalidURL(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.httpStatus(httpResponse.statusCode, data)
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func sendRaw<Response: Decodable>(
        path: String,
        method: String,
        contentType: String,
        body: Data
    ) async throws -> Response {
        guard let url = URLComponents(url: baseURL.appendingPathComponent(path), resolvingAgainstBaseURL: false)?.url else {
            throw APIError.invalidURL(path)
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw APIError.httpStatus(httpResponse.statusCode, data)
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func multipartBody(
        boundary: String,
        fieldName: String,
        filename: String,
        mimeType: String,
        data: Data
    ) -> Data {
        var body = Data()
        body.appendString("--\(boundary)\r\n")
        body.appendString("Content-Disposition: form-data; name=\"\(fieldName)\"; filename=\"\(filename)\"\r\n")
        body.appendString("Content-Type: \(mimeType)\r\n\r\n")
        body.append(data)
        body.appendString("\r\n--\(boundary)--\r\n")
        return body
    }

    private static func decodeDate(_ decoder: Decoder) throws -> Date {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)

        if let date = ISO8601DateFormatter.internetDateTimeWithFractionalSeconds.date(from: value) {
            return date
        }
        if let date = ISO8601DateFormatter.internetDateTime.date(from: value) {
            return date
        }

        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Invalid date string: \(value)"
        )
    }
}

public enum APIError: Error, Equatable {
    case invalidURL(String)
    case invalidResponse
    case httpStatus(Int, Data)
}

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ wrapped: Encodable) {
        self.encodeClosure = wrapped.encode
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}

private extension ISO8601DateFormatter {
    static let internetDateTime: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()

    static let internetDateTimeWithFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}

private extension Data {
    mutating func appendString(_ string: String) {
        append(Data(string.utf8))
    }
}
