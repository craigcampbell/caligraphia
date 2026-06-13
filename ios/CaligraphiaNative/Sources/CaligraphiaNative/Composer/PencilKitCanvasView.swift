#if canImport(PencilKit) && canImport(UIKit)
import PencilKit
import SwiftUI
import UIKit

@MainActor
public final class PencilKitCanvasController: ObservableObject {
    fileprivate weak var canvasView: PKCanvasView?

    public init() {}

    public var canUndo: Bool {
        canvasView?.undoManager?.canUndo ?? false
    }

    public func undo() {
        canvasView?.undoManager?.undo()
    }
}

public struct PencilKitCanvasView: UIViewRepresentable {
    @Binding private var drawing: PKDrawing

    private let inkColor: UIColor
    private let inkWidth: CGFloat
    private let inkType: PKInkingTool.InkType
    private let allowsFingerDrawing: Bool
    private let controller: PencilKitCanvasController?

    public init(
        drawing: Binding<PKDrawing>,
        inkColor: UIColor,
        inkWidth: CGFloat = 5,
        inkType: PKInkingTool.InkType = .pen,
        allowsFingerDrawing: Bool = true,
        controller: PencilKitCanvasController? = nil
    ) {
        self._drawing = drawing
        self.inkColor = inkColor
        self.inkWidth = inkWidth
        self.inkType = inkType
        self.allowsFingerDrawing = allowsFingerDrawing
        self.controller = controller
    }

    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    public func makeUIView(context: Context) -> PKCanvasView {
        let canvasView = PKCanvasView()
        canvasView.delegate = context.coordinator
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        canvasView.drawing = drawing
        canvasView.drawingPolicy = allowsFingerDrawing ? .anyInput : .pencilOnly
        canvasView.tool = PKInkingTool(inkType, color: inkColor, width: inkWidth)
        canvasView.alwaysBounceVertical = false
        canvasView.alwaysBounceHorizontal = false
        controller?.canvasView = canvasView
        return canvasView
    }

    public func updateUIView(_ canvasView: PKCanvasView, context: Context) {
        context.coordinator.parent = self

        if canvasView.drawing.dataRepresentation() != drawing.dataRepresentation() {
            canvasView.drawing = drawing
        }

        canvasView.drawingPolicy = allowsFingerDrawing ? .anyInput : .pencilOnly
        canvasView.tool = PKInkingTool(inkType, color: inkColor, width: inkWidth)
        controller?.canvasView = canvasView
    }

    public final class Coordinator: NSObject, PKCanvasViewDelegate {
        fileprivate var parent: PencilKitCanvasView

        fileprivate init(_ parent: PencilKitCanvasView) {
            self.parent = parent
        }

        public func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            parent.drawing = canvasView.drawing
        }
    }
}
#endif
