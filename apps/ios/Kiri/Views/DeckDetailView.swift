import SwiftUI

struct DeckDetailView: View {
    let deckId: String
    let deckTitle: String

    @Environment(\.colorScheme) private var colorScheme
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

    private let deckRepo = DeckRepository()
    private let cardRepo = CardRepository()
    private let noteRepo = NoteRepository()

    private var deck: DeckDTO? {
        decks.first { $0.id == deckId }
    }

    private var children: [DeckDTO] {
        decks.filter { $0.parentId == deckId }
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
                }
            }

            Section("Add card") {
                TextField("Front (prompt)", text: $frontText, axis: .vertical)
                TextField("Back (answer)", text: $backText, axis: .vertical)
                Button(savingCard ? "Saving…" : "Add card") {
                    Task { await addCard() }
                }
                .disabled(savingCard || frontText.trimmingCharacters(in: .whitespaces).isEmpty || backText.trimmingCharacters(in: .whitespaces).isEmpty)
            }

            Section("Cards") {
                ForEach(cards) { card in
                    VStack(alignment: .leading, spacing: 6) {
                        KatexView(latex: card.frontText)
                            .frame(minHeight: 40)
                        KatexView(latex: card.backText)
                            .frame(minHeight: 32)
                            .lineLimit(3)
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
}

struct CardListEditorView: View {
    let deckId: String
    let deckTitle: String

    @State private var cards: [CardDTO] = []
    @State private var error: String?

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
            }
        }
        .navigationTitle("Edit — \(deckTitle)")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Add") { Task { await addCard() } }
            }
        }
        .task { await load() }
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
}
