// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "CaligraphiaNative",
    platforms: [
        .iOS(.v17),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "CaligraphiaNative",
            targets: ["CaligraphiaNative"]
        )
    ],
    targets: [
        .target(name: "CaligraphiaNative"),
        .testTarget(
            name: "CaligraphiaNativeTests",
            dependencies: ["CaligraphiaNative"]
        )
    ]
)
