import SwiftUI

/// Built-in paper textures for the handwriting canvas (PRD §3).
/// Changing style does not alter existing `PKDrawing` strokes.
enum PaperStyle: String, CaseIterable, Identifiable {
    case blank
    case ruled
    case college
    case graph
    case dotted

    var id: String { rawValue }

    var label: String {
        switch self {
        case .blank: "Blank"
        case .ruled: "Ruled"
        case .college: "College ruled"
        case .graph: "Graph"
        case .dotted: "Dotted"
        }
    }
}

struct PaperBackgroundView: View {
    @Environment(\.colorScheme) private var colorScheme
    let style: PaperStyle

    var body: some View {
        Canvas { context, size in
            draw(style, in: &context, size: size)
        }
        .background(KiriTheme.canvasPaper(colorScheme))
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func draw(_ style: PaperStyle, in context: inout GraphicsContext, size: CGSize) {
        let line = colorScheme == .dark
            ? Color.white.opacity(0.12)
            : Color(red: 0.55, green: 0.62, blue: 0.72).opacity(0.45)
        let accent = colorScheme == .dark
            ? Color.red.opacity(0.28)
            : Color(red: 0.78, green: 0.32, blue: 0.32).opacity(0.55)

        switch style {
        case .blank:
            break
        case .ruled:
            strokeHorizontal(in: &context, size: size, spacing: 32, color: line, startY: 28)
        case .college:
            strokeHorizontal(in: &context, size: size, spacing: 24, color: line, startY: 32)
            var margin = Path()
            margin.move(to: CGPoint(x: 48, y: 0))
            margin.addLine(to: CGPoint(x: 48, y: size.height))
            context.stroke(margin, with: .color(accent), lineWidth: 1)
        case .graph:
            strokeGrid(in: &context, size: size, spacing: 20, color: line)
        case .dotted:
            strokeDots(in: &context, size: size, spacing: 18, color: line)
        }
    }

    private func strokeHorizontal(
        in context: inout GraphicsContext,
        size: CGSize,
        spacing: CGFloat,
        color: Color,
        startY: CGFloat
    ) {
        var y = startY
        while y < size.height {
            var path = Path()
            path.move(to: CGPoint(x: 12, y: y))
            path.addLine(to: CGPoint(x: size.width - 12, y: y))
            context.stroke(path, with: .color(color), lineWidth: 1)
            y += spacing
        }
    }

    private func strokeGrid(in context: inout GraphicsContext, size: CGSize, spacing: CGFloat, color: Color) {
        var x: CGFloat = 0
        while x <= size.width {
            var path = Path()
            path.move(to: CGPoint(x: x, y: 0))
            path.addLine(to: CGPoint(x: x, y: size.height))
            context.stroke(path, with: .color(color), lineWidth: 1)
            x += spacing
        }
        var y: CGFloat = 0
        while y <= size.height {
            var path = Path()
            path.move(to: CGPoint(x: 0, y: y))
            path.addLine(to: CGPoint(x: size.width, y: y))
            context.stroke(path, with: .color(color), lineWidth: 1)
            y += spacing
        }
    }

    private func strokeDots(in context: inout GraphicsContext, size: CGSize, spacing: CGFloat, color: Color) {
        var y: CGFloat = spacing
        while y < size.height {
            var x: CGFloat = spacing
            while x < size.width {
                let rect = CGRect(x: x - 1, y: y - 1, width: 2, height: 2)
                context.fill(Path(ellipseIn: rect), with: .color(color))
                x += spacing
            }
            y += spacing
        }
    }
}
