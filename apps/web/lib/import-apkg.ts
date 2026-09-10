import { API_URL } from "./config";

export type ApkgImportResult = {
  importedCount: number;
  skippedCount: number;
};

export type ApkgUploadProgress =
  | { phase: "uploading"; percent: number }
  | { phase: "processing" };

export function uploadApkg(
  file: File,
  deckId: string,
  onProgress: (update: ApkgUploadProgress) => void,
): Promise<ApkgImportResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/api/import/apkg?deckId=${encodeURIComponent(deckId)}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Content-Type", "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) {
        return;
      }
      const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
      if (percent >= 100) {
        onProgress({ phase: "processing" });
      } else {
        onProgress({ phase: "uploading", percent });
      }
    };
    xhr.upload.onload = () => onProgress({ phase: "processing" });

    xhr.onload = () => {
      let json: { importedCount?: number; skippedCount?: number; error?: string } = {};
      try {
        json = JSON.parse(xhr.responseText) as typeof json;
      } catch {
        reject(new Error("Anki import failed"));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(json.error ?? "Anki import failed"));
        return;
      }
      resolve({
        importedCount: json.importedCount ?? 0,
        skippedCount: json.skippedCount ?? 0,
      });
    };
    xhr.onerror = () => reject(new Error("Network error while uploading the Anki package"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });
}
