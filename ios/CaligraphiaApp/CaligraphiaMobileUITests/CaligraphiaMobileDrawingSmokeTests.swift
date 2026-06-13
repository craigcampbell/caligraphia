import XCTest

final class CaligraphiaMobileDrawingSmokeTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testDrawingComposerCanExportLetter() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-smoke"]
        app.launch()

        XCTAssertTrue(app.buttons["Import Photo"].waitForExistence(timeout: 5))

        let window = app.windows.element(boundBy: 0)
        XCTAssertTrue(window.waitForExistence(timeout: 5))

        let start = window.coordinate(withNormalizedOffset: CGVector(dx: 0.22, dy: 0.30))
        let mid = window.coordinate(withNormalizedOffset: CGVector(dx: 0.55, dy: 0.42))
        let end = window.coordinate(withNormalizedOffset: CGVector(dx: 0.78, dy: 0.34))

        start.press(forDuration: 0.05, thenDragTo: mid)
        mid.press(forDuration: 0.05, thenDragTo: end)

        XCTAssertTrue(app.staticTexts["Ready to send"].waitForExistence(timeout: 3))
        app.buttons["Seal"].tap()

        XCTAssertTrue(app.staticTexts["Letter exported"].waitForExistence(timeout: 5))
    }
}

