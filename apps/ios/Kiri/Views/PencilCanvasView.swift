import PencilKit
import SwiftUI

struct PencilCanvasView: UIViewRepresentable {
    @Binding var drawing: PKDrawing
    var toolState: DrawingToolState
    /// When false (default), uses `DrawingToolState` instead of the system floating picker.
    var useSystemToolPicker: Bool = false

    func makeUIView(context: Context) -> ToolPickerCanvasView {
        let canvas = ToolPickerCanvasView()
        canvas.drawing = drawing
        canvas.delegate = context.coordinator
        canvas.drawingPolicy = .anyInput
        canvas.isOpaque = false
        canvas.backgroundColor = .clear
        canvas.showsToolPicker = useSystemToolPicker
        canvas.clearOpaqueBackgrounds()
        canvas.onToolPickerSetup = { [weak coordinator = context.coordinator] canvasView in
            coordinator?.canvasDidSetupToolPicker(canvasView)
        }
        canvas.onWindowAttached = { [toolState] canvasView in
            if let toolCanvas = canvasView as? ToolPickerCanvasView {
                toolCanvas.suppressSystemToolPickerIfNeeded()
            }
            toolState.attach(canvasView)
        }
        return canvas
    }

    func updateUIView(_ canvas: ToolPickerCanvasView, context: Context) {
        canvas.showsToolPicker = useSystemToolPicker
        if canvas.drawing != drawing {
            canvas.drawing = drawing
        }
        canvas.clearOpaqueBackgrounds()
        if useSystemToolPicker {
            canvas.installToolPickerIfNeeded()
        } else {
            canvas.suppressSystemToolPickerIfNeeded()
        }
        toolState.attach(canvas)
        toolState.applyCurrentTool()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(drawing: $drawing, toolState: toolState)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate {
        @Binding var drawing: PKDrawing
        let toolState: DrawingToolState
        weak var attachedCanvas: PKCanvasView?

        init(drawing: Binding<PKDrawing>, toolState: DrawingToolState) {
            _drawing = drawing
            self.toolState = toolState
        }

        func canvasDidSetupToolPicker(_ canvasView: PKCanvasView) {
            attachedCanvas = canvasView
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            drawing = canvasView.drawing
            toolState.refreshUndoState()
        }
    }
}

/// Defers optional `PKToolPicker` setup until `window` is available.
final class ToolPickerCanvasView: PKCanvasView {
    var showsToolPicker = false
    var onToolPickerSetup: ((PKCanvasView) -> Void)?
    var onWindowAttached: ((PKCanvasView) -> Void)?
    private var didInstallToolPicker = false

    override func didMoveToWindow() {
        super.didMoveToWindow()
        if window != nil {
            clearOpaqueBackgrounds()
            suppressSystemToolPickerIfNeeded()
            onWindowAttached?(self)
        }
        installToolPickerIfNeeded()
    }

    func suppressSystemToolPickerIfNeeded() {
        guard !showsToolPicker, let window else { return }
        PKToolPicker.shared(for: window)?.setVisible(false, forFirstResponder: self)
    }

    func clearOpaqueBackgrounds() {
        isOpaque = false
        backgroundColor = .clear
        for subview in subviews {
            subview.isOpaque = false
            subview.backgroundColor = .clear
        }
    }

    func installToolPickerIfNeeded() {
        guard showsToolPicker, window != nil, !didInstallToolPicker else { return }
        guard let picker = PKToolPicker.shared(for: window!) else { return }

        didInstallToolPicker = true
        picker.addObserver(self)
        picker.setVisible(true, forFirstResponder: self)
        becomeFirstResponder()
        onToolPickerSetup?(self)
    }
}

#Preview {
    PencilCanvasView(drawing: .constant(PKDrawing()), toolState: DrawingToolState())
        .frame(height: 300)
}
