import SwiftUI

struct RootView: View {
    @Bindable private var session = SessionManager.shared
    @Bindable private var health = APIHealthChecker.shared

    var body: some View {
        VStack(spacing: 0) {
            if APIConfig.isStaging {
                StagingBannerView(checker: health)
            }
            Group {
                if session.isAuthenticated {
                    DeckListView()
                } else {
                    LoginView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(uiColor: .systemBackground))
        .task {
            if APIConfig.isStaging {
                await health.checkOnLaunch()
            }
        }
    }
}

#Preview {
    RootView()
}
