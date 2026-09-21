import Observation
import PencilKit
import UIKit

/// Custom palette (no system `PKToolPicker`). Tools applied via PencilKit inking / eraser / lasso.
@Observable
final class DrawingToolState {
    enum ToolKind: String, CaseIterable {
        case pen
        case highlighter
        case eraser
        case lasso
    }

    enum InkStyle: String, CaseIterable {
        case ballpoint
        case pencil
        case fountain

        var label: String {
            switch self {
            case .ballpoint: "Ballpoint"
            case .pencil: "Pencil"
            case .fountain: "Fountain"
            }
        }

        var inkType: PKInkingTool.InkType {
            switch self {
            case .ballpoint: .pen
            case .pencil: .pencil
            case .fountain: .fountainPen
            }
        }
    }

    enum EraserMode: String, CaseIterable {
        case pixel
        case stroke

        var label: String {
            switch self {
            case .pixel: "Pixel"
            case .stroke: "Stroke"
            }
        }
    }

    enum StrokeWidth: CGFloat, CaseIterable {
        case thin = 2
        case medium = 5
        case thick = 12

        var label: String { Self.labels[self] ?? "M" }

        private static let labels: [StrokeWidth: String] = [.thin: "S", .medium: "M", .thick: "L"]
    }

    /// Bitmap eraser brush diameter (pt).
    enum EraserWidth: CGFloat, CaseIterable {
        case small = 8
        case medium = 16
        case large = 32

        var label: String { Self.labels[self] ?? "M" }

        private static let labels: [EraserWidth: String] = [.small: "S", .medium: "M", .large: "L"]
    }

    static let palette: [UIColor] = [
        .black,
        UIColor(red: 0.12, green: 0.35, blue: 0.78, alpha: 1),
        UIColor(red: 0.85, green: 0.15, blue: 0.15, alpha: 1),
        UIColor(red: 0.1, green: 0.55, blue: 0.25, alpha: 1),
        UIColor(red: 0.95, green: 0.55, blue: 0.1, alpha: 1),
        UIColor(red: 0.55, green: 0.25, blue: 0.75, alpha: 1),
    ]

    static let highlighterPalette: [UIColor] = [
        UIColor(red: 1, green: 0.92, blue: 0.2, alpha: 0.45),
        UIColor(red: 0.35, green: 0.92, blue: 0.45, alpha: 0.45),
        UIColor(red: 1, green: 0.45, blue: 0.75, alpha: 0.45),
        UIColor(red: 0.35, green: 0.72, blue: 1, alpha: 0.45),
        UIColor(red: 1, green: 0.62, blue: 0.2, alpha: 0.45),
    ]

    var kind: ToolKind = .pen {
        didSet { persist() }
    }
    var inkStyle: InkStyle = .ballpoint {
        didSet { persist() }
    }
    var inkColor: UIColor = palette[0] {
        didSet { persist() }
    }
    var highlighterColor: UIColor = highlighterPalette[0] {
        didSet { persist() }
    }
    var strokeWidth: StrokeWidth = .medium {
        didSet { persist() }
    }
    var highlighterWidth: StrokeWidth = .thick {
        didSet { persist() }
    }
    var eraserWidth: EraserWidth = .medium {
        didSet { persist() }
    }
    var eraserMode: EraserMode = .pixel {
        didSet { persist() }
    }
    var paperStyle: PaperStyle = .blank {
        didSet { persist() }
    }

    var showsPenCase = false
    var showsPaperMenu = false

    private(set) weak var canvas: PKCanvasView?
    private var isRestoring = false

    init() {
        restore()
    }

    func attach(_ canvasView: PKCanvasView) {
        canvas = canvasView
        applyCurrentTool()
        canvasView.becomeFirstResponder()
    }

    func applyCurrentTool() {
        guard let canvas else { return }
        switch kind {
        case .pen:
            canvas.tool = PKInkingTool(inkStyle.inkType, color: inkColor, width: strokeWidth.rawValue)
        case .highlighter:
            canvas.tool = PKInkingTool(.marker, color: highlighterColor, width: highlighterWidth.rawValue * 2)
        case .eraser:
            switch eraserMode {
            case .pixel:
                canvas.tool = PKEraserTool(.bitmap, width: eraserWidth.rawValue)
            case .stroke:
                canvas.tool = PKEraserTool(.vector)
            }
        case .lasso:
            if #available(iOS 18.0, *) {
                canvas.tool = PKLassoTool()
            } else {
                kind = .pen
                canvas.tool = PKInkingTool(inkStyle.inkType, color: inkColor, width: strokeWidth.rawValue)
            }
        }
    }

    func undo() {
        canvas?.undoManager?.undo()
        refreshUndoState()
    }

    func redo() {
        canvas?.undoManager?.redo()
        refreshUndoState()
    }

    var canUndo: Bool {
        _ = undoRefreshToken
        return canvas?.undoManager?.canUndo ?? false
    }

    var canRedo: Bool {
        _ = undoRefreshToken
        return canvas?.undoManager?.canRedo ?? false
    }

    private var undoRefreshToken = 0

    func refreshUndoState() {
        undoRefreshToken += 1
    }

    // MARK: - Last-used settings

    private enum Keys {
        static let kind = "kiri.drawing.kind"
        static let inkStyle = "kiri.drawing.inkStyle"
        static let inkColor = "kiri.drawing.inkColor"
        static let highlighterColor = "kiri.drawing.highlighterColor"
        static let strokeWidth = "kiri.drawing.strokeWidth"
        static let highlighterWidth = "kiri.drawing.highlighterWidth"
        static let eraserWidth = "kiri.drawing.eraserWidth"
        static let eraserMode = "kiri.drawing.eraserMode"
        static let paperStyle = "kiri.drawing.paperStyle"
    }

    private func persist() {
        guard !isRestoring else { return }
        let defaults = UserDefaults.standard
        defaults.set(kind.rawValue, forKey: Keys.kind)
        defaults.set(inkStyle.rawValue, forKey: Keys.inkStyle)
        defaults.set(strokeWidth.rawValue, forKey: Keys.strokeWidth)
        defaults.set(highlighterWidth.rawValue, forKey: Keys.highlighterWidth)
        defaults.set(eraserWidth.rawValue, forKey: Keys.eraserWidth)
        defaults.set(eraserMode.rawValue, forKey: Keys.eraserMode)
        defaults.set(paperStyle.rawValue, forKey: Keys.paperStyle)
        defaults.set(colorComponents(inkColor), forKey: Keys.inkColor)
        defaults.set(colorComponents(highlighterColor), forKey: Keys.highlighterColor)
    }

    private func restore() {
        isRestoring = true
        defer { isRestoring = false }
        let defaults = UserDefaults.standard
        if let value = defaults.string(forKey: Keys.kind), let kind = ToolKind(rawValue: value) {
            self.kind = kind
        }
        if let value = defaults.string(forKey: Keys.inkStyle), let style = InkStyle(rawValue: value) {
            inkStyle = style
        }
        if let value = defaults.object(forKey: Keys.strokeWidth) as? CGFloat,
           let width = StrokeWidth(rawValue: value) {
            strokeWidth = width
        }
        if let value = defaults.object(forKey: Keys.highlighterWidth) as? CGFloat,
           let width = StrokeWidth(rawValue: value) {
            highlighterWidth = width
        }
        if let value = defaults.object(forKey: Keys.eraserWidth) as? CGFloat,
           let width = EraserWidth(rawValue: value) {
            eraserWidth = width
        }
        if let value = defaults.string(forKey: Keys.eraserMode), let mode = EraserMode(rawValue: value) {
            eraserMode = mode
        }
        if let value = defaults.string(forKey: Keys.paperStyle), let style = PaperStyle(rawValue: value) {
            paperStyle = style
        }
        if let comps = defaults.array(forKey: Keys.inkColor) as? [CGFloat], comps.count == 4 {
            inkColor = UIColor(red: comps[0], green: comps[1], blue: comps[2], alpha: comps[3])
        }
        if let comps = defaults.array(forKey: Keys.highlighterColor) as? [CGFloat], comps.count == 4 {
            highlighterColor = UIColor(red: comps[0], green: comps[1], blue: comps[2], alpha: comps[3])
        }
    }

    private func colorComponents(_ color: UIColor) -> [CGFloat] {
        var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
        color.getRed(&r, green: &g, blue: &b, alpha: &a)
        return [r, g, b, a]
    }
}
