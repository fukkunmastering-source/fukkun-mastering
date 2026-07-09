import json
import math
import struct
import sys
import numpy as np


WAVE_FORMAT_PCM = 1
WAVE_FORMAT_IEEE_FLOAT = 3


def read_chunk(file):
    chunk_id = file.read(4)
    if len(chunk_id) < 4:
        return None, None, None

    chunk_size_bytes = file.read(4)
    if len(chunk_size_bytes) < 4:
        return None, None, None

    chunk_size = struct.unpack("<I", chunk_size_bytes)[0]
    chunk_data = file.read(chunk_size)

    if chunk_size % 2 == 1:
        file.read(1)

    return chunk_id, chunk_size, chunk_data


def parse_wav(file_path):
    with open(file_path, "rb") as file:
        riff = file.read(4)
        file.read(4)
        wave = file.read(4)

        if riff != b"RIFF" or wave != b"WAVE":
            raise ValueError("WAVファイルではありません")

        fmt = None
        audio_data = None

        while True:
            chunk_id, chunk_size, chunk_data = read_chunk(file)

            if chunk_id is None:
                break

            if chunk_id == b"fmt ":
                fmt = chunk_data
            elif chunk_id == b"data":
                audio_data = chunk_data

            if fmt is not None and audio_data is not None:
                break

        if fmt is None or audio_data is None:
            raise ValueError("WAVのfmtまたはdataチャンクが見つかりません")

        audio_format, channels, frame_rate, byte_rate, block_align, bits_per_sample = struct.unpack(
            "<HHIIHH", fmt[:16]
        )

        sample_width = bits_per_sample // 8
        frames = len(audio_data) // block_align
        duration_seconds = frames / float(frame_rate)

        return {
            "audio_format": audio_format,
            "channels": channels,
            "frame_rate": frame_rate,
            "sample_width": sample_width,
            "bits_per_sample": bits_per_sample,
            "frames": frames,
            "duration_seconds": duration_seconds,
            "audio_data": audio_data,
        }


def calculate_rms(audio_data, audio_format, bits_per_sample):
    sample_width = bits_per_sample // 8
    sample_count = len(audio_data) // sample_width

    if sample_count == 0:
        return 0

    if audio_format == WAVE_FORMAT_IEEE_FLOAT and bits_per_sample == 32:
        samples = struct.unpack(f"<{sample_count}f", audio_data)
        return math.sqrt(sum(sample * sample for sample in samples) / len(samples))

    if audio_format == WAVE_FORMAT_PCM and bits_per_sample == 16:
        samples = struct.unpack(f"<{sample_count}h", audio_data)
        rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
        return rms / float(2 ** 15)

    if audio_format == WAVE_FORMAT_PCM and bits_per_sample == 32:
        samples = struct.unpack(f"<{sample_count}i", audio_data)
        rms = math.sqrt(sum(sample * sample for sample in samples) / len(samples))
        return rms / float(2 ** 31)

    raise ValueError(f"Unsupported WAV format: audio_format={audio_format}, bits={bits_per_sample}")


def decode_samples(audio_data, audio_format, bits_per_sample):
    sample_width = bits_per_sample // 8
    sample_count = len(audio_data) // sample_width

    if sample_count == 0:
        return []

    if audio_format == WAVE_FORMAT_IEEE_FLOAT and bits_per_sample == 32:
        return list(struct.unpack(f"<{sample_count}f", audio_data))

    if audio_format == WAVE_FORMAT_PCM and bits_per_sample == 16:
        samples = struct.unpack(f"<{sample_count}h", audio_data)
        return [sample / float(2 ** 15) for sample in samples]

    if audio_format == WAVE_FORMAT_PCM and bits_per_sample == 32:
        samples = struct.unpack(f"<{sample_count}i", audio_data)
        return [sample / float(2 ** 31) for sample in samples]

    raise ValueError(f"Unsupported WAV format: audio_format={audio_format}, bits={bits_per_sample}")


def estimate_frequency_balance(samples):
    if len(samples) < 2:
        return {
            "bass_energy": 0,
            "mid_energy": 0,
            "treble_energy": 0,
            "zero_crossing_rate": 0,
        }

    zero_crossings = 0

    for index in range(1, len(samples)):
        previous_sample = samples[index - 1]
        current_sample = samples[index]

        if (previous_sample < 0 and current_sample >= 0) or (previous_sample >= 0 and current_sample < 0):
            zero_crossings += 1

    zero_crossing_rate = zero_crossings / len(samples)

    bass_energy = max(0, min(100, round((0.08 - zero_crossing_rate) * 1250)))
    treble_energy = max(0, min(100, round((zero_crossing_rate - 0.02) * 1250)))
    mid_energy = max(0, min(100, 100 - abs(bass_energy - treble_energy)))

    return {
        "bass_energy": bass_energy,
        "mid_energy": mid_energy,
        "treble_energy": treble_energy,
        "zero_crossing_rate": zero_crossing_rate,
    }


def analyze_fft(samples, sample_rate):
    if len(samples) < 2:
        return {
            "sub_bass": 0,
            "bass": 0,
            "mid": 0,
            "presence": 0,
            "air": 0,
        }

    data = np.array(samples, dtype=np.float32)
    spectrum = np.abs(np.fft.rfft(data))
    frequencies = np.fft.rfftfreq(len(data), d=1.0 / sample_rate)

    def band_energy(low, high):
        mask = (frequencies >= low) & (frequencies < high)
        if not np.any(mask):
            return 0.0
        return float(np.mean(spectrum[mask]))

    energies = {
        "sub_bass": band_energy(20, 60),
        "bass": band_energy(60, 250),
        "mid": band_energy(250, 2000),
        "presence": band_energy(2000, 8000),
        "air": band_energy(8000, 20000),
    }

    maximum = max(energies.values()) if max(energies.values()) > 0 else 1.0

    return {
        key: round((value / maximum) * 100, 1)
        for key, value in energies.items()
    }


def analyze_wav(file_path):
    wav_info = parse_wav(file_path)
    normalized_rms = calculate_rms(
        wav_info["audio_data"],
        wav_info["audio_format"],
        wav_info["bits_per_sample"],
    )
    samples = decode_samples(
        wav_info["audio_data"],
        wav_info["audio_format"],
        wav_info["bits_per_sample"],
    )
    frequency_balance = estimate_frequency_balance(samples)
    fft_analysis = analyze_fft(samples, wav_info["frame_rate"])

    return {
        "channels": wav_info["channels"],
        "sample_width": wav_info["sample_width"],
        "frame_rate": wav_info["frame_rate"],
        "frames": wav_info["frames"],
        "duration_seconds": round(wav_info["duration_seconds"], 2),
        "rms": normalized_rms,
        "audio_format": wav_info["audio_format"],
        "bits_per_sample": wav_info["bits_per_sample"],
        "bass_energy": frequency_balance["bass_energy"],
        "mid_energy": frequency_balance["mid_energy"],
        "treble_energy": frequency_balance["treble_energy"],
        "zero_crossing_rate": frequency_balance["zero_crossing_rate"],
        "fft": fft_analysis,
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "音源ファイルのパスが指定されていません"}, ensure_ascii=False))
        return

    file_path = sys.argv[1]

    try:
        analysis = analyze_wav(file_path)
        print(json.dumps(analysis, ensure_ascii=False))
    except Exception as error:
        print(json.dumps({"error": str(error)}, ensure_ascii=False))


if __name__ == "__main__":
    main()