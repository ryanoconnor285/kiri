import SwiftUI
import SwiftData
import PencilKit

struct ReviewView: View {
    @Environment(\.modelContext) private var modelContext
    let deck: Deck
    @Query private var allCards: [Card]

    @State private var hopper: [Card] = []
    @State private var looks: [UUID: Int] = [:]
    @State private var zeroSubmitted: Set<UUID> = []
    @State private var pendingFuzzy: Set<UUID> = []
    @State private var sessionTotal = 0
    @State private var doneCount = 0
    @State private var showingBack = false

    private let maxLooks = 3

    private var dueCards: [Card] {
        allCards.filter { $0.deckId == deck.id }
    }

    var body: some View {
        VStack(spacing: 16) {
            if hopper.isEmpty {
                ContentUnavailableView(
                    sessionTotal == 0 ? "No cards" : "Round clear",
                    systemImage: "rectangle.on.rectangle.slash",
                    description: Text(
                        sessionTotal == 0
                            ? "Add cards to this deck to start a round."
                            : "You checked \(doneCount) card\(doneCount == 1 ? "" : "s") this round."
                    )
                )
            } else {
                let card = hopper[0]

                HStack {
                    Spacer()
                    Text("\(doneCount + 1) of \(sessionTotal)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Text(showingBack ? "Answer" : "Prompt")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                cardFace(card)
                    .aspectRatio(5 / 3, contentMode: .fit)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .onTapGesture {
                        withAnimation { showingBack = true }
                    }

                if showingBack {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("How did it come back?")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ReviewChoice(title: "Total", hint: "It came back clean") {
                            markRecall(card: card, rating: .total)
                        }
                        ReviewChoice(title: "Fuzzy", hint: "Close — show it again this round") {
                            markRecall(card: card, rating: .fuzzy)
                        }
                        ReviewChoice(title: "Zero", hint: "Nothing came back — show it again this round") {
                            markRecall(card: card, rating: .zero)
                        }
                    }
                }
            }
        }
        .padding()
        .navigationTitle(deck.title)
        .onAppear {
            if hopper.isEmpty {
                hopper = dueCards
                sessionTotal = dueCards.count
            }
        }
    }

    @ViewBuilder
    private func cardFace(_ card: Card) -> some View {
        ScrollView {
            VStack(spacing: 16) {
                if let data = showingBack ? card.backPencilData : card.frontPencilData,
                   let drawing = try? PKDrawing(data: data),
                   !drawing.bounds.isEmpty {
                    PencilPreviewView(drawing: drawing)
                        .frame(maxWidth: .infinity)
                        .frame(height: 160)
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
    }

    private enum Rating {
        case total, fuzzy, zero
    }

    private func markRecall(card: Card, rating: Rating) {
        let id = card.id
        switch rating {
        case .total:
            persist(card, quality: 4)
            finishCurrent()
        case .zero:
            if !zeroSubmitted.contains(id) {
                persist(card, quality: 0)
                zeroSubmitted.insert(id)
            }
            pendingFuzzy.remove(id)
            let n = (looks[id] ?? 0) + 1
            looks[id] = n
            if n >= maxLooks {
                finishCurrent()
            } else {
                requeue()
            }
        case .fuzzy:
            let n = (looks[id] ?? 0) + 1
            looks[id] = n
            pendingFuzzy.insert(id)
            if n >= maxLooks {
                if !zeroSubmitted.contains(id) {
                    persist(card, quality: 3)
                }
                finishCurrent()
            } else {
                requeue()
            }
        }
    }

    private func requeue() {
        showingBack = false
        guard !hopper.isEmpty else { return }
        let head = hopper.removeFirst()
        hopper.append(head)
    }

    private func finishCurrent() {
        showingBack = false
        if !hopper.isEmpty {
            hopper.removeFirst()
        }
        doneCount += 1
    }

    private func persist(_ card: Card, quality: Int) {
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
