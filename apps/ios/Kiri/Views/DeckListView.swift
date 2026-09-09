import SwiftUI
import SwiftData

struct DeckListView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Deck.createdAt, order: .reverse) private var decks: [Deck]
    @State private var newTitle = ""

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        TextField("New deck title", text: $newTitle)
                        Button("Add") { addDeck() }
                            .disabled(newTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                }

                Section("Decks") {
                    ForEach(decks) { deck in
                        NavigationLink(value: deck) {
                            VStack(alignment: .leading) {
                                Text(deck.title)
                                    .font(.headline)
                                Text("\(deck.cards.count) cards")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .onDelete(perform: deleteDecks)
                }
            }
            .navigationTitle("Kiri")
            .navigationDestination(for: Deck.self) { deck in
                DeckDetailView(deck: deck)
            }
            .onAppear {
                seedDemoDeckIfNeeded()
            }
        }
    }

    private func addDeck() {
        let deck = Deck(title: newTitle.trimmingCharacters(in: .whitespaces))
        modelContext.insert(deck)
        try? modelContext.save()
        newTitle = ""
    }

    private func deleteDecks(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(decks[index])
        }
        try? modelContext.save()
    }

    private func seedDemoDeckIfNeeded() {
        guard decks.isEmpty else { return }
        let deck = Deck(title: "STEM Fundamentals", deckDescription: "Sample local deck")
        let samples: [(String, String)] = [
            ("\\text{H}_2\\text{SO}_4", "Sulfuric acid"),
            ("E = mc^2", "Mass-energy equivalence"),
        ]
        for (front, back) in samples {
            let card = Card(deckId: deck.id, frontText: front, backText: back)
            card.deck = deck
            deck.cards.append(card)
            modelContext.insert(card)
        }
        modelContext.insert(deck)
        try? modelContext.save()
    }
}

struct DeckDetailView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var deck: Deck
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        List {
            Section {
                if sizeClass == .regular {
                    NavigationLink("Edit Cards (iPad)") {
                        CardListEditorView(deck: deck)
                    }
                }
                NavigationLink("Review") {
                    ReviewView(deck: deck)
                }
            }

            Section("Cards") {
                ForEach(deck.cards) { card in
                    VStack(alignment: .leading, spacing: 4) {
                        KatexView(latex: card.frontText)
                            .frame(height: 40)
                        Text(card.backText)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                }
            }
        }
        .navigationTitle(deck.title)
    }
}

struct CardListEditorView: View {
    @Environment(\.modelContext) private var modelContext
    @Bindable var deck: Deck

    var body: some View {
        List {
            ForEach(deck.cards) { card in
                NavigationLink {
                    CardEditorView(card: card)
                } label: {
                    Text(card.frontText.isEmpty ? "Untitled card" : card.frontText)
                        .lineLimit(1)
                }
            }
            .onDelete(perform: deleteCards)
        }
        .navigationTitle("Edit Cards")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Add") { addCard() }
            }
        }
    }

    private func addCard() {
        let card = Card(deckId: deck.id)
        card.deck = deck
        deck.cards.append(card)
        modelContext.insert(card)
        try? modelContext.save()
    }

    private func deleteCards(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(deck.cards[index])
        }
        try? modelContext.save()
    }
}

#Preview {
    DeckListView()
        .modelContainer(for: [Deck.self, Card.self, ReviewState.self], inMemory: true)
}
