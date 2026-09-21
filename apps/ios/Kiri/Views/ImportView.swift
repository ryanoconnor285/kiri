import SwiftUI
import UniformTypeIdentifiers

struct ImportView: View {
    let deckId: String

    @Environment(\.dismiss) private var dismiss
    @State private var rawText = ""
    @State private var preview: [CardDTO] = []
    @State private var saving = false
    @State private var error: String?
    @State private var apkgMessage: String?
    @State private var showFilePicker = false

    private let cardRepo = CardRepository()
    private let apkgService = ApkgImportService()

    var body: some View {
        Form {
            Section("Paste text") {
                TextEditor(text: $rawText)
                    .frame(minHeight: 120)
                Button("Preview import") {
                    Task { await runPreview() }
                }
                .disabled(rawText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }

            Section("Anki deck (.apkg)") {
                Button("Choose .apkg file") { showFilePicker = true }
                if let apkgMessage {
                    Text(apkgMessage).font(.footnote)
                }
            }

            if !preview.isEmpty {
                Section("Preview (\(preview.count) cards)") {
                    ForEach(preview) { card in
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Front").font(.caption).foregroundStyle(.secondary)
                            KatexView(latex: card.frontText).frame(minHeight: 36)
                            Text("Back").font(.caption).foregroundStyle(.secondary)
                            KatexView(latex: card.backText).frame(minHeight: 36)
                        }
                    }
                    Button(saving ? "Saving…" : "Save \(preview.count) cards") {
                        Task { await savePreview() }
                    }
                    .disabled(saving)
                }
            }

            if let error {
                Section {
                    Text(error).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("Import")
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: [UTType(filenameExtension: "apkg") ?? .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                if let url = urls.first {
                    Task { await importApkg(url: url) }
                }
            case .failure(let err):
                error = err.localizedDescription
            }
        }
    }

    private func runPreview() async {
        error = nil
        do {
            preview = try await cardRepo.importPreview(rawText: rawText)
            if preview.isEmpty {
                error = "No cards found. Use blank lines between Q/A pairs or Front | Back."
            }
        } catch let err {
            self.error = err.localizedDescription
        }
    }

    private func savePreview() async {
        saving = true
        error = nil
        defer { saving = false }
        do {
            for card in preview {
                _ = try await cardRepo.upsertCard(
                    deckId: deckId,
                    id: nil,
                    frontText: card.frontText,
                    backText: card.backText
                )
            }
            dismiss()
        } catch let err {
            self.error = err.localizedDescription
        }
    }

    private func importApkg(url: URL) async {
        error = nil
        apkgMessage = nil
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        do {
            let result = try await apkgService.upload(deckId: deckId, fileURL: url)
            apkgMessage = "Imported \(result.importedCount) cards (\(result.skippedCount) skipped)."
        } catch let err {
            self.error = err.localizedDescription
        }
    }
}
