import SwiftUI

struct BrowseView: View {
    @Environment(\.colorScheme) private var colorScheme
    @State private var decks: [DeckDTO] = []
    @State private var rows: [BrowseCardDTO] = []
    @State private var total = 0
    @State private var searchText = ""
    @State private var folderScope: String?
    @State private var selection = Set<String>()
    @State private var loading = false
    @State private var error: String?
    @State private var editFront = ""
    @State private var editBack = ""
    @State private var columnVisibility = NavigationSplitViewVisibility.all

    private let browseRepo = BrowseRepository()
    private let cardRepo = CardRepository()

    private var selectedCard: BrowseCardDTO? {
        guard selection.count == 1, let id = selection.first else { return nil }
        return rows.first { $0.id == id }
    }

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            sidebar
        } content: {
            contentColumn
        } detail: {
            detailColumn
        }
        .navigationTitle("Browse")
        .task { await loadDecksAndSearch() }
    }

    private var sidebar: some View {
        List {
            Section("Folders") {
                Button("All folders") {
                    folderScope = nil
                    Task { await runSearch() }
                }
                ForEach(decks.sorted(by: { $0.title < $1.title })) { deck in
                    Button(deck.title) {
                        folderScope = deck.id
                        searchText = CardSearchParser.appendToken(
                            searchText,
                            token: CardSearchParser.folderIdToken(deck.id)
                        )
                        Task { await runSearch() }
                    }
                }
            }
            Section("Filters") {
                ForEach(["is:due", "is:new", "is:suspended"], id: \.self) { token in
                    Button(token) {
                        searchText = CardSearchParser.appendToken(searchText, token: token)
                        Task { await runSearch() }
                    }
                }
            }
        }
        .navigationTitle("Browse")
    }

    private var contentColumn: some View {
        VStack(spacing: 0) {
            HStack {
                TextField("Search cards", text: $searchText)
                    .textFieldStyle(.roundedBorder)
                    .onSubmit { Task { await runSearch() } }
                Button("Search") { Task { await runSearch() } }
            }
            .padding()

            if let error {
                Text(error).foregroundStyle(.red).padding(.horizontal)
            }

            Text("\(total) cards")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal)

            List(rows, selection: $selection) { row in
                VStack(alignment: .leading, spacing: 4) {
                    Text(row.frontText).lineLimit(2).font(.headline)
                    Text(row.backText).lineLimit(1).font(.subheadline).foregroundStyle(.secondary)
                    HStack {
                        Text(row.folderTitle).font(.caption)
                        Spacer()
                        Text(row.dueDate.prefix(10)).font(.caption2)
                        Text(String(format: "%.1f", row.easeFactor)).font(.caption2)
                        Text("\(row.interval)d").font(.caption2)
                    }
                }
                .opacity(row.suspended ? 0.5 : 1)
            }
        }
        .toolbar {
            if !selection.isEmpty {
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Delete", role: .destructive) {
                        Task { await bulkDelete() }
                    }
                    Button("Suspend") {
                        Task { await setSuspended(true) }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var detailColumn: some View {
        if let card = selectedCard {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Question").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $editFront)
                        .frame(minHeight: 80)
                    Text("Answer").font(.caption).foregroundStyle(.secondary)
                    TextEditor(text: $editBack)
                        .frame(minHeight: 80)
                    Button("Save") {
                        Task { await saveEdits(card: card) }
                    }
                    .buttonStyle(.borderedProminent)
                    KatexView(latex: editFront)
                    KatexView(latex: editBack)
                }
                .padding()
            }
            .onAppear {
                editFront = card.frontText
                editBack = card.backText
            }
            .onChange(of: card.id) { _, _ in
                editFront = card.frontText
                editBack = card.backText
            }
        } else {
            Text("Select one card to edit")
                .foregroundStyle(.secondary)
        }
    }

    private func loadDecksAndSearch() async {
        loading = true
        defer { loading = false }
        do {
            decks = try await DeckRepository().fetchDecks()
            await runSearch()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func runSearch() async {
        loading = true
        error = nil
        defer { loading = false }
        do {
            let result = try await browseRepo.searchCards(
                query: searchText.isEmpty ? nil : searchText,
                folderId: folderScope,
                includeSubfolders: true,
                limit: 200
            )
            rows = result.items
            total = result.total
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func bulkDelete() async {
        for id in selection {
            try? await cardRepo.deleteCard(id: id)
        }
        selection.removeAll()
        await runSearch()
    }

    private func setSuspended(_ suspended: Bool) async {
        let ids = Array(selection)
        try? await browseRepo.setSuspended(cardIds: ids, suspended: suspended)
        await runSearch()
    }

    private func saveEdits(card: BrowseCardDTO) async {
        _ = try? await cardRepo.upsertCard(
            deckId: card.deckId,
            id: card.id,
            frontText: editFront,
            backText: editBack
        )
        await runSearch()
    }
}

#Preview {
    NavigationStack {
        BrowseView()
    }
}
