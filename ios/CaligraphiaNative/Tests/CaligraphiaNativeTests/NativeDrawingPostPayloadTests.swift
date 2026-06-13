import XCTest
@testable import CaligraphiaNative

final class NativeDrawingPostPayloadTests: XCTestCase {
    func testNativeDrawingPayloadUsesBackendSnakeCaseKeys() throws {
        let payload = NativeDrawingPostPayload(
            nativeDrawingData: Data([1, 2, 3]),
            renderedImageData: Data([4, 5, 6]),
            drawingDurationMs: 16_000,
            paper: .ruled,
            inkStyle: .standard,
            recipientId: "123e4567-e89b-12d3-a456-426614174000",
            isPrivate: true,
            delivery: "slow"
        )

        let data = try JSONEncoder().encode(payload)
        let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])

        XCTAssertEqual(object["native_drawing_data_base64"] as? String, "AQID")
        XCTAssertEqual(object["rendered_image_data_base64"] as? String, "BAUG")
        XCTAssertEqual(object["drawing_duration_ms"] as? Int, 16_000)
        XCTAssertEqual(object["ink_style"] as? String, "standard")
        XCTAssertEqual(object["recipient_id"] as? String, "123e4567-e89b-12d3-a456-426614174000")
        XCTAssertEqual(object["is_private"] as? Bool, true)
    }
}

