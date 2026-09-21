import SwiftUI

/// Leading vertical tool rail + pen case / paper popovers (`CardEditorView`).
struct DrawingToolRail: View {
    @Environment(\.colorScheme) private var colorScheme
    @Bindable var toolState: DrawingToolState

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                railButton(title: "Pen", systemImage: "pencil.tip", selected: toolState.kind == .pen) {
                    toolState.kind = .pen
                    toolState.applyCurrentTool()
                }

                railButton(
                    title: "Highlighter",
                    systemImage: "highlighter",
                    selected: toolState.kind == .highlighter
                ) {
                    toolState.kind = .highlighter
                    toolState.applyCurrentTool()
                }

                if #available(iOS 18.0, *) {
                    railButton(title: "Lasso", systemImage: "lasso", selected: toolState.kind == .lasso) {
                        toolState.kind = .lasso
                        toolState.applyCurrentTool()
                    }
                }

                railButton(title: "Eraser", systemImage: "eraser", selected: toolState.kind == .eraser) {
                    toolState.kind = .eraser
                    toolState.applyCurrentTool()
                }

                if toolState.kind == .eraser {
                    eraserModePicker
                }

                Button {
                    toolState.showsPenCase = true
                } label: {
                    Image(systemName: "paintpalette")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Pen case")
                .disabled(!showsPenCase)

                Button {
                    toolState.showsPaperMenu = true
                } label: {
                    Image(systemName: "doc.plaintext")
                        .frame(width: 44, height: 44)
                        .background(toolState.paperStyle != .blank ? Color.accentColor.opacity(0.25) : Color.clear)
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Paper style")

                sizePicker

                Spacer(minLength: 8)

                Button { toolState.undo() } label: {
                    Image(systemName: "arrow.uturn.backward")
                        .frame(width: 44, height: 44)
                }
                .disabled(!toolState.canUndo)
                .accessibilityLabel("Undo")

                Button { toolState.redo() } label: {
                    Image(systemName: "arrow.uturn.forward")
                        .frame(width: 44, height: 44)
                }
                .disabled(!toolState.canRedo)
                .accessibilityLabel("Redo")
            }
            .padding(.vertical, 8)
        }
        .frame(width: 56)
        .background(KiriTheme.surfaceSecondary(colorScheme))
        .clipShape(RoundedRectangle(cornerRadius: KiriTheme.radiusMD))
        .overlay(
            RoundedRectangle(cornerRadius: KiriTheme.radiusMD)
                .stroke(KiriTheme.border(colorScheme), lineWidth: 1)
        )
        .popover(isPresented: $toolState.showsPenCase, arrowEdge: .leading) {
            PenCasePopover(toolState: toolState)
                .presentationCompactAdaptation(.popover)
        }
        .popover(isPresented: $toolState.showsPaperMenu, arrowEdge: .leading) {
            PaperStylePopover(toolState: toolState)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var showsPenCase: Bool {
        toolState.kind == .pen || toolState.kind == .highlighter
    }

    private var eraserModePicker: some View {
        VStack(spacing: 4) {
            ForEach(DrawingToolState.EraserMode.allCases, id: \.rawValue) { mode in
                Button(mode.label) {
                    toolState.eraserMode = mode
                    toolState.applyCurrentTool()
                }
                .font(.system(size: 9, weight: .semibold))
                .frame(width: 44, height: 22)
                .background(toolState.eraserMode == mode ? Color.accentColor.opacity(0.3) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 6))
            }
        }
        .accessibilityLabel("Eraser mode")
    }

    @ViewBuilder
    private var sizePicker: some View {
        VStack(spacing: 4) {
            switch toolState.kind {
            case .pen:
                ForEach(DrawingToolState.StrokeWidth.allCases, id: \.rawValue) { width in
                    sizeButton(label: width.label, selected: toolState.strokeWidth == width) {
                        toolState.strokeWidth = width
                        toolState.applyCurrentTool()
                    }
                }
            case .highlighter:
                ForEach(DrawingToolState.StrokeWidth.allCases, id: \.rawValue) { width in
                    sizeButton(label: width.label, selected: toolState.highlighterWidth == width) {
                        toolState.highlighterWidth = width
                        toolState.applyCurrentTool()
                    }
                }
            case .eraser:
                if toolState.eraserMode == .pixel {
                    ForEach(DrawingToolState.EraserWidth.allCases, id: \.rawValue) { width in
                        sizeButton(label: width.label, selected: toolState.eraserWidth == width) {
                            toolState.eraserWidth = width
                            toolState.applyCurrentTool()
                        }
                    }
                }
            case .lasso:
                EmptyView()
            }
        }
    }

    private func sizeButton(label: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.caption.weight(.bold))
                .frame(width: 44, height: 28)
                .background(selected ? Color.accentColor.opacity(0.25) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    private func railButton(
        title: String,
        systemImage: String,
        selected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .frame(width: 44, height: 44)
                .background(selected ? Color.accentColor.opacity(0.25) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 10))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

struct PenCasePopover: View {
    @Bindable var toolState: DrawingToolState

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            if toolState.kind == .pen {
                Text("Ink")
                    .font(.headline)
                HStack(spacing: 8) {
                    ForEach(DrawingToolState.InkStyle.allCases, id: \.rawValue) { style in
                        Button(style.label) {
                            toolState.inkStyle = style
                            toolState.kind = .pen
                            toolState.applyCurrentTool()
                        }
                        .font(.caption.weight(.semibold))
                        .padding(.horizontal, 8)
                        .frame(height: 32)
                        .background(
                            toolState.inkStyle == style ? Color.accentColor.opacity(0.25) : Color.secondary.opacity(0.15)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                    }
                }
            } else {
                Text("Highlighter")
                    .font(.headline)
            }

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 36))], spacing: 10) {
                ForEach(Array(colors.enumerated()), id: \.offset) { _, color in
                    let selected = currentColor.isEqual(color)
                    Button {
                        if toolState.kind == .highlighter {
                            toolState.highlighterColor = color
                        } else {
                            toolState.inkColor = color
                            toolState.kind = .pen
                        }
                        toolState.applyCurrentTool()
                        toolState.showsPenCase = false
                    } label: {
                        Circle()
                            .fill(Color(uiColor: color.withAlphaComponent(1)))
                            .frame(width: 32, height: 32)
                            .overlay {
                                if selected {
                                    Circle().strokeBorder(.primary, lineWidth: 2)
                                }
                            }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(16)
        .frame(minWidth: 260)
    }

    private var colors: [UIColor] {
        toolState.kind == .highlighter ? DrawingToolState.highlighterPalette : DrawingToolState.palette
    }

    private var currentColor: UIColor {
        toolState.kind == .highlighter ? toolState.highlighterColor : toolState.inkColor
    }
}

struct PaperStylePopover: View {
    @Bindable var toolState: DrawingToolState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Paper")
                .font(.headline)
            ForEach(PaperStyle.allCases) { style in
                Button {
                    toolState.paperStyle = style
                    toolState.showsPaperMenu = false
                } label: {
                    HStack {
                        Text(style.label)
                        Spacer()
                        if toolState.paperStyle == style {
                            Image(systemName: "checkmark")
                        }
                    }
                    .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .frame(minWidth: 200)
    }
}

#Preview {
    HStack {
        DrawingToolRail(toolState: DrawingToolState())
        Color.gray.opacity(0.2)
    }
}
