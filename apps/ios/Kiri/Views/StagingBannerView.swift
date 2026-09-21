import SwiftUI

struct StagingBannerView: View {
    let checker: APIHealthChecker

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text("STAGING")
                    .font(.caption.weight(.bold))
                    .tracking(0.5)
                Text(APIConfig.displayHost)
                    .font(.caption2)
                    .lineLimit(1)
                    .truncationMode(.middle)
                    .opacity(0.9)
                Spacer(minLength: 8)
                connectionLabel
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .frame(maxWidth: .infinity)
            .background(Color.orange)
            .foregroundStyle(.white)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilitySummary)
    }

    @ViewBuilder
    private var connectionLabel: some View {
        switch checker.status {
        case .idle, .checking:
            Label("Checking…", systemImage: "ellipsis.circle")
                .font(.caption2.weight(.medium))
        case .reachable:
            Label("Connected", systemImage: "checkmark.circle.fill")
                .font(.caption2.weight(.medium))
        case .unreachable:
            Button {
                Task { await checker.check() }
            } label: {
                Label("Retry", systemImage: "exclamationmark.triangle.fill")
                    .font(.caption2.weight(.medium))
            }
            .buttonStyle(.plain)
        }
    }

    private var accessibilitySummary: String {
        let host = APIConfig.displayHost
        switch checker.status {
        case .idle, .checking:
            return "Staging environment, \(host), checking server connection"
        case .reachable:
            return "Staging environment, \(host), server connected"
        case .unreachable(let message):
            return "Staging environment, \(host), server unreachable, \(message)"
        }
    }
}

#Preview {
    StagingBannerView(checker: APIHealthChecker.shared)
}
