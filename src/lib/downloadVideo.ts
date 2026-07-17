import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

export async function downloadVideo(streamUrl: string, fileName: string) {
  const directory = new Directory(Paths.cache, "generated-videos");
  directory.create({ idempotent: true, intermediates: true });

  const destination = new File(
    directory,
    `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
  );
  const downloaded = await File.downloadFileAsync(streamUrl, destination);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Saving files is not available on this device.");
  }

  await Sharing.shareAsync(downloaded.uri, {
    mimeType: "video/mp4",
    UTI: "public.mpeg-4",
    dialogTitle: "Save or share video",
  });
}
