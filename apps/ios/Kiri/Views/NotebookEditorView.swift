import PencilKit
import SwiftUI

struct NotebookEditorView: View {
    let noteId: String

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var pages: [NotePageDTO] = []
    @State private var currentIndex = 0
    @State private var drawing = PKDrawing()
    @State private var toolState = DrawingToolState()
    @State private var loading = true
    @State private var saving = false
    @State private var dirty = false
    @State private var error: String?
    @State private var saveTask: Task<Void, Never>?
    @State private var suppressDrawingWatch = false

    private let noteRepo = NoteRepository()

    private var currentPage: NotePageDTO? {
        pages.indices.contains(currentIndex) ? pages[currentIndex] : nil
    }

    var body: some View {
        VStack(spacing: 0) {
            titleField
            if let error {
                Text(error)
                    .foregroundStyle(.red)
                    .font(.footnote)
                    .padding(.horizontal)
            }
            if loading {
                ProgressView("Loading notebook…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                editorBody
            }
        }
        .background(KiriTheme.background(colorScheme))
        .navigationBarTitleDisplayMode(.inline)
        .tint(KiriTheme.accent(colorScheme))
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("Notebook")
                    .font(.headline)
            }
            ToolbarItem(placement: .primaryAction) {
                Button(saving ? "Saving…" : "Save") {
                    Task { await flushSave() }
                }
                .disabled(saving || loading)
            }
        }
        .safeAreaInset(edge: .bottom) {
            if !loading {
                pageChrome
            }
        }
        .task { await load() }
        .onDisappear {
            saveTask?.cancel()
            Task { await flushSave() }
        }
        .onChange(of: toolState.paperStyle) { _, _ in
            guard !loading, !suppressDrawingWatch, currentPage != nil else { return }
            dirty = true
            scheduleSave()
        }
        .onChange(of: drawing) { _, _ in
            guard !loading, !suppressDrawingWatch else { return }
            dirty = true
            scheduleSave()
        }
    }

    private var titleField: some View {
        TextField("Notebook title", text: $title)
            .textFieldStyle(.roundedBorder)
            .padding(.horizontal)
            .padding(.vertical, 8)
            .onSubmit { Task { await saveTitle() } }
    }

    private var editorBody: some View {
        HStack(alignment: .top, spacing: 8) {
            DrawingToolRail(toolState: toolState)
                .padding(.leading, 8)

            if horizontalSizeClassIsRegular {
                pageRail
            }

            GeometryReader { geo in
                let pageSize = letterSize(in: geo.size)
                ZStack {
                    PaperBackgroundView(style: toolState.paperStyle)
                    PencilCanvasView(drawing: $drawing, toolState: toolState)
                }
                .frame(width: pageSize.width, height: pageSize.height)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(KiriTheme.border(colorScheme), lineWidth: 1)
                )
                .shadow(color: .black.opacity(0.06), radius: 8, y: 2)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding(.trailing, 8)
            .padding(.bottom, 8)
        }
    }

    private var horizontalSizeClassIsRegular: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }

    private var pageRail: some View {
        ScrollView {
            VStack(spacing: 8) {
                ForEach(Array(pages.enumerated()), id: \.element.id) { index, page in
                    Button {
                        Task { await selectPage(index) }
                    } label: {
                        VStack(spacing: 4) {
                            pageThumbnail(page)
                                .frame(width: 72, height: 96)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 6)
                                        .stroke(
                                            index == currentIndex ? KiriTheme.accent(colorScheme) : KiriTheme.border(colorScheme),
                                            lineWidth: index == currentIndex ? 2 : 1
                                        )
                                )
                            Text("\(index + 1)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    Task { await addPage() }
                } label: {
                    Image(systemName: "plus")
                        .frame(width: 72, height: 40)
                        .background(KiriTheme.surfaceSecondary(colorScheme))
                        .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .accessibilityLabel("Add page")
            }
            .padding(.vertical, 4)
        }
        .frame(width: 88)
    }

    private var pageChrome: some View {
        HStack {
            Button("Previous") { Task { await selectPage(currentIndex - 1) } }
                .disabled(currentIndex <= 0)
            Spacer()
            Text("Page \(currentIndex + 1) of \(max(pages.count, 1))")
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Menu {
                Button("Add page") { Task { await addPage() } }
                if pages.count > 1 {
                    Button("Delete page", role: .destructive) { Task { await deleteCurrentPage() } }
                }
            } label: {
                Image(systemName: "ellipsis.circle")
            }
            Button("Next") { Task { await selectPage(currentIndex + 1) } }
                .disabled(currentIndex >= pages.count - 1)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(KiriTheme.surface(colorScheme))
    }

    @ViewBuilder
    private func pageThumbnail(_ page: NotePageDTO) -> some View {
        ZStack {
            PaperBackgroundView(style: PaperStyle(rawValue: page.paperStyle) ?? .blank)
            if let b64 = page.pencilData,
               let data = Data(base64Encoded: b64),
               let pk = try? PKDrawing(data: data),
               !pk.bounds.isEmpty {
                PencilPreviewView(drawing: pk)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 6))
    }

    private func letterSize(in bounds: CGSize) -> CGSize {
        let ratio: CGFloat = 11 / 8.5
        var width = bounds.width
        var height = width * ratio
        if height > bounds.height {
            height = bounds.height
            width = height / ratio
        }
        return CGSize(width: max(width, 120), height: max(height, 160))
    }

    private func load() async {
        loading = true
        error = nil
        do {
            let note = try await noteRepo.fetchNote(id: noteId)
            title = note.title
            pages = (note.pages ?? []).sorted { $0.pageIndex < $1.pageIndex }
            currentIndex = 0
            applyCurrentPageToCanvas()
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }

    private func applyCurrentPageToCanvas() {
        suppressDrawingWatch = true
        defer {
            DispatchQueue.main.async { suppressDrawingWatch = false }
        }
        guard let page = currentPage else {
            drawing = PKDrawing()
            return
        }
        if let b64 = page.pencilData, let data = Data(base64Encoded: b64) {
            drawing = (try? PKDrawing(data: data)) ?? PKDrawing()
        } else {
            drawing = PKDrawing()
        }
        toolState.paperStyle = PaperStyle(rawValue: page.paperStyle) ?? .blank
        dirty = false
    }

    private func selectPage(_ index: Int) async {
        guard pages.indices.contains(index), index != currentIndex else { return }
        await flushSave()
        currentIndex = index
        applyCurrentPageToCanvas()
    }

    private func addPage() async {
        await flushSave()
        do {
            let page = try await noteRepo.addNotePage(noteId: noteId, paperStyle: toolState.paperStyle.rawValue)
            pages.append(page)
            currentIndex = pages.count - 1
            applyCurrentPageToCanvas()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func deleteCurrentPage() async {
        guard let page = currentPage, pages.count > 1 else { return }
        do {
            try await noteRepo.deleteNotePage(id: page.id)
            await load()
            currentIndex = min(currentIndex, max(pages.count - 1, 0))
            applyCurrentPageToCanvas()
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func saveTitle() async {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        do {
            try await noteRepo.updateNote(id: noteId, title: trimmed)
        } catch {
            self.error = error.localizedDescription
        }
    }

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task {
            try? await Task.sleep(nanoseconds: 1_200_000_000)
            guard !Task.isCancelled else { return }
            await flushSave()
        }
    }

    private func flushSave() async {
        guard dirty, let page = currentPage else { return }
        saving = true
        defer { saving = false }
        let b64 = drawing.dataRepresentation().base64EncodedString()
        do {
            let updated = try await noteRepo.upsertNotePage(
                noteId: noteId,
                pageIndex: page.pageIndex,
                paperStyle: toolState.paperStyle.rawValue,
                pencilData: b64
            )
            if pages.indices.contains(currentIndex) {
                pages[currentIndex] = updated
            }
            dirty = false
            await saveTitle()
        } catch {
            self.error = error.localizedDescription
        }
    }
}
