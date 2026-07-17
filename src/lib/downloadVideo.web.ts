export async function downloadVideo(streamUrl: string, fileName: string) {
  const response = await fetch(streamUrl);

  if (!response.ok) {
    throw new Error("The video download link has expired. Refresh it and try again.");
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
}
