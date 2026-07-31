import json
import math
import struct
import sys
import numpy as np


WAVE_FORMAT_PCM = 1
WAVE_FORMAT_IEEE_FLOAT = 3
WAVE_FORMAT_EXTENSIBLE = 0xFFFE


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

        (
            container_audio_format,
            channels,
            frame_rate,
            byte_rate,
            block_align,
            bits_per_sample,
        ) = struct.unpack("<HHIIHH", fmt[:16])

        audio_format = container_audio_format
        valid_bits_per_sample = bits_per_sample

        if container_audio_format == WAVE_FORMAT_EXTENSIBLE:
            if len(fmt) < 40:
                raise ValueError(
                    "WAVE_FORMAT_EXTENSIBLEのfmtチャンクが短すぎます"
                )

            valid_bits_per_sample = struct.unpack(
                "<H",
                fmt[18:20],
            )[0]

            sub_format_code = struct.unpack(
                "<H",
                fmt[24:26],
            )[0]

            if sub_format_code not in (
                WAVE_FORMAT_PCM,
                WAVE_FORMAT_IEEE_FLOAT,
            ):
                raise ValueError(
                    f"Unsupported WAVE_FORMAT_EXTENSIBLE sub format: {sub_format_code}"
                )

            audio_format = sub_format_code

        sample_width = bits_per_sample // 8
        frames = len(audio_data) // block_align
        duration_seconds = frames / float(frame_rate)

        return {
            "audio_format": audio_format,
            "container_audio_format": container_audio_format,
            "channels": channels,
            "frame_rate": frame_rate,
            "sample_width": sample_width,
            "bits_per_sample": bits_per_sample,
            "valid_bits_per_sample": valid_bits_per_sample,
            "frames": frames,
            "duration_seconds": duration_seconds,
            "audio_data": audio_data,
        }


def decode_pcm_24(audio_data):
    raw_bytes = np.frombuffer(audio_data, dtype=np.uint8)

    usable_byte_count = (len(raw_bytes) // 3) * 3

    if usable_byte_count == 0:
        return []

    raw_bytes = raw_bytes[:usable_byte_count].reshape(-1, 3)

    samples = (
        raw_bytes[:, 0].astype(np.int32)
        | (raw_bytes[:, 1].astype(np.int32) << 8)
        | (raw_bytes[:, 2].astype(np.int32) << 16)
    )

    negative_mask = (samples & 0x800000) != 0
    samples[negative_mask] -= 1 << 24

    return (
        samples.astype(np.float32)
        / float(2 ** 23)
    ).tolist()


def calculate_rms(audio_data, audio_format, bits_per_sample):
    samples = decode_samples(
        audio_data,
        audio_format,
        bits_per_sample,
    )

    if not samples:
        return 0.0

    sample_array = np.asarray(samples, dtype=np.float64)

    return float(
        np.sqrt(
            np.mean(
                np.square(sample_array)
            )
        )
    )


def decode_samples(audio_data, audio_format, bits_per_sample):
    sample_width = bits_per_sample // 8

    if sample_width <= 0:
        raise ValueError(
            f"Invalid bits_per_sample: {bits_per_sample}"
        )

    sample_count = len(audio_data) // sample_width

    if sample_count == 0:
        return []

    if (
        audio_format == WAVE_FORMAT_IEEE_FLOAT
        and bits_per_sample == 32
    ):
        samples = np.frombuffer(
            audio_data,
            dtype="<f4",
        )

        return samples.astype(np.float32).tolist()

    if (
        audio_format == WAVE_FORMAT_PCM
        and bits_per_sample == 16
    ):
        samples = np.frombuffer(
            audio_data,
            dtype="<i2",
        )

        return (
            samples.astype(np.float32)
            / float(2 ** 15)
        ).tolist()

    if (
        audio_format == WAVE_FORMAT_PCM
        and bits_per_sample == 24
    ):
        return decode_pcm_24(audio_data)

    if (
        audio_format == WAVE_FORMAT_PCM
        and bits_per_sample == 32
    ):
        samples = np.frombuffer(
            audio_data,
            dtype="<i4",
        )

        return (
            samples.astype(np.float32)
            / float(2 ** 31)
        ).tolist()

    raise ValueError(
        "Unsupported WAV format: "
        f"audio_format={audio_format}, bits={bits_per_sample}"
    )


def calculate_peak(samples):
    if not samples:
        return 0.0
    return float(max(abs(sample) for sample in samples))


def amplitude_to_dbfs(amplitude):
    if amplitude <= 0:
        return -120.0
    return 20.0 * math.log10(amplitude)


def calculate_zero_crossing_rate(samples):
    if len(samples) < 2:
        return 0.0

    crossings = 0

    for previous, current in zip(samples[:-1], samples[1:]):
        if (previous < 0 <= current) or (previous >= 0 > current):
            crossings += 1

    return crossings / (len(samples) - 1)


def calculate_spectral_features(samples, sample_rate):
    if len(samples) < 2:
        return {
            "spectral_centroid": 0.0,
            "spectral_rolloff": 0.0,
        }

    data = np.array(samples, dtype=np.float32)

    spectrum = np.abs(np.fft.rfft(data))
    frequencies = np.fft.rfftfreq(len(data), d=1.0 / sample_rate)

    spectrum_sum = np.sum(spectrum)

    if spectrum_sum == 0:
        return {
            "spectral_centroid": 0.0,
            "spectral_rolloff": 0.0,
        }

    spectral_centroid = np.sum(frequencies * spectrum) / spectrum_sum

    cumulative = np.cumsum(spectrum)
    rolloff_index = np.searchsorted(cumulative, cumulative[-1] * 0.85)

    spectral_rolloff = frequencies[
        min(rolloff_index, len(frequencies) - 1)
    ]

    return {
        "spectral_centroid": float(spectral_centroid),
        "spectral_rolloff": float(spectral_rolloff),
    }

def estimate_frequency_balance(fft_analysis):
    return {
        "bass_energy": round(
            (fft_analysis["sub_bass"] + fft_analysis["bass"]) / 2,
            1,
        ),
        "mid_energy": round(
            fft_analysis["mid"],
            1,
        ),
        "treble_energy": round(
            (fft_analysis["presence"] + fft_analysis["air"]) / 2,
            1,
        ),
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
def classify_section_density(rms, crest_factor, bass_energy):
    if rms < 0.08:
        return "low"

    if rms >= 0.24 or bass_energy >= 75:
        return "high"

    if crest_factor >= 8 and rms < 0.18:
        return "low"

    return "medium"


def analyze_sections(
    samples,
    sample_rate,
    channels,
    section_duration_seconds=5,
):
    if not samples or sample_rate <= 0 or channels <= 0:
        return []

    sample_array = np.array(samples, dtype=np.float32)

    usable_sample_count = (
        len(sample_array) // channels
    ) * channels

    if usable_sample_count == 0:
        return []

    sample_array = sample_array[:usable_sample_count]
    frame_array = sample_array.reshape(-1, channels)
    mono_samples = np.mean(frame_array, axis=1)

    section_frame_count = max(
        1,
        int(sample_rate * section_duration_seconds),
    )

    sections = []
    total_frames = len(mono_samples)

    for start_frame in range(0, total_frames, section_frame_count):
        end_frame = min(
            start_frame + section_frame_count,
            total_frames,
        )

        section_samples = mono_samples[start_frame:end_frame]

        if len(section_samples) == 0:
            continue

        section_rms = float(
            np.sqrt(np.mean(np.square(section_samples)))
        )
        section_peak = float(np.max(np.abs(section_samples)))
        section_crest_factor = (
            section_peak / section_rms
            if section_rms > 0
            else 0.0
        )

        section_fft = analyze_fft(
            section_samples.tolist(),
            sample_rate,
        )
        section_frequency_balance = estimate_frequency_balance(
            section_fft
        )

        sections.append(
            {
                "start": round(start_frame / sample_rate, 2),
                "end": round(end_frame / sample_rate, 2),
                "rms": round(section_rms, 4),
                "peak_dbfs": round(
                    amplitude_to_dbfs(section_peak),
                    2,
                ),
                "crest_factor": round(
                    section_crest_factor,
                    2,
                ),
                "bass_energy": section_frequency_balance[
                    "bass_energy"
                ],
                "mid_energy": section_frequency_balance[
                    "mid_energy"
                ],
                "treble_energy": section_frequency_balance[
                    "treble_energy"
                ],
                "density": classify_section_density(
                    section_rms,
                    section_crest_factor,
                    section_frequency_balance["bass_energy"],
                ),
            }
        )

    return sections


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
    fft_analysis = analyze_fft(samples, wav_info["frame_rate"])
    frequency_balance = estimate_frequency_balance(fft_analysis)
    peak = calculate_peak(samples)
    peak_dbfs = amplitude_to_dbfs(peak)
    crest_factor = peak / normalized_rms if normalized_rms > 0 else 0

    rms_dbfs = amplitude_to_dbfs(normalized_rms)
    dynamic_range_db = peak_dbfs - rms_dbfs if normalized_rms > 0 else 0

    zero_crossing_rate = calculate_zero_crossing_rate(samples)

    spectral_features = calculate_spectral_features(
        samples,
        wav_info["frame_rate"],
    )

    sections = analyze_sections(
        samples,
        wav_info["frame_rate"],
        wav_info["channels"],
        section_duration_seconds=5,
    )

    return {
        "channels": wav_info["channels"],
        "sample_width": wav_info["sample_width"],
        "frame_rate": wav_info["frame_rate"],
        "frames": wav_info["frames"],
        "duration_seconds": round(wav_info["duration_seconds"], 2),
        "rms": normalized_rms,
        "audio_format": wav_info["audio_format"],
        "container_audio_format": wav_info["container_audio_format"],
        "bits_per_sample": wav_info["bits_per_sample"],
        "valid_bits_per_sample": wav_info["valid_bits_per_sample"],
        "bass_energy": frequency_balance["bass_energy"],
        "mid_energy": frequency_balance["mid_energy"],
        "treble_energy": frequency_balance["treble_energy"],

        "peak_dbfs": round(peak_dbfs, 2),
        "crest_factor": round(crest_factor, 2),
        "dynamic_range_db": round(dynamic_range_db, 2),
        "zero_crossing_rate": round(zero_crossing_rate, 6),
        "spectral_centroid": round(
            spectral_features["spectral_centroid"], 2
        ),
        "spectral_rolloff": round(
            spectral_features["spectral_rolloff"], 2
        ),

        "fft": fft_analysis,
        "sections": sections,
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