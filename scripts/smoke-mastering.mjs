import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const fixturePath = join(tmpdir(), `fukkun-smoke-${process.pid}.wav`);
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
let outputPath = "";

const removeIfPresent = (filePath) => {
  if (filePath && existsSync(filePath)) {
    unlinkSync(filePath);
  }
};

try {
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=440:duration=12",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=80:duration=12",
    "-filter_complex",
    "[0:a][1:a]amix=inputs=2:weights=0.25 0.4",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-c:a",
    "pcm_f32le",
    fixturePath,
  ]);

  delete process.env.OPENAI_API_KEY;

  const route = require("../.next/server/app/api/mastering/route.js");
  const { POST } = route.routeModule.userland;

  const invalidFormData = new FormData();
  invalidFormData.append(
    "audio",
    new File(["not audio"], "invalid.txt", { type: "text/plain" }),
  );
  const invalidResponse = await POST(
    new Request("http://localhost/api/mastering", {
      method: "POST",
      body: invalidFormData,
    }),
  );

  assert.equal(invalidResponse.status, 415);

  const audio = readFileSync(fixturePath);
  const formData = new FormData();

  formData.append(
    "audio",
    new File([audio], "smoke-input.wav", { type: "audio/wav" }),
  );
  formData.append("targetSound", "自然仕上げ");

  console.log = () => {};
  console.warn = () => {};

  const response = await POST(
    new Request("http://localhost/api/mastering", {
      method: "POST",
      body: formData,
    }),
  );
  const body = await response.json();

  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;

  assert.equal(response.status, 200, body.message);
  assert.equal(body.success, true);
  assert.equal(body.referenceApplied, false);
  assert.ok(body.masteredFileUrl);

  outputPath = join(process.cwd(), "public", body.masteredFileUrl);
  assert.equal(existsSync(outputPath), true);

  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=sample_rate,channels,bits_per_sample",
        "-of",
        "json",
        outputPath,
      ],
      { encoding: "utf8" },
    ),
  );
  const stream = probe.streams?.[0];
  const loudness = body.analysis?.measuredLoudness;

  assert.equal(stream?.sample_rate, "48000");
  assert.equal(stream?.channels, 2);
  assert.equal(stream?.bits_per_sample, 24);
  assert.ok(Math.abs(loudness.integratedLufs - -12) <= 0.2);
  assert.ok(loudness.truePeakDbfs <= -1.3);

  process.stdout.write(
    `Smoke test passed: ${loudness.integratedLufs} LUFS / ${loudness.truePeakDbfs} dBTP\n`,
  );
} finally {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  removeIfPresent(fixturePath);
  removeIfPresent(outputPath);
}
