import SwiftUI
import SwiftData
import PencilKit

struct CardEditorView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var card: Card
    @State private var showingFront = true
    @State private var frontDrawing = PKDrawing()
    @State private var backDrawing = PKDrawing()

    var body: some View {
        VStack(spacing: 16) {
            Picker("Side", selection: $showingFront) {
                Text("Front").tag(true)
                Text("Back").tag(false)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            TextField("LaTeX / text", text: showingFront ? $card.frontText : $card.backText, axis: .vertical)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)

            if !(showingFront ? card.frontText : card.backText).isEmpty {
                KatexView(latex: showingFront ? card.frontText : card.backText)
                    .frame(minHeight: 60)
                    .padding(.horizontal)
            }

            PencilCanvasView(drawing: showingFront ? $frontDrawing : $backDrawing)
                .frame(maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .padding(.horizontal)

            Button("Save") {
                saveCard()
            }
            .buttonStyle(.borderedProminent)
            .padding()
        }
        .navigationTitle("Edit Card")
        .onAppear {
            loadDrawings()
        }
        .onChange(of: showingFront) { _, _ in
            persistCurrentDrawing()
        }
    }

    private func loadDrawings() {
        if let data = card.frontPencilData {
            frontDrawing = (try? PKDrawing(data: data)) ?? PKDrawing()
        }
        if let data = card.backPencilData {
            backDrawing = (try? PKDrawing(data: data)) ?? PKDrawing()
        }
    }

    private func persistCurrentDrawing() {
        if showingFront {
            card.frontPencilData = frontDrawing.dataRepresentation()
        } else {
            card.backPencilData = backDrawing.dataRepresentation()
        }
        card.updatedAt = .now
    }

    private func saveCard() {
        card.frontPencilData = frontDrawing.dataRepresentation()
        card.backPencilData = backDrawing.dataRepresentation()
        card.updatedAt = .now
        try? modelContext.save()
    }
}

#Preview {
    let card = Card(deckId: UUID(), frontText: "\\Delta G = \\Delta H - T\\Delta S", backText: "Gibbs free energy")
    return NavigationStack {
        CardEditorView(card: card)
    }
}
