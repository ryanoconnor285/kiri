import SwiftUI
import WebKit

struct KatexView: UIViewRepresentable {
    let latex: String

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    final class Coordinator {
        var lastLatex: String?
    }

    func makeUIView(context: Context) -> WKWebView {
        let webView = WKWebView()
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        if context.coordinator.lastLatex == latex { return }
        context.coordinator.lastLatex = latex

        let escaped = latex
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
            .replacingOccurrences(of: "\n", with: "<br>")

        let html = """
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css">
          <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js"></script>
          <style>
            body { margin: 0; padding: 8px; background: transparent; color: #e8edf4;
                   font-family: -apple-system, sans-serif; }
            .fallback { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <div id="math"></div>
          <script>
            document.addEventListener("DOMContentLoaded", function() {
              try {
                katex.render('\(escaped)', document.getElementById("math"), {
                  throwOnError: false,
                  displayMode: true
                });
              } catch (e) {
                document.getElementById("math").innerHTML =
                  '<span class="fallback">\(escaped)</span>';
              }
            });
          </script>
        </body>
        </html>
        """
        webView.loadHTMLString(html, baseURL: nil)
    }
}

#Preview {
    KatexView(latex: "\\text{H}_2\\text{SO}_4")
        .frame(height: 80)
}
