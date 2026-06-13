import CoreTransferable
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

struct ComposerHostView: View {
    let apiClient: CaligraphiaAPIClient
    let isAuthenticated: Bool

    @State private var latestResult: LetterComposerResult?
    @State private var showingResult = false
    @State private var resetToken = UUID()
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var importedPhotoData: Data?
    @State private var showingImportedPhoto = false

    private let smokeMinimumDurationMs =
        ProcessInfo.processInfo.arguments.contains("--ui-smoke") ? 500 : 15_000

    init(
        apiClient: CaligraphiaAPIClient = CaligraphiaAPIClient(baseURL: URL(string: "http://localhost:3000")!),
        isAuthenticated: Bool = false
    ) {
        self.apiClient = apiClient
        self.isAuthenticated = isAuthenticated
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label("Import Photo", systemImage: "photo")
                }
                .buttonStyle(.bordered)

                Spacer()
            }
            .padding(.horizontal)
            .padding(.bottom, 8)

            LetterComposerView(
                minimumDurationMs: smokeMinimumDurationMs,
                onCancel: resetComposer,
                onComplete: { result in
                    latestResult = result
                    showingResult = true
                }
            )
            .id(resetToken)
        }
        .onChange(of: selectedPhoto) { _, newValue in
            Task {
                await loadPhoto(newValue)
            }
        }
        .sheet(isPresented: $showingResult) {
            ExportResultView(result: latestResult, apiClient: apiClient, isAuthenticated: isAuthenticated, onWriteAnother: {
                showingResult = false
                resetComposer()
            })
        }
        .sheet(isPresented: $showingImportedPhoto) {
            ImportedPhotoView(imageData: importedPhotoData, apiClient: apiClient, isAuthenticated: isAuthenticated)
        }
    }

    private func resetComposer() {
        latestResult = nil
        resetToken = UUID()
    }

    @MainActor
    private func loadPhoto(_ item: PhotosPickerItem?) async {
        guard let item else { return }
        do {
            importedPhotoData = try await item.loadTransferable(type: Data.self)
            showingImportedPhoto = importedPhotoData != nil
            selectedPhoto = nil
        } catch {
            importedPhotoData = nil
            showingImportedPhoto = false
            selectedPhoto = nil
        }
    }
}

private struct ExportResultView: View {
    let result: LetterComposerResult?
    let apiClient: CaligraphiaAPIClient
    let isAuthenticated: Bool
    let onWriteAnother: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var sendState = SendState.idle

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                if let image = resultImage {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .shadow(color: .black.opacity(0.14), radius: 16, y: 8)
                        .padding()
                }

                VStack(spacing: 6) {
                    Text("Letter exported")
                        .font(.headline)
                        .accessibilityIdentifier("letter-exported-title")
                    Text(summaryText)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                HStack {
                    if let export = exportItem {
                        ShareLink(item: export, preview: SharePreview("Caligraphia letter", image: export.image)) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.bordered)
                    }

                    Button(sendState.buttonTitle) {
                        Task {
                            await sendLetter()
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!isAuthenticated || result == nil || sendState.isWorking)

                    Button("Write Another", action: onWriteAnother)
                        .buttonStyle(.bordered)
                }

                Text(sendState.message(isAuthenticated: isAuthenticated))
                    .font(.footnote)
                    .foregroundStyle(sendState.isError ? .red : .secondary)
            }
            .padding()
            .navigationTitle("Seal")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var resultImage: UIImage? {
        guard let data = result?.renderedImageData else { return nil }
        return UIImage(data: data)
    }

    private var exportItem: LetterImageExport? {
        guard let data = result?.renderedImageData else { return nil }
        return LetterImageExport(data: data)
    }

    private var summaryText: String {
        guard let result else { return "No export data yet." }
        let seconds = Double(result.drawingDurationMs) / 1000
        let drawingKB = Double(result.drawingData.count) / 1024
        let imageKB = Double(result.renderedImageData.count) / 1024
        return String(
            format: "%.1fs of writing, %.0f KB drawing, %.0f KB image",
            seconds,
            drawingKB,
            imageKB
        )
    }

    @MainActor
    private func sendLetter() async {
        guard let result else { return }
        sendState = .sending
        do {
            let post = try await apiClient.createNativeDrawingPost(result.payload)
            sendState = .sent(post.id)
        } catch {
            sendState = .failed(userMessage(for: error))
        }
    }
}

private enum SendState: Equatable {
    case idle
    case sending
    case sent(String)
    case failed(String)

    var buttonTitle: String {
        switch self {
        case .idle, .failed:
            "Send"
        case .sending:
            "Sending..."
        case .sent:
            "Sent"
        }
    }

    var isWorking: Bool {
        if case .sending = self { return true }
        return false
    }

    var isError: Bool {
        if case .failed = self { return true }
        return false
    }

    func message(isAuthenticated: Bool) -> String {
        if !isAuthenticated {
            return "Sign in above to send this letter to the postbox."
        }

        switch self {
        case .idle:
            return "Share locally, or send through Caligraphia."
        case .sending:
            return "Sending through Caligraphia..."
        case .sent(let id):
            return "Sent. Post id: \(id)"
        case .failed(let message):
            return message
        }
    }
}

private struct ImportedPhotoView: View {
    let imageData: Data?
    let apiClient: CaligraphiaAPIClient
    let isAuthenticated: Bool

    @Environment(\.dismiss) private var dismiss
    @State private var sendState = SendState.idle

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .shadow(color: .black.opacity(0.14), radius: 16, y: 8)
                        .padding()
                }

                Text("Imported photo")
                    .font(.headline)

                if let imageData {
                    HStack {
                        ShareLink(item: LetterImageExport(data: imageData), preview: SharePreview("Imported letter")) {
                            Label("Share", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.bordered)

                        Button(sendState.buttonTitle) {
                            Task {
                                await sendPhoto(imageData)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(!isAuthenticated || sendState.isWorking)
                    }

                    Text(sendState.message(isAuthenticated: isAuthenticated))
                        .font(.footnote)
                        .foregroundStyle(sendState.isError ? .red : .secondary)
                }
            }
            .padding()
            .navigationTitle("Photo Letter")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }

    private var image: UIImage? {
        guard let imageData else { return nil }
        return UIImage(data: imageData)
    }

    @MainActor
    private func sendPhoto(_ imageData: Data) async {
        sendState = .sending
        do {
            let post = try await apiClient.createPhotoPost(imageData: imageData)
            sendState = .sent(post.id)
        } catch {
            sendState = .failed(userMessage(for: error))
        }
    }
}

private struct LetterImageExport: Transferable {
    let data: Data

    static var transferRepresentation: some TransferRepresentation {
        DataRepresentation(exportedContentType: .png) { item in
            item.data
        }
    }

    var image: Image {
        if let uiImage = UIImage(data: data) {
            return Image(uiImage: uiImage)
        }
        return Image(systemName: "doc.richtext")
    }
}

#Preview {
    ComposerHostView()
}
