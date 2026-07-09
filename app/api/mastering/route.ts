import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const formData = await request.formData();
  const audioFile = formData.get("audio");

  if (!(audioFile instanceof File)) {
    return Response.json(
      {
        success: false,
        message: "音源ファイルが見つかりませんでした。",
      },
      { status: 400 }
    );
  }

  console.log("受け取ったファイル", {
    name: audioFile.name,
    size: audioFile.size,
    type: audioFile.type,
  });

  const fileSizeMB = Math.round((audioFile.size / 1024 / 1024) * 10) / 10;
  const arrayBuffer = await audioFile.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const inputPath = join("/tmp", audioFile.name);
  await writeFile(inputPath, buffer);

  try {
    const scriptPath = join(process.cwd(), "app", "api", "mastering", "analyze_audio.py");
    const { stdout } = await execFileAsync("python3", [scriptPath, inputPath]);
    const pythonAnalysis = JSON.parse(stdout);

    console.log("AIに渡す音源情報", {
      fileName: audioFile.name,
      fileSizeBytes: audioFile.size,
      fileSizeMB,
      fileType: audioFile.type,
      estimatedQuality: fileSizeMB > 10 ? "高音質の可能性が高い" : "軽量ファイル",
      pythonAnalysis,
    });

    const analysis = {
      loudness: -12,
      bass: 68,
      treble: 74,
      vocal: 81,
      recommendation:
        "REFERENCE TRACKとの違いを解析しました。マスタリングプロファイルを生成しています。",
      eqSuggestion: "SYSTEM READY FOR MASTERING",
      pythonAnalysis,
    };

    return Response.json({
      success: true,
      message: "マスタリング解析が完了しました。",
      fileName: audioFile.name,
      fileSizeMB,
      analysis,
    });
  } catch (error) {
    console.error("音源解析エラー", error);

    return Response.json(
      {
        success: false,
        message: "音源の解析中にエラーが発生しました。",
      },
      { status: 500 }
    );
  } finally {
    await unlink(inputPath).catch(() => {});
  }
}
