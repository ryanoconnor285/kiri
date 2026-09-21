import SwiftUI

/// Design tokens aligned with web `globals.css` (visual-only refresh).
enum KiriTheme {
    static func background(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.06, green: 0.07, blue: 0.08) : Color(red: 0.97, green: 0.97, blue: 0.98)
    }

    static func surface(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.10, green: 0.11, blue: 0.14) : .white
    }

    static func surfaceSecondary(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.14, green: 0.16, blue: 0.19) : Color(red: 0.95, green: 0.95, blue: 0.96)
    }

    static func border(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.18, green: 0.20, blue: 0.24) : Color(red: 0.90, green: 0.91, blue: 0.92)
    }

    static func accent(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.23, green: 0.60, blue: 0.65) : Color(red: 0.055, green: 0.44, blue: 0.48)
    }

    static func canvasPaper(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.16, green: 0.16, blue: 0.14) : Color(red: 0.99, green: 0.98, blue: 0.97)
    }

    static func success(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.36, green: 0.72, blue: 0.53) : Color(red: 0.31, green: 0.69, blue: 0.48)
    }

    static func warning(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.88, green: 0.69, blue: 0.31) : Color(red: 0.85, green: 0.64, blue: 0.25)
    }

    static func danger(_ scheme: ColorScheme) -> Color {
        scheme == .dark ? Color(red: 0.88, green: 0.44, blue: 0.44) : Color(red: 0.77, green: 0.36, blue: 0.36)
    }

    static let radiusMD: CGFloat = 12
    static let radiusLG: CGFloat = 16
}

struct KiriSurfaceCard: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .background(KiriTheme.surface(colorScheme))
            .clipShape(RoundedRectangle(cornerRadius: KiriTheme.radiusMD))
            .overlay(
                RoundedRectangle(cornerRadius: KiriTheme.radiusMD)
                    .stroke(KiriTheme.border(colorScheme), lineWidth: 1)
            )
    }
}

extension View {
    func kiriSurfaceCard() -> some View {
        modifier(KiriSurfaceCard())
    }
}
