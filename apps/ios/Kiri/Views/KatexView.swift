import SwiftUI
import WebKit

/// Renders card text: plain prose in SwiftUI, math/HTML in a small WebKit view.
struct KatexView: View {
    let latex: String
    var block: Bool = false

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        if KatexSegments.isPlainProse(latex) {
            Text(latex)
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            KatexWebView(text: latex, block: block, colorScheme: colorScheme)
                .frame(minHeight: 44)
        }
    }
}

private struct KatexWebView: UIViewRepresentable {
    let text: String
    let block: Bool
    let colorScheme: ColorScheme

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var loadedKey: String?
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.backgroundColor = .clear
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let key = "\(colorScheme == .dark)-\(block)-\(text)"
        if context.coordinator.loadedKey == key { return }
        context.coordinator.loadedKey = key
        webView.loadHTMLString(html(for: text), baseURL: URL(string: "https://cdn.jsdelivr.net"))
    }

    private func html(for text: String) -> String {
        let textColor = colorScheme == .dark ? "#e8edf4" : "#1c1c1e"
        let muted = colorScheme == .dark ? "#9aa4b2" : "#636366"

        if KatexSegments.looksLikeHtml(text) {
            return """
            <!DOCTYPE html><html><head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { margin: 0; padding: 8px; background: transparent; color: \(textColor);
                     font-family: -apple-system, sans-serif; font-size: 16px; line-height: 1.45; }
              img { max-width: 100%; height: auto; }
            </style></head><body>\(text)</body></html>
            """
        }

        let bodyContent: String
        if KatexSegments.isFormulaLine(text) {
            let trimmed = jsEscape(text.trimmingCharacters(in: .whitespacesAndNewlines))
            bodyContent = """
            <div id="math"></div>
            <script>
              document.addEventListener("DOMContentLoaded", function() {
                try {
                  katex.render('\(trimmed)', document.getElementById("math"), {
                    throwOnError: false,
                    displayMode: \(block ? "true" : "false")
                  });
                } catch (e) {
                  document.getElementById("math").innerHTML = '<span class="fallback">\(trimmed)</span>';
                }
              });
            </script>
            """
        } else {
            let segments = KatexSegments.split(text)
            var parts: [String] = ["<div class=\"prose\">"]
            for (index, segment) in segments.enumerated() {
                switch segment {
                case .text(let value):
                    if !value.isEmpty {
                        parts.append("<span>\(htmlEscape(value))</span>")
                    }
                case .math(let value, let display):
                    let id = "math-\(index)"
                    let escaped = jsEscape(value)
                    parts.append("""
                    <span id="\(id)"></span>
                    <script>
                      document.addEventListener("DOMContentLoaded", function() {
                        katex.render('\(escaped)', document.getElementById('\(id)'), {
                          throwOnError: false,
                          displayMode: \(display ? "true" : "false")
                        });
                      });
                    </script>
                    """)
                }
            }
            parts.append("</div>")
            bodyContent = parts.joined()
        }

        return """
        <!DOCTYPE html><html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
        <style>
          body { margin: 0; padding: 8px; background: transparent; color: \(textColor);
                 font-family: -apple-system, sans-serif; font-size: 16px; line-height: 1.45; }
          .prose { white-space: pre-wrap; }
          .fallback { white-space: pre-wrap; color: \(muted); }
          .katex { color: \(textColor); }
        </style></head><body>
        \(bodyContent)
        </body></html>
        """
    }

    private func htmlEscape(_ string: String) -> String {
        string
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private func jsEscape(_ string: String) -> String {
        string
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "")
    }
}

#Preview {
    VStack(alignment: .leading, spacing: 16) {
        KatexView(latex: "What is the capital of France?")
        KatexView(latex: "\\text{H}_2\\text{SO}_4")
        KatexView(latex: "Mix $x^2$ with words")
    }
    .padding()
}
