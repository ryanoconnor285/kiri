import SwiftUI
import PencilKit

struct CardEditorView: View {
    let deckId: String
    let card: CardDTO

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @State private var showingFront = true
    @State private var showsTextPanel = false
    @State private var frontText: String
    @State private var backText: String
    @State private var frontDrawing = PKDrawing()
    @State private var backDrawing = PKDrawing()
    @State private var toolState = DrawingToolState()
    @State private var saving = false
    @State private var error: String?

    private let cardRepo = CardRepository()

    init(deckId: String, card: CardDTO) {
        self.deckId = deckId
        self.card = card
        _frontText = State(initialValue: card.frontText)
        _backText = State(initialValue: card.backText)
    }

    var body: some View {
        VStack(spacing: 0) {
            editorHeader

            HStack(alignment: .top, spacing: 8) {
                DrawingToolRail(toolState: toolState)
                    .padding(.leading, 8)

                VStack(spacing: 8) {
                    if showsTextPanel {
                        textPanel
                    }

                    ZStack {
                        PaperBackgroundView(style: toolState.paperStyle)
                        PencilCanvasView(
                            drawing: showingFront ? $frontDrawing : $backDrawing,
                            toolState: toolState
                        )
                    }
                    .id(showingFront)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(KiriTheme.border(colorScheme), lineWidth: 1)
                    )
                }
                .padding(.trailing, 8)
            }
            .frame(maxHeight: .infinity)

            if let error {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.footnote)
                    .padding(.horizontal)
            }
        }
        .background(KiriTheme.background(colorScheme))
        .navigationTitle("Edit card")
        .tint(KiriTheme.accent(colorScheme))
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(saving ? "Saving…" : "Save") {
                    Task { await save() }
                }
                .disabled(saving)
            }
        }
        .onAppear { loadDrawings() }
    }

    private var editorHeader: some View {
        HStack(spacing: 12) {
            Picker("Side", selection: $showingFront) {
                Text("Front").tag(true)
                Text("Back").tag(false)
            }
            .pickerStyle(.segmented)

            Button {
                showsTextPanel.toggle()
            } label: {
                Label("Text", systemImage: showsTextPanel ? "text.alignleft" : "text.badge.plus")
            }
            .labelStyle(.iconOnly)
            .accessibilityLabel("LaTeX text")
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private var textPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("LaTeX / text", text: showingFront ? $frontText : $backText, axis: .vertical)
                .textFieldStyle(.roundedBorder)
            if !(showingFront ? frontText : backText).isEmpty {
                KatexView(latex: showingFront ? frontText : backText)
                    .frame(minHeight: 44)
            }
        }
        .padding(.horizontal, 8)
    }

    private func loadDrawings() {
        if let b64 = card.frontPencilData, let data = Data(base64Encoded: b64) {
            frontDrawing = (try? PKDrawing(data: data)) ?? PKDrawing()
        }
        if let b64 = card.backPencilData, let data = Data(base64Encoded: b64) {
            backDrawing = (try? PKDrawing(data: data)) ?? PKDrawing()
        }
    }

    private func save() async {
        saving = true
        error = nil
        defer { saving = false }

        let frontB64 = frontDrawing.bounds.isEmpty ? nil : frontDrawing.dataRepresentation().base64EncodedString()
        let backB64 = backDrawing.bounds.isEmpty ? nil : backDrawing.dataRepresentation().base64EncodedString()

        do {
            _ = try await cardRepo.upsertCard(
                deckId: deckId,
                id: card.id,
                frontText: frontText,
                backText: backText,
                frontPencilData: frontB64,
                backPencilData: backB64
            )
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
