#if canImport(PencilKit) && canImport(UIKit)
import PencilKit
import SwiftUI
import UIKit

public struct LetterComposerResult: Sendable {
    public let drawingData: Data
    public let renderedImageData: Data
    public let drawingDurationMs: Int
    public let paper: PaperPreset
    public let inkStyle: InkPreset
    public let format: LetterFormat

    public var payload: NativeDrawingPostPayload {
        NativeDrawingPostPayload(
            nativeDrawingData: drawingData,
            renderedImageData: renderedImageData,
            drawingDurationMs: drawingDurationMs,
            paper: paper,
            inkStyle: inkStyle,
            format: format
        )
    }
}

public struct LetterComposerView: View {
    private let format: LetterFormat
    private let minimumDurationMs: Int
    private let onCancel: () -> Void
    private let onComplete: (LetterComposerResult) -> Void

    @State private var drawing = PKDrawing()
    @State private var paper: PaperPreset = .ruled
    @State private var inkStyle: InkPreset = .standard
    @State private var inkColor: UIColor = UIColor(red: 0.10, green: 0.10, blue: 0.18, alpha: 1)
    @State private var startedAt: Date?
    @State private var elapsedMs = 0
    @State private var exportError: String?
    @StateObject private var canvasController = PencilKitCanvasController()

    private let pageSize = CGSize(width: 612, height: 792)
    private let colorSwatches: [UIColor] = [
        UIColor(red: 0.10, green: 0.10, blue: 0.18, alpha: 1),
        UIColor(red: 0.75, green: 0.22, blue: 0.18, alpha: 1),
        UIColor(red: 0.13, green: 0.45, blue: 0.64, alpha: 1),
        UIColor(red: 0.15, green: 0.55, blue: 0.36, alpha: 1),
        UIColor(red: 0.48, green: 0.28, blue: 0.64, alpha: 1),
        UIColor(red: 0.43, green: 0.30, blue: 0.22, alpha: 1),
        UIColor(red: 0.83, green: 0.69, blue: 0.22, alpha: 1),
        UIColor(red: 0.98, green: 0.91, blue: 0.55, alpha: 1),
    ]

    public init(
        format: LetterFormat = .letter,
        minimumDurationMs: Int = 15_000,
        onCancel: @escaping () -> Void,
        onComplete: @escaping (LetterComposerResult) -> Void
    ) {
        self.format = format
        self.minimumDurationMs = minimumDurationMs
        self.onCancel = onCancel
        self.onComplete = onComplete
    }

    public var body: some View {
        VStack(spacing: 12) {
            toolbar

            ZStack {
                PaperBackground(paper: paper)
                PencilKitCanvasView(
                    drawing: $drawing,
                    inkColor: inkColor,
                    inkWidth: width(for: inkStyle),
                    inkType: inkType(for: inkStyle),
                    allowsFingerDrawing: true,
                    controller: canvasController
                )
                .onChange(of: drawing.dataRepresentation()) { _, _ in
                    if startedAt == nil {
                        startedAt = Date()
                    }
                }
            }
            .aspectRatio(pageSize, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .stroke(.black.opacity(0.14), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
            .padding(.horizontal)

            footer
        }
        .task {
            while !Task.isCancelled {
                updateElapsed()
                try? await Task.sleep(nanoseconds: 250_000_000)
            }
        }
        .onChange(of: inkStyle) { _, newStyle in
            applyDefaultColor(for: newStyle)
        }
    }

    private var toolbar: some View {
        HStack(alignment: .top, spacing: 12) {
            Picker("Paper", selection: $paper) {
                ForEach(PaperPreset.allCases) { preset in
                    Text(preset.rawValue.capitalized).tag(preset)
                }
            }
            .pickerStyle(.menu)

            Picker("Ink", selection: $inkStyle) {
                ForEach(InkPreset.allCases) { preset in
                    Text(preset.displayName).tag(preset)
                }
            }
            .pickerStyle(.menu)

            HStack(spacing: 6) {
                ForEach(Array(colorSwatches.enumerated()), id: \.offset) { _, color in
                    InkSwatchButton(
                        color: Color(color),
                        isSelected: inkColor.isVisuallyEqual(to: color),
                        action: { inkColor = color }
                    )
                }
            }
            .accessibilityLabel("Ink swatches")

            ColorPicker("Ink", selection: Binding(
                get: { Color(inkColor) },
                set: { inkColor = UIColor($0) }
            ))
            .labelsHidden()

            Spacer(minLength: 0)
        }
        .padding(.horizontal)
        .padding(.top, 12)
    }

    private var footer: some View {
        HStack(spacing: 12) {
            Button("Discard", action: onCancel)
                .buttonStyle(.bordered)

            Button("Undo") {
                canvasController.undo()
            }
            .buttonStyle(.bordered)
            .disabled(!canvasController.canUndo && drawing.bounds.isEmpty)

            Spacer()

            if let exportError {
                Text(exportError)
                    .font(.footnote)
                    .foregroundStyle(.red)
            } else {
                Text(canSubmit ? "Ready to send" : "Let the ink flow")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Button("Seal") {
                submit()
            }
            .buttonStyle(.borderedProminent)
            .disabled(!canSubmit)
        }
        .padding(.horizontal)
        .padding(.bottom, 12)
    }

    private var canSubmit: Bool {
        elapsedMs >= minimumDurationMs && !drawing.bounds.isEmpty
    }

    private func updateElapsed() {
        guard let startedAt else {
            elapsedMs = 0
            return
        }
        elapsedMs = max(0, Int(Date().timeIntervalSince(startedAt) * 1000))
    }

    private func submit() {
        guard canSubmit else { return }

        let drawingData = drawing.dataRepresentation()

        guard let renderedImageData = renderLetterImageData() else {
            exportError = "Could not render drawing"
            return
        }

        onComplete(
            LetterComposerResult(
                drawingData: drawingData,
                renderedImageData: renderedImageData,
                drawingDurationMs: elapsedMs,
                paper: paper,
                inkStyle: inkStyle,
                format: format
            )
        )
    }

    private func width(for inkStyle: InkPreset) -> CGFloat {
        switch inkStyle {
        case .standard: 5
        case .runny: 7
        case .quill: 3
        case .calligraphy: 9
        case .italic: 7
        case .blackletter: 11
        case .copperplate: 4
        case .brush: 12
        case .watercolor: 15
        case .goldLeaf: 10
        case .illumination: 8
        }
    }

    private func inkType(for inkStyle: InkPreset) -> PKInkingTool.InkType {
        switch inkStyle {
        case .standard: .pen
        case .runny: .marker
        case .quill: .pen
        case .calligraphy: .fountainPen
        case .italic: .fountainPen
        case .blackletter: .marker
        case .copperplate: .fountainPen
        case .brush: .marker
        case .watercolor: .watercolor
        case .goldLeaf: .marker
        case .illumination: .fountainPen
        }
    }

    private func applyDefaultColor(for inkStyle: InkPreset) {
        switch inkStyle {
        case .goldLeaf:
            inkColor = UIColor(red: 0.83, green: 0.69, blue: 0.22, alpha: 1)
        case .illumination:
            inkColor = UIColor(red: 0.65, green: 0.08, blue: 0.10, alpha: 1)
        case .watercolor:
            if inkColor.isVisuallyEqual(to: UIColor(red: 0.10, green: 0.10, blue: 0.18, alpha: 1)) {
                inkColor = UIColor(red: 0.13, green: 0.45, blue: 0.64, alpha: 0.72)
            }
        default:
            break
        }
    }

    private func renderLetterImageData() -> Data? {
        let scale: CGFloat = 2
        let renderer = UIGraphicsImageRenderer(size: pageSize, format: {
            let format = UIGraphicsImageRendererFormat()
            format.scale = scale
            format.opaque = true
            return format
        }())

        let image = renderer.image { context in
            paperUIColor.setFill()
            context.fill(CGRect(origin: .zero, size: pageSize))

            if paper == .ruled {
                drawRuledLines(in: context.cgContext)
            } else if paper == .graph {
                drawGraphLines(in: context.cgContext)
            }

            drawing.image(from: CGRect(origin: .zero, size: pageSize), scale: scale)
                .draw(in: CGRect(origin: .zero, size: pageSize))
        }

        return image.pngData()
    }

    private var paperUIColor: UIColor {
        switch paper {
        case .blank: .white
        case .ruled: UIColor(red: 0.99, green: 0.98, blue: 0.95, alpha: 1)
        case .graph: UIColor(red: 0.99, green: 0.99, blue: 0.98, alpha: 1)
        case .watercolor: UIColor(red: 0.98, green: 0.96, blue: 0.92, alpha: 1)
        case .vellum: UIColor(red: 0.96, green: 0.93, blue: 0.88, alpha: 1)
        case .midnight: UIColor(red: 0.05, green: 0.05, blue: 0.10, alpha: 1)
        }
    }

    private func drawRuledLines(in context: CGContext) {
        context.saveGState()
        context.setStrokeColor(UIColor.blue.withAlphaComponent(0.18).cgColor)
        context.setLineWidth(1)
        var y: CGFloat = 34
        while y < pageSize.height {
            context.move(to: CGPoint(x: 0, y: y))
            context.addLine(to: CGPoint(x: pageSize.width, y: y))
            y += 24
        }
        context.strokePath()

        context.setStrokeColor(UIColor.red.withAlphaComponent(0.18).cgColor)
        context.move(to: CGPoint(x: pageSize.width * 0.1, y: 0))
        context.addLine(to: CGPoint(x: pageSize.width * 0.1, y: pageSize.height))
        context.strokePath()
        context.restoreGState()
    }

    private func drawGraphLines(in context: CGContext) {
        context.saveGState()
        context.setStrokeColor(UIColor.blue.withAlphaComponent(0.12).cgColor)
        context.setLineWidth(0.6)

        var x: CGFloat = 0
        while x < pageSize.width {
            context.move(to: CGPoint(x: x, y: 0))
            context.addLine(to: CGPoint(x: x, y: pageSize.height))
            x += 16
        }

        var y: CGFloat = 0
        while y < pageSize.height {
            context.move(to: CGPoint(x: 0, y: y))
            context.addLine(to: CGPoint(x: pageSize.width, y: y))
            y += 16
        }

        context.strokePath()
        context.restoreGState()
    }
}

private struct InkSwatchButton: View {
    let color: Color
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Circle()
                .fill(color)
                .frame(width: 26, height: 26)
                .overlay {
                    Circle()
                        .stroke(isSelected ? Color.primary : Color.black.opacity(0.18), lineWidth: isSelected ? 3 : 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Choose ink color")
    }
}

private extension UIColor {
    func isVisuallyEqual(to other: UIColor) -> Bool {
        var r1: CGFloat = 0
        var g1: CGFloat = 0
        var b1: CGFloat = 0
        var a1: CGFloat = 0
        var r2: CGFloat = 0
        var g2: CGFloat = 0
        var b2: CGFloat = 0
        var a2: CGFloat = 0
        getRed(&r1, green: &g1, blue: &b1, alpha: &a1)
        other.getRed(&r2, green: &g2, blue: &b2, alpha: &a2)
        return abs(r1 - r2) < 0.01 &&
            abs(g1 - g2) < 0.01 &&
            abs(b1 - b2) < 0.01 &&
            abs(a1 - a2) < 0.01
    }
}

private struct PaperBackground: View {
    let paper: PaperPreset

    var body: some View {
        ZStack {
            baseColor

            if paper == .ruled {
                RuledPaperLines()
            } else if paper == .graph {
                GraphPaperLines()
            }
        }
    }

    private var baseColor: Color {
        switch paper {
        case .blank: .white
        case .ruled: Color(red: 0.99, green: 0.98, blue: 0.95)
        case .graph: Color(red: 0.99, green: 0.99, blue: 0.98)
        case .watercolor: Color(red: 0.98, green: 0.96, blue: 0.92)
        case .vellum: Color(red: 0.96, green: 0.93, blue: 0.88)
        case .midnight: Color(red: 0.05, green: 0.05, blue: 0.10)
        }
    }
}

private struct RuledPaperLines: View {
    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                var path = Path()
                var y: CGFloat = 34
                while y < size.height {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                    y += 24
                }
                context.stroke(path, with: .color(.blue.opacity(0.18)), lineWidth: 1)

                var margin = Path()
                margin.move(to: CGPoint(x: proxy.size.width * 0.1, y: 0))
                margin.addLine(to: CGPoint(x: proxy.size.width * 0.1, y: size.height))
                context.stroke(margin, with: .color(.red.opacity(0.18)), lineWidth: 1)
            }
        }
    }
}

private struct GraphPaperLines: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            var x: CGFloat = 0
            while x < size.width {
                path.move(to: CGPoint(x: x, y: 0))
                path.addLine(to: CGPoint(x: x, y: size.height))
                x += 16
            }

            var y: CGFloat = 0
            while y < size.height {
                path.move(to: CGPoint(x: 0, y: y))
                path.addLine(to: CGPoint(x: size.width, y: y))
                y += 16
            }
            context.stroke(path, with: .color(.blue.opacity(0.12)), lineWidth: 0.6)
        }
    }
}
#endif
