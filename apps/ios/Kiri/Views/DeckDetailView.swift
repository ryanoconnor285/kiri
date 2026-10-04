import SwiftUI

struct DeckDetailView: View {
    let deckId: String
    let deckTitle: String

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @State private var decks: [DeckDTO] = []
    @State private var notes: [NoteListDTO] = []
    @State private var cards: [CardDTO] = []
    @State private var loading = true
    @State private var error: String?
    @State private var childTitle = ""
    @State private var frontText = ""
    @State private var backText = ""
    @State private var savingCard = false
    @State private var openedNoteId: String?
    @State private var deleteDeckTarget: (id: String, title: String)?
    @State private var cardPendingDelete: CardDTO?

    private let deckRepo = DeckRepository()
    private let cardRepo = CardRepository()
    private let noteRepo = NoteRepository()

    private var deck: DeckDTO? {
        decks.first { $0.id == deckId }
    }

    private var children: [DeckDTO] {
        decks.filter { $0.parentId == deckId }
    }

    private var canAddCard: Bool {
        let front = frontText.trimmingCharacters(in: .whitespaces)
        let back = backText.trimmingCharacters(in: .whitespaces)
        return !front.isEmpty && (BlankMarkup.hasBlanks(front) || !back.isEmpty)
    }

    var body: some View {
        List {
            if let error {
                Text(error).foregroundStyle(.red)
            }

            Section {
                NavigationLink {
                    StudyView(deckId: deckId, deckTitle: deckTitle)
                } label: {
                    Label(
                        "Study" + ((deck?.dueCount ?? 0) > 0 ? " · \(deck!.dueCount!) ready" : ""),
                        systemImage: "brain.head.profile"
                    )
                }
                NavigationLink {
                    ImportView(deckId: deckId)
                } label: {
                    Label("Import cards", systemImage: "square.and.arrow.down")
                }
                if UIDevice.current.userInterfaceIdiom == .pad {
                    NavigationLink {
                        CardListEditorView(deckId: deckId, deckTitle: deckTitle)
                    } label: {
                        Label("Edit cards (Pencil)", systemImage: "pencil.tip.crop.circle")
                    }
                }
                Button("Delete folder", role: .destructive) {
                    deleteDeckTarget = (deckId, deckTitle)
                }
            }

            Section("Notebooks") {
                Button("New notebook") {
                    Task { await createNotebook() }
                }
                ForEach(notes) { note in
                    NavigationLink {
                        NotebookEditorView(noteId: note.id)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(note.title)
                            Text("\(note.pageCount ?? 0) page\((note.pageCount ?? 0) == 1 ? "" : "s")")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            Section("Subfolders") {
                HStack {
                    TextField("New item inside \"\(deckTitle)\"", text: $childTitle)
                    Button("Add") { Task { await addSubfolder() } }
                        .disabled(childTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                ForEach(children) { child in
                    NavigationLink {
                        DeckDetailView(deckId: child.id, deckTitle: child.title)
                    } label: {
                        VStack(alignment: .leading) {
                            Text(child.title)
                            Text("\(child.cardCount ?? 0) cards")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button("Delete", role: .destructive) {
                            deleteDeckTarget = (child.id, child.title)
                        }
                    }
                }
            }

            Section("Add card") {
                Text("Hide words with [[increases]], or write Y (increases) as X (decreases) and tap Block parentheses. Blocked-word cards are front-only — revealing uncovers the words.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                TextField("Front (prompt)", text: $frontText, axis: .vertical)
                Button("Block parentheses") {
                    frontText = BlankMarkup.parenthesesToBlanks(frontText)
                }
                .disabled(!frontText.contains("("))
                TextField(BlankMarkup.hasBlanks(frontText) ? "Extra notes (optional)" : "Back (answer)", text: $backText, axis: .vertical)
                if !frontText.trimmingCharacters(in: .whitespaces).isEmpty {
                    BlankedText(text: frontText, revealed: false)
                        .frame(minHeight: 36, alignment: .leading)
                }
                Button(savingCard ? "Saving…" : "Add card") {
                    Task { await addCard() }
                }
                .disabled(savingCard || !canAddCard)
            }

            Section("Cards") {
                ForEach(cards) { card in
                    VStack(alignment: .leading, spacing: 6) {
                        BlankedText(text: card.frontText, revealed: false)
                            .frame(minHeight: 40, alignment: .leading)
                        KatexView(latex: card.backText)
                            .frame(minHeight: 32)
                            .lineLimit(3)
                    }
                    .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                        Button("Delete", role: .destructive) {
                            cardPendingDelete = card
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(KiriTheme.background(colorScheme))
        .navigationTitle(deckTitle)
        .tint(KiriTheme.accent(colorScheme))
        .refreshable { await load() }
        .task { await load() }
        .navigationDestination(item: $openedNoteId) { id in
            NotebookEditorView(noteId: id)
        }
        .alert(
            "Delete folder?",
            isPresented: Binding(
                get: { deleteDeckTarget != nil },
                set: { if !$0 { deleteDeckTarget = nil } }
            ),
            presenting: deleteDeckTarget
        ) { target in
            Button("Delete", role: .destructive) {
                Task { await performDeleteDeck(id: target.id) }
            }
            Button("Cancel", role: .cancel) {
                deleteDeckTarget = nil
            }
        } message: { target in
            let impact = DeckTreeHelpers.subtreeImpact(decks: decks, rootId: target.id)
            Text(
                DeckTreeHelpers.deleteDeckConfirmMessage(
                    title: target.title,
                    subfolderCount: impact.subfolderCount,
                    totalCards: impact.totalCards
                )
            )
        }
        .alert(
            "Delete card?",
            isPresented: Binding(
                get: { cardPendingDelete != nil },
                set: { if !$0 { cardPendingDelete = nil } }
            ),
            presenting: cardPendingDelete
        ) { _ in
            Button("Delete", role: .destructive) {
                Task { await performDeleteCard() }
            }
            Button("Cancel", role: .cancel) {
                cardPendingDelete = nil
            }
        } message: { _ in
            Text("Delete this flashcard? This cannot be undone.")
        }
    }

    private func load() async {
        loading = true
        error = nil
        do {
            async let decksTask = deckRepo.fetchDecks()
            async let cardsTask = cardRepo.fetchCards(deckId: deckId)
            async let notesTask = noteRepo.fetchNotes(deckId: deckId)
            decks = try await decksTask
            cards = try await cardsTask
            notes = try await notesTask
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func createNotebook() async {
        do {
            let note = try await noteRepo.createNote(deckId: deckId)
            await load()
            openedNoteId = note.id
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func addSubfolder() async {
        let title = childTitle.trimmingCharacters(in: .whitespaces)
        guard !title.isEmpty else { return }
        do {
            _ = try await deckRepo.createDeck(title: title, parentId: deckId)
            childTitle = ""
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func addCard() async {
        savingCard = true
        defer { savingCard = false }
        do {
            _ = try await cardRepo.upsertCard(
                deckId: deckId,
                id: nil,
                frontText: frontText.trimmingCharacters(in: .whitespaces),
                backText: backText.trimmingCharacters(in: .whitespaces)
            )
            frontText = ""
            backText = ""
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func performDeleteDeck(id: String) async {
        deleteDeckTarget = nil
        do {
            try await deckRepo.deleteDeck(id: id)
            if id == deckId {
                dismiss()
            } else {
                await load()
            }
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func performDeleteCard() async {
        guard let card = cardPendingDelete else { return }
        cardPendingDelete = nil
        do {
            try await cardRepo.deleteCard(id: card.id)
            await load()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

struct CardListEditorView: View {
    let deckId: String
    let deckTitle: String

    @State private var cards: [CardDTO] = []
    @State private var error: String?
    @State private var cardPendingDelete: CardDTO?

    private let cardRepo = CardRepository()

    var body: some View {
        List {
            if let error {
                Text(error).foregroundStyle(.red)
            }
            ForEach(cards) { card in
                NavigationLink {
                    CardEditorView(deckId: deckId, card: card)
                } label: {
                    Text(card.frontText.isEmpty ? "Untitled" : card.frontText)
                        .lineLimit(1)
                }
                .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                    Button("Delete", role: .destructive) {
                        cardPendingDelete = card
                    }
                }
            }
        }
        .navigationTitle("Edit — \(deckTitle)")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Add") { Task { await addCard() } }
            }
        }
        .task { await load() }
        .alert(
            "Delete card?",
            isPresented: Binding(
                get: { cardPendingDelete != nil },
                set: { if !$0 { cardPendingDelete = nil } }
            ),
            presenting: cardPendingDelete
        ) { _ in
            Button("Delete", role: .destructive) {
                Task { await deleteCard() }
            }
            Button("Cancel", role: .cancel) {
                cardPendingDelete = nil
            }
        } message: { _ in
            Text("Delete this flashcard? This cannot be undone.")
        }
    }

    private func addCard() async {
        do {
            let created = try await cardRepo.upsertCard(
                deckId: deckId,
                id: nil,
                frontText: "",
                backText: ""
            )
            cards.append(created)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func load() async {
        do {
            cards = try await cardRepo.fetchCards(deckId: deckId)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deleteCard() async {
        guard let card = cardPendingDelete else { return }
        cardPendingDelete = nil
        do {
            try await cardRepo.deleteCard(id: card.id)
            cards.removeAll { $0.id == card.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}
