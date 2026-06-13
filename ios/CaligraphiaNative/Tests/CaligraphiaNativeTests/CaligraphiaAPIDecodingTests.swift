import XCTest
@testable import CaligraphiaNative

final class CaligraphiaAPIDecodingTests: XCTestCase {
    func testFeedResponseDecodesCanonicalImageUrlAndCounts() throws {
        let response = try decode(
            FeedResponse.self,
            from: """
            {
              "posts": [{
                "id": "post-1",
                "userId": "user-1",
                "postType": "canvas",
                "paperType": "ruled",
                "inkStyle": "watercolor",
                "imageUrl": "/api/images/post-1",
                "finalImageUrl": "/api/images/post-1",
                "uploadedPhotoUrl": null,
                "stampCount": 3,
                "recipientId": null,
                "isPrivate": false,
                "needsReview": false,
                "format": "letter",
                "deliverAt": null,
                "isDeadLetter": false,
                "ocrText": null,
                "ocrHashtags": ["#ink"],
                "createdAt": "2026-06-13T12:00:00Z",
                "deletedAt": null,
                "user": { "id": "user-1", "username": "ada", "nomDePlume": null },
                "counts": { "scratches": 2, "comments": 1, "interactions": 3, "stamps": 3 }
              }],
              "nextCursor": "post-1"
            }
            """
        )

        XCTAssertEqual(response.posts.first?.imageUrl, "/api/images/post-1")
        XCTAssertEqual(response.posts.first?.counts?.comments, 1)
        XCTAssertEqual(response.posts.first?.counts?.stamps, 3)
        XCTAssertEqual(response.nextCursor, "post-1")
    }

    func testInboxResponseDecodesUnreadCountAndLegacyCountShape() throws {
        let response = try decode(
            InboxResponse.self,
            from: """
            {
              "posts": [{
                "id": "post-2",
                "userId": "user-2",
                "postType": "photo",
                "imageUrl": "/api/images/post-2",
                "finalImageUrl": null,
                "uploadedPhotoUrl": "/api/images/post-2",
                "stampCount": 0,
                "recipientId": "user-1",
                "isPrivate": true,
                "needsReview": false,
                "format": "letter",
                "deliverAt": "2026-06-13T13:00:00Z",
                "isDeadLetter": false,
                "ocrText": null,
                "ocrHashtags": [],
                "createdAt": "2026-06-13T12:00:00Z",
                "deletedAt": null,
                "_count": { "interactions": 0, "scratches": 4 }
              }],
              "nextCursor": null,
              "unreadCount": 1
            }
            """
        )

        XCTAssertEqual(response.unreadCount, 1)
        XCTAssertEqual(response.posts.first?.counts?.scratches, 4)
        XCTAssertEqual(response.posts.first?.counts?.interactions, 0)
    }

    func testPostDetailResponseDecodesStampedState() throws {
        let response = try decode(
            PostDetailResponse.self,
            from: """
            {
              "post": {
                "id": "post-3",
                "userId": "user-3",
                "postType": "canvas",
                "imageUrl": "/api/images/post-3",
                "finalImageUrl": "/api/images/post-3",
                "uploadedPhotoUrl": null,
                "stampCount": 7,
                "recipientId": null,
                "isPrivate": false,
                "needsReview": false,
                "format": "postcard",
                "deliverAt": null,
                "isDeadLetter": false,
                "ocrText": null,
                "ocrHashtags": [],
                "createdAt": "2026-06-13T12:00:00Z",
                "deletedAt": null,
                "stamped": true
              }
            }
            """
        )

        XCTAssertEqual(response.post.format, .postcard)
        XCTAssertEqual(response.post.stamped, true)
    }

    private func decode<T: Decodable>(_ type: T.Type, from json: String) throws -> T {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: Data(json.utf8))
    }
}
