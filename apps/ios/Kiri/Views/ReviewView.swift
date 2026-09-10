import SwiftUI
import SwiftData
import PencilKit

struct ReviewView: View {
    @Environment(\.modelContext) private var modelContext
    let deck: Deck
    @Query private var allCards: [Card]

    @State private var currentIndex = 0
    @State private var showingBack = false

    private var dueCards: [Card] {
        allCards.filter { $0.deckId == deck.id }
    }

    var body: some View {
        VStack(spacing: 20) {
            if dueCards.isEmpty {
                ContentUnavailableView("No cards", systemImage: "rectangle.on.rectangle.slash")
            } else {
                let card = dueCards[currentIndex]

                Text(showingBack ? "Answer" : "Prompt")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                ScrollView {
                    VStack(spacing: 16) {
                        if let data = showingBack ? card.backPencilData : card.frontPencilData,
                           let drawing = try? PKDrawing(data: data),
                           !drawing.bounds.isEmpty {
                            PencilPreviewView(drawing: drawing)
                                .frame(maxWidth: .infinity)
                                .frame(height: 200)
                        }

                        let text = showingBack ? card.backText : card.frontText
                        if !text.isEmpty {
                            KatexView(latex: text)
                                .frame(minHeight: 60)
                        }
                    }
                    .padding()
                }
                .background(Color(.secondarySystemBackground))
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .onTapGesture {
                    withAnimation { showingBack.toggle() }
                }

                if showingBack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("How did it come back?")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ReviewChoice(title: "Blank", hint: "Nothing came back") {
                            submitReview(card: card, quality: 0)
                        }
                        ReviewChoice(title: "Partial", hint: "Fragments only") {
                            submitReview(card: card, quality: 3)
                        }
                        ReviewChoice(title: "Retrieved", hint: "I reconstructed it") {
                            submitReview(card: card, quality: 4)
                        }
                        Button("It was automatic — park it longer") {
                            submitReview(card: card, quality: 5)
                        }
                        .font(.caption)
                        .frame(maxWidth: .infinity)
                    }
                    .padding(.horizontal)
                }

                Text("\(currentIndex + 1) / \(dueCards.count)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .navigationTitle(deck.title)
    }

    private func submitReview(card: Card, quality: Int) {
        let userId = UUID(uuidString: "00000000-0000-0000-0000-000000000001") ?? UUID()
        let wasNew = card.reviewState == nil
        let existingState = card.reviewState ?? ReviewState(cardId: card.id, userId: userId)
        let result = SM2Calculator.calculate(quality: quality, previous: existingState)
        existingState.interval = result.interval
        existingState.repetitionCount = result.repetitionCount
        existingState.easeFactor = result.easeFactor
        existingState.dueDate = result.dueDate
        card.reviewState = existingState
        if wasNew {
            modelContext.insert(existingState)
        }
        try? modelContext.save()

        showingBack = false
        if currentIndex < dueCards.count - 1 {
            currentIndex += 1
        }

        Task {
            try? await GraphQLClient().syncDeck(deckId: deck.id, cards: [card])
        }
    }
}

private struct ReviewChoice: View {
    let title: String
    let hint: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 2) {
                Text(title).fontWeight(.semibold)
                Text(hint).font(.caption).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .buttonStyle(.bordered)
    }
}

struct PencilPreviewView: UIViewRepresentable {
    let drawing: PKDrawing

    func makeUIView(context: Context) -> PKCanvasView {
        let canvas = PKCanvasView()
        canvas.drawing = drawing
        canvas.isUserInteractionEnabled = false
        canvas.backgroundColor = .clear
        return canvas
    }

    func updateUIView(_ canvas: PKCanvasView, context: Context) {
        canvas.drawing = drawing
    }
}

#Preview {
    let deck = Deck(title: "Organic Chemistry")
    return NavigationStack {
        ReviewView(deck: deck)
    }
}
