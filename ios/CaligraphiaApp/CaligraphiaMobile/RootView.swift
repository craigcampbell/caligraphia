import SwiftUI

struct RootView: View {
    @AppStorage("caligraphia.baseURL") private var baseURLString = "http://localhost:3000"

    @State private var user: CaligraphiaUser?
    @State private var authMessage: String?

    private var apiClient: CaligraphiaAPIClient {
        CaligraphiaAPIClient(baseURL: apiBaseURL)
    }

    private var apiBaseURL: URL {
        URL(string: baseURLString) ?? URL(string: "http://localhost:3000")!
    }

    var body: some View {
        TabView {
            NavigationStack {
                VStack(spacing: 0) {
                    AccountPanel(
                        user: user,
                        baseURLString: $baseURLString,
                        message: $authMessage,
                        apiClient: apiClient,
                        onRefresh: refreshSession
                    )
                    Divider()
                    ComposerHostView(apiClient: apiClient, isAuthenticated: user != nil)
                }
                .navigationTitle("Write")
                .navigationBarTitleDisplayMode(.inline)
            }
            .tabItem {
                Label("Write", systemImage: "pencil.tip")
            }

            NavigationStack {
                LetterListView(mode: .postbox, apiClient: apiClient, isAuthenticated: user != nil)
                    .navigationTitle("Postbox")
            }
            .tabItem {
                Label("Postbox", systemImage: "tray")
            }

            NavigationStack {
                LetterListView(mode: .inbox, apiClient: apiClient, isAuthenticated: user != nil)
                    .navigationTitle("Inbox")
            }
            .tabItem {
                Label("Inbox", systemImage: "envelope")
            }
        }
        .task(id: baseURLString) {
            await refreshSession()
        }
    }

    @MainActor
    private func refreshSession() async {
        do {
            user = try await apiClient.me()
            authMessage = "Signed in as \(user?.username ?? "writer")"
        } catch {
            user = nil
            if authMessage == nil {
                authMessage = "Sign in to send and receive letters."
            }
        }
    }
}

private struct AccountPanel: View {
    let user: CaligraphiaUser?
    @Binding var baseURLString: String
    @Binding var message: String?
    let apiClient: CaligraphiaAPIClient
    let onRefresh: () async -> Void

    @State private var email = ""
    @State private var tokenOrLink = ""
    @State private var isWorking = false

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label(user?.username ?? "Not signed in", systemImage: user == nil ? "person.crop.circle.badge.questionmark" : "person.crop.circle.fill")
                    .font(.footnote.weight(.semibold))
                Spacer()
                Button("Refresh") {
                    Task { await onRefresh() }
                }
                .font(.footnote)
                .buttonStyle(.bordered)
            }

            TextField("API Base URL", text: $baseURLString)
                .textInputAutocapitalization(.never)
                .keyboardType(.URL)
                .font(.footnote)
                .textFieldStyle(.roundedBorder)

            if user == nil {
                HStack {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never)
                        .keyboardType(.emailAddress)
                        .textFieldStyle(.roundedBorder)

                    Button("Send Link") {
                        Task { await sendLink() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(isWorking || email.isEmpty)
                }

                HStack {
                    TextField("Token or Magic Link", text: $tokenOrLink)
                        .textInputAutocapitalization(.never)
                        .textFieldStyle(.roundedBorder)

                    Button("Verify") {
                        Task { await verifyLink() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isWorking || tokenOrLink.isEmpty)
                }
            }

            if let message {
                Text(message)
                    .font(.caption)
                    .foregroundStyle(user == nil ? Color.secondary : Color.green)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 10)
        .background(.regularMaterial)
    }

    @MainActor
    private func sendLink() async {
        isWorking = true
        defer { isWorking = false }

        do {
            let response = try await apiClient.sendMagicLink(email: email)
            if let devMagicLink = response.devMagicLink {
                tokenOrLink = devMagicLink
                message = "Dev link received. Tap Verify to use it."
            } else {
                message = "Magic link sent. Paste the token or opened link here."
            }
        } catch {
            message = userMessage(for: error)
        }
    }

    @MainActor
    private func verifyLink() async {
        isWorking = true
        defer { isWorking = false }

        do {
            let response = try await apiClient.verifyMagicLink(token: token(from: tokenOrLink))
            if response.needsSignup {
                message = "This email needs web signup first: \(response.email ?? "unknown email")."
                return
            }
            await onRefresh()
        } catch {
            message = userMessage(for: error)
        }
    }

    private func token(from input: String) -> String {
        guard
            let url = URL(string: input),
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
            let token = components.queryItems?.first(where: { $0.name == "token" })?.value
        else {
            return input.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return token
    }
}

private enum LetterListMode {
    case postbox
    case inbox

    var emptyTitle: String {
        switch self {
        case .postbox: "No public letters yet"
        case .inbox: "No delivered letters yet"
        }
    }

    var emptyDescription: String {
        switch self {
        case .postbox: "Letters from the shared postbox will appear here."
        case .inbox: "Private letters addressed to you will arrive here after delivery."
        }
    }
}

private struct LetterListView: View {
    let mode: LetterListMode
    let apiClient: CaligraphiaAPIClient
    let isAuthenticated: Bool

    @State private var posts: [CaligraphiaPost] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if !isAuthenticated {
                ContentUnavailableView(
                    "Sign in required",
                    systemImage: "person.crop.circle.badge.exclamationmark",
                    description: Text("Use the Write tab account panel to sign in before loading letters.")
                )
            } else if isLoading && posts.isEmpty {
                ProgressView("Checking the mail...")
            } else if let errorMessage, posts.isEmpty {
                ContentUnavailableView(
                    "Could not load letters",
                    systemImage: "exclamationmark.triangle",
                    description: Text(errorMessage)
                )
            } else if posts.isEmpty {
                ContentUnavailableView(
                    mode.emptyTitle,
                    systemImage: mode == .postbox ? "tray" : "envelope",
                    description: Text(mode.emptyDescription)
                )
            } else {
                List(posts) { post in
                    NavigationLink {
                        LetterDetailView(postID: post.id, initialPost: post, apiClient: apiClient)
                    } label: {
                        LetterRow(post: post, apiClient: apiClient)
                    }
                }
                .listStyle(.plain)
                .refreshable {
                    await load()
                }
            }
        }
        .task(id: isAuthenticated) {
            guard isAuthenticated else { return }
            await load()
        }
    }

    @MainActor
    private func load() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            switch mode {
            case .postbox:
                posts = try await apiClient.feed(limit: 40).posts
            case .inbox:
                posts = try await apiClient.inbox(limit: 40).posts
            }
        } catch {
            errorMessage = userMessage(for: error)
        }
    }
}

private struct LetterRow: View {
    let post: CaligraphiaPost
    let apiClient: CaligraphiaAPIClient

    var body: some View {
        HStack(spacing: 12) {
            AsyncImage(url: absoluteURL(post.imageUrl ?? post.finalImageUrl ?? post.uploadedPhotoUrl, baseURL: apiClient.baseURL)) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    Image(systemName: "doc.richtext")
                        .foregroundStyle(.secondary)
                case .empty:
                    ProgressView()
                @unknown default:
                    EmptyView()
                }
            }
            .frame(width: 58, height: 76)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))

            VStack(alignment: .leading, spacing: 4) {
                Text(post.user?.username ?? "A writer")
                    .font(.headline)
                Text(post.inkStyle?.capitalized ?? post.postType.rawValue.capitalized)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(spacing: 10) {
                    Label("\(post.counts?.stamps ?? post.stampCount)", systemImage: "star")
                    Label("\(post.counts?.comments ?? 0)", systemImage: "text.bubble")
                    Label("\(post.counts?.scratches ?? 0)", systemImage: "scribble")
                }
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}

private struct LetterDetailView: View {
    let postID: String
    let initialPost: CaligraphiaPost
    let apiClient: CaligraphiaAPIClient

    @State private var post: CaligraphiaPost?
    @State private var errorMessage: String?

    private var displayPost: CaligraphiaPost {
        post ?? initialPost
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                AsyncImage(url: absoluteURL(displayPost.imageUrl ?? displayPost.finalImageUrl ?? displayPost.uploadedPhotoUrl, baseURL: apiClient.baseURL)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                    case .failure:
                        ContentUnavailableView("Image unavailable", systemImage: "photo")
                    case .empty:
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 240)
                    @unknown default:
                        EmptyView()
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 6) {
                    Text(displayPost.user?.username ?? "A writer")
                        .font(.title3.weight(.semibold))
                    Text(displayPost.createdAt.formatted(date: .abbreviated, time: .shortened))
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    if !displayPost.ocrHashtags.isEmpty {
                        Text(displayPost.ocrHashtags.joined(separator: " "))
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Letter")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            do {
                post = try await apiClient.post(id: postID)
            } catch {
                errorMessage = userMessage(for: error)
            }
        }
    }
}

private func absoluteURL(_ value: String?, baseURL: URL) -> URL? {
    guard let value else { return nil }
    if let url = URL(string: value), url.scheme != nil {
        return url
    }
    return URL(string: value, relativeTo: baseURL)?.absoluteURL
}

func userMessage(for error: Error) -> String {
    if case let APIError.httpStatus(status, _) = error {
        if status == 401 {
            return "Not authenticated. Sign in and try again."
        }
        return "Server returned HTTP \(status)."
    }
    return error.localizedDescription
}

#Preview {
    RootView()
}
