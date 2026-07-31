import OpenAI from "openai";
import {
  mkdir,
  writeFile,
  unlink,
  rename,
} from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type SectionMasteringAdjustment = {
  start: number;
  end: number;
  bassGain: number;
  vocalGain: number;
  trebleGain: number;
};

type MasteringSettings = {
  bassGain: number;
  vocalGain: number;
  trebleGain: number;

  dynamicEq: {
    threshold: number;
    range: number;
    attack: number;
    release: number;
    frequency: number;
  };

  compressor: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
    makeup: number;
    mix: number;
  };

  limiter: boolean;
  targetLufs: number;
  recommendation: string;
  sectionAdjustments: SectionMasteringAdjustment[];
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const roundToOneDecimal = (value: number) =>
  Math.round(value * 10) / 10;

type SectionAnalysis = {
  start: number;
  end: number;
  rms: number;
  peak_dbfs: number;
  crest_factor: number;
  bass_energy: number;
  mid_energy: number;
  treble_energy: number;
  density: "low" | "medium" | "high";
};

type SectionProfile = {
  start: number;
  end: number;
  density: "low" | "medium" | "high";
  averageRms: number;
  averageBassEnergy: number;
  averageMidEnergy: number;
  averageTrebleEnergy: number;
};

const average = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

const median = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middleIndex = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middleIndex - 1] + sorted[middleIndex]) / 2
    : sorted[middleIndex];
};

const standardDeviation = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  const mean = average(values);
  const variance = average(
    values.map((value) => (value - mean) ** 2),
  );

  return Math.sqrt(variance);
};

const hasMeaningfulSectionChange = (
  previous: SectionAnalysis,
  current: SectionAnalysis,
) => {
  const rmsDifference = Math.abs(
    current.rms - previous.rms,
  );

  const bassDifference = Math.abs(
    current.bass_energy - previous.bass_energy,
  );

  const midDifference = Math.abs(
    current.mid_energy - previous.mid_energy,
  );

  const trebleDifference = Math.abs(
    current.treble_energy - previous.treble_energy,
  );

  return (
    rmsDifference >= 0.08 ||
    bassDifference >= 18 ||
    midDifference >= 18 ||
    trebleDifference >= 6
  );
};

const buildSectionProfiles = (
  sections: SectionAnalysis[],
): SectionProfile[] => {
  const usableSections = sections.filter(
    (section) =>
      Number.isFinite(section.start) &&
      Number.isFinite(section.end) &&
      Number.isFinite(section.rms) &&
      Number.isFinite(section.bass_energy) &&
      Number.isFinite(section.mid_energy) &&
      Number.isFinite(section.treble_energy) &&
      section.end > section.start,
  );

  if (usableSections.length === 0) {
    return [];
  }

  const profiles: SectionProfile[] = [];
  let currentGroup: SectionAnalysis[] = [usableSections[0]];

  const pushCurrentGroup = () => {
    if (currentGroup.length === 0) {
      return;
    }

    const firstSection = currentGroup[0];
    const lastSection = currentGroup[currentGroup.length - 1];

    profiles.push({
      start: firstSection.start,
      end: lastSection.end,
      density: firstSection.density,

      averageRms:
        Math.round(
          average(
            currentGroup.map((section) => section.rms),
          ) * 1000,
        ) / 1000,

      averageBassEnergy: roundToOneDecimal(
        average(
          currentGroup.map(
            (section) => section.bass_energy,
          ),
        ),
      ),

      averageMidEnergy: roundToOneDecimal(
        average(
          currentGroup.map(
            (section) => section.mid_energy,
          ),
        ),
      ),

      averageTrebleEnergy: roundToOneDecimal(
        average(
          currentGroup.map(
            (section) => section.treble_energy,
          ),
        ),
      ),
    });
  };

  for (
    let index = 1;
    index < usableSections.length;
    index += 1
  ) {
    const section = usableSections[index];
    const previousSection = usableSections[index - 1];

    const isContinuous =
      Math.abs(
        section.start - previousSection.end,
      ) < 0.05;

    const hasSameDensity =
  section.density === previousSection.density;

const hasMeaningfulChange =
  hasMeaningfulSectionChange(
    previousSection,
    section,
  );

if (
  isContinuous &&
  hasSameDensity &&
  !hasMeaningfulChange
) {
  currentGroup.push(section);
  continue;
}

    pushCurrentGroup();
    currentGroup = [section];
  }

  pushCurrentGroup();

  return profiles;
};

const mergeSectionProfiles = (
  profiles: SectionProfile[],
): SectionProfile => {
  const totalDuration = profiles.reduce(
    (sum, profile) => sum + (profile.end - profile.start),
    0,
  );

  const weightedAverage = (
    getValue: (profile: SectionProfile) => number,
  ) => {
    if (totalDuration <= 0) {
      return 0;
    }

    return (
      profiles.reduce(
        (sum, profile) =>
          sum +
          getValue(profile) *
            (profile.end - profile.start),
        0,
      ) / totalDuration
    );
  };

  return {
    start: profiles[0].start,
    end: profiles[profiles.length - 1].end,

    density: profiles.reduce(
      (longest, profile) =>
        profile.end - profile.start >
        longest.end - longest.start
          ? profile
          : longest,
      profiles[0],
    ).density,

    averageRms:
      Math.round(
        weightedAverage(
          (profile) => profile.averageRms,
        ) * 1000,
      ) / 1000,

    averageBassEnergy: roundToOneDecimal(
      weightedAverage(
        (profile) => profile.averageBassEnergy,
      ),
    ),

    averageMidEnergy: roundToOneDecimal(
      weightedAverage(
        (profile) => profile.averageMidEnergy,
      ),
    ),

    averageTrebleEnergy: roundToOneDecimal(
      weightedAverage(
        (profile) => profile.averageTrebleEnergy,
      ),
    ),
  };
};

const smoothSectionProfiles = (
  profiles: SectionProfile[],
  minimumDurationSeconds = 3,
): SectionProfile[] => {
  if (profiles.length < 2) {
    return profiles;
  }

  const bridgeSmoothed: SectionProfile[] = [];

  for (
    let index = 0;
    index < profiles.length;
    index += 1
  ) {
    const current = profiles[index];
    const previous = bridgeSmoothed.at(-1);
    const next = profiles[index + 1];
    const currentDuration = current.end - current.start;

    const isShortBridge =
      currentDuration < minimumDurationSeconds &&
      previous !== undefined &&
      next !== undefined &&
      previous.density === next.density;

    if (isShortBridge && previous) {
      bridgeSmoothed.pop();

      bridgeSmoothed.push(
        mergeSectionProfiles([
          previous,
          current,
          next,
        ]),
      );

      index += 1;
      continue;
    }

    bridgeSmoothed.push(current);
  }

  const result: SectionProfile[] = [];

  for (
    let index = 0;
    index < bridgeSmoothed.length;
    index += 1
  ) {
    const current = bridgeSmoothed[index];
    const currentDuration =
      current.end - current.start;

    if (
      currentDuration >= minimumDurationSeconds ||
      bridgeSmoothed.length === 1
    ) {
      result.push(current);
      continue;
    }

    const previous = result.at(-1);
    const next = bridgeSmoothed[index + 1];

    if (!previous && next) {
      bridgeSmoothed[index + 1] =
        mergeSectionProfiles([
          current,
          next,
        ]);

      continue;
    }

    if (previous && !next) {
      result[result.length - 1] =
        mergeSectionProfiles([
          previous,
          current,
        ]);

      continue;
    }

    if (previous && next) {
      const previousDuration =
        previous.end - previous.start;

      const nextDuration =
        next.end - next.start;

      if (previousDuration >= nextDuration) {
        result[result.length - 1] =
          mergeSectionProfiles([
            previous,
            current,
          ]);
      } else {
        bridgeSmoothed[index + 1] =
          mergeSectionProfiles([
            current,
            next,
          ]);
      }
    }
  }

  return result;
};

const matchesSectionProfileBoundary = (
  adjustment: SectionMasteringAdjustment,
  profiles: SectionProfile[],
  toleranceSeconds = 0.05,
) =>
  profiles.some(
    (profile) =>
      Math.abs(profile.start - adjustment.start) <=
        toleranceSeconds &&
      Math.abs(profile.end - adjustment.end) <=
        toleranceSeconds,
  );

const summarizeSections = (sections: SectionAnalysis[]) => {
  const usableSections = sections.filter(
    (section) =>
      Number.isFinite(section.rms) &&
      Number.isFinite(section.bass_energy) &&
      Number.isFinite(section.mid_energy) &&
      Number.isFinite(section.treble_energy) &&
      section.rms > 0.005,
  );

  const rmsValues = usableSections.map((section) => section.rms);
  const bassValues = usableSections.map(
    (section) => section.bass_energy,
  );
  const midValues = usableSections.map(
    (section) => section.mid_energy,
  );
  const trebleValues = usableSections.map(
    (section) => section.treble_energy,
  );

  const bassMedian = median(bassValues);
  const midMedian = median(midValues);
  const trebleMedian = median(trebleValues);

  return {
    sectionDurationSeconds: 5,
    usableSectionCount: usableSections.length,

    rms: {
      mean: Math.round(average(rmsValues) * 1000) / 1000,
      median: Math.round(median(rmsValues) * 1000) / 1000,
      standardDeviation:
        Math.round(standardDeviation(rmsValues) * 1000) / 1000,
    },

    bass: {
      mean: roundToOneDecimal(average(bassValues)),
      median: roundToOneDecimal(bassMedian),
      standardDeviation: roundToOneDecimal(
        standardDeviation(bassValues),
      ),
    },

    mid: {
      mean: roundToOneDecimal(average(midValues)),
      median: roundToOneDecimal(midMedian),
      standardDeviation: roundToOneDecimal(
        standardDeviation(midValues),
      ),
    },

    treble: {
      mean: roundToOneDecimal(average(trebleValues)),
      median: roundToOneDecimal(trebleMedian),
      standardDeviation: roundToOneDecimal(
        standardDeviation(trebleValues),
      ),
    },

    balance: {
      bassToMidMedianRatio: roundToOneDecimal(
        bassMedian / Math.max(midMedian, 0.1),
      ),

      bassToTrebleMedianRatio: roundToOneDecimal(
        bassMedian / Math.max(trebleMedian, 0.1),
      ),
    },
  };
};
type SectionCorrectionCandidate = {
  start: number;
  end: number;
  density: "low" | "medium" | "high";
  severity: number;
  reasons: string[];
  suggestedBassGain: number;
  suggestedVocalGain: number;
  suggestedTrebleGain: number;
};

type SectionStructureGroup = {
  id: string;
  occurrences: Array<{
    start: number;
    end: number;
    density: "low" | "medium" | "high";
  }>;
  occurrenceCount: number;
  averageRms: number;
  averageBassEnergy: number;
  averageMidEnergy: number;
  averageTrebleEnergy: number;
};

type SectionStructureProfile = {
  sequence: Array<{
    start: number;
    end: number;
    groupId: string;
    density: "low" | "medium" | "high";
  }>;
  groups: SectionStructureGroup[];
};

type ProtectedSectionRange = {
  start: number;
  end: number;
  reason: "extreme-low-density" | "likely-outro-fade";
};


type GroundTruthScore = {
  overall: number;

  bass: number;
  mid: number;
  treble: number;

  loudness: number;
  dynamics: number;

  goodPoints: string[];
  improvements: string[];

  summary: string;
};

const buildSectionCorrectionCandidates = (
  profiles: SectionProfile[],
  summary: ReturnType<typeof summarizeSections>,
): SectionCorrectionCandidate[] => {
  const normalizeDifference = (
    value: number,
    median: number,
    std: number,
  ) => (value - median) / Math.max(std, 0.1);

  return profiles
    .map((profile) => {
      const bassDeviation = normalizeDifference(
        profile.averageBassEnergy,
        summary.bass.median,
        summary.bass.standardDeviation,
      );

      const midDeviation = normalizeDifference(
        profile.averageMidEnergy,
        summary.mid.median,
        summary.mid.standardDeviation,
      );

      const trebleDeviation = normalizeDifference(
        profile.averageTrebleEnergy,
        summary.treble.median,
        summary.treble.standardDeviation,
      );

      const rmsDeviation = normalizeDifference(
        profile.averageRms,
        summary.rms.median,
        summary.rms.standardDeviation,
      );

      const reasons: string[] = [];

      if (bassDeviation >= 0.8)
        reasons.push("低域が曲内中央値より強い");
      else if (bassDeviation <= -0.8)
        reasons.push("低域が曲内中央値より弱い");

      if (midDeviation >= 0.8)
        reasons.push("中域が曲内中央値より強い");
      else if (midDeviation <= -0.8)
        reasons.push("中域が曲内中央値より弱い");

      if (trebleDeviation >= 0.8)
        reasons.push("高域が曲内中央値より強い");
      else if (trebleDeviation <= -0.8)
        reasons.push("高域が曲内中央値より弱い");

      if (rmsDeviation >= 0.8)
        reasons.push("音量密度が曲内中央値より高い");
      else if (rmsDeviation <= -0.8)
        reasons.push("音量密度が曲内中央値より低い");

      return {
        start: profile.start,
        end: profile.end,
        density: profile.density,

        severity: roundToOneDecimal(
          Math.max(
            Math.abs(bassDeviation),
            Math.abs(midDeviation),
            Math.abs(trebleDeviation),
            Math.abs(rmsDeviation),
          ),
        ),

        reasons,

        suggestedBassGain: roundToOneDecimal(
          clamp(-bassDeviation * 0.5, -1, 1),
        ),

        suggestedVocalGain: roundToOneDecimal(
          clamp(-midDeviation * 0.4, -1, 1),
        ),

        suggestedTrebleGain: roundToOneDecimal(
          clamp(-trebleDeviation * 0.4, -1, 1),
        ),
      };
    })
    .filter(
      (candidate) =>
        candidate.reasons.length > 0 &&
        candidate.end - candidate.start >= 3,
    )
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 8);
};

const buildSectionStructureProfile = (
  profiles: SectionProfile[],
  summary: ReturnType<typeof summarizeSections>,
): SectionStructureProfile => {
  if (profiles.length === 0) {
    return {
      sequence: [],
      groups: [],
    };
  }

  const normalizeDifference = (
    value: number,
    medianValue: number,
    standardDeviationValue: number,
  ) =>
    (value - medianValue) /
    Math.max(standardDeviationValue, 0.1);

  const toFeatureVector = (profile: SectionProfile) => [
    normalizeDifference(
      profile.averageRms,
      summary.rms.median,
      summary.rms.standardDeviation,
    ),
    normalizeDifference(
      profile.averageBassEnergy,
      summary.bass.median,
      summary.bass.standardDeviation,
    ),
    normalizeDifference(
      profile.averageMidEnergy,
      summary.mid.median,
      summary.mid.standardDeviation,
    ),
    normalizeDifference(
      profile.averageTrebleEnergy,
      summary.treble.median,
      summary.treble.standardDeviation,
    ),
  ];

  const featureDistance = (
    first: number[],
    second: number[],
  ) =>
    Math.sqrt(
      first.reduce(
        (sum, value, index) =>
          sum + (value - second[index]) ** 2,
        0,
      ) / first.length,
    );

  const densityPenalty = (
    first: SectionProfile["density"],
    second: SectionProfile["density"],
  ) => (first === second ? 0 : 0.35);

  const groups: Array<{
    id: string;
    members: SectionProfile[];
    centroid: number[];
  }> = [];

  const sequence = profiles.map((profile) => {
    const featureVector = toFeatureVector(profile);

    let bestGroupIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;

    groups.forEach((group, groupIndex) => {
      const representative = group.members[0];

      const distance =
        featureDistance(
          featureVector,
          group.centroid,
        ) +
        densityPenalty(
          profile.density,
          representative.density,
        );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestGroupIndex = groupIndex;
      }
    });

    const similarityThreshold = 0.9;

    if (
      bestGroupIndex === -1 ||
      bestDistance > similarityThreshold
    ) {
      const id = String.fromCharCode(
        65 + Math.min(groups.length, 25),
      );

      groups.push({
        id,
        members: [profile],
        centroid: featureVector,
      });

      return {
        start: profile.start,
        end: profile.end,
        groupId: id,
        density: profile.density,
      };
    }

    const selectedGroup = groups[bestGroupIndex];

    selectedGroup.members.push(profile);

    selectedGroup.centroid =
      selectedGroup.centroid.map(
        (_, featureIndex) =>
          average(
            selectedGroup.members.map(
              (member) =>
                toFeatureVector(member)[featureIndex],
            ),
          ),
      );

    return {
      start: profile.start,
      end: profile.end,
      groupId: selectedGroup.id,
      density: profile.density,
    };
  });

  return {
    sequence,
    groups: groups.map((group) => ({
      id: group.id,

      occurrences: group.members.map(
        (member) => ({
          start: member.start,
          end: member.end,
          density: member.density,
        }),
      ),

      occurrenceCount: group.members.length,

      averageRms:
        Math.round(
          average(
            group.members.map(
              (member) => member.averageRms,
            ),
          ) * 1000,
        ) / 1000,

      averageBassEnergy: roundToOneDecimal(
        average(
          group.members.map(
            (member) =>
              member.averageBassEnergy,
          ),
        ),
      ),

      averageMidEnergy: roundToOneDecimal(
        average(
          group.members.map(
            (member) =>
              member.averageMidEnergy,
          ),
        ),
      ),

      averageTrebleEnergy: roundToOneDecimal(
        average(
          group.members.map(
            (member) =>
              member.averageTrebleEnergy,
          ),
        ),
      ),
    })),
  };
};

const buildProtectedSectionRanges = (
  profiles: SectionProfile[],
  summary: ReturnType<typeof summarizeSections>,
): ProtectedSectionRange[] => {
  if (profiles.length === 0) {
    return [];
  }

  const songStart = profiles[0].start;
  const songEnd =
    profiles[profiles.length - 1].end;

  const songDuration = Math.max(
    songEnd - songStart,
    0.1,
  );

  const outroWindowStart =
    songStart + songDuration * 0.78;

  const finalProfile =
    profiles[profiles.length - 1];

  return profiles.flatMap<ProtectedSectionRange>(
    (profile, index) => {
      const rmsStandardDeviation = Math.max(
        summary.rms.standardDeviation,
        0.01,
      );

      const rmsDeviation =
        (profile.averageRms -
          summary.rms.median) /
        rmsStandardDeviation;

      const isExtremeLowDensity =
        profile.density === "low" &&
        rmsDeviation <= -1;

      const isInsideOutroWindow =
        profile.start >= outroWindowStart;

      const remainingProfiles =
        profiles.slice(index);

      const hasGenerallyFallingRms =
        remainingProfiles.length >= 2 &&
        remainingProfiles.every(
          (current, remainingIndex) => {
            if (remainingIndex === 0) {
              return true;
            }

            const previous =
              remainingProfiles[
                remainingIndex - 1
              ];

            return (
              current.averageRms <=
              previous.averageRms * 1.15
            );
          },
        );

      const endsVeryQuietly =
        finalProfile.averageRms <=
        summary.rms.median * 0.35;

      const densityDoesNotIncreaseTowardEnd =
        remainingProfiles.every(
          (remainingProfile) =>
            remainingProfile.density !==
              "high" ||
            profile.density === "high",
        );

      const isLikelyOutroFade =
        isInsideOutroWindow &&
        endsVeryQuietly &&
        hasGenerallyFallingRms &&
        densityDoesNotIncreaseTowardEnd;

      if (isExtremeLowDensity) {
        return [
          {
            start: profile.start,
            end: profile.end,
            reason:
              "extreme-low-density",
          },
        ];
      }

      if (isLikelyOutroFade) {
        return [
          {
            start: profile.start,
            end: profile.end,
            reason:
              "likely-outro-fade",
          },
        ];
      }

      return [];
    },
  );
};

const protectSectionAdjustments = (
  adjustments: SectionMasteringAdjustment[],
  protectedRanges: ProtectedSectionRange[],
): SectionMasteringAdjustment[] =>
  adjustments
    .map((adjustment) => {
      const protectedRange =
        protectedRanges.find(
          (range) =>
            Math.abs(
              range.start -
                adjustment.start,
            ) <= 0.05 &&
            Math.abs(
              range.end -
                adjustment.end,
            ) <= 0.05,
        );

      if (!protectedRange) {
        return adjustment;
      }

      return {
        ...adjustment,

        bassGain: Math.min(
          adjustment.bassGain,
          0,
        ),

        vocalGain: Math.min(
          adjustment.vocalGain,
          0,
        ),

        trebleGain: Math.min(
          adjustment.trebleGain,
          0,
        ),
      };
    })
    .filter(
      (adjustment) =>
        Math.abs(
          adjustment.bassGain,
        ) >= 0.1 ||
        Math.abs(
          adjustment.vocalGain,
        ) >= 0.1 ||
        Math.abs(
          adjustment.trebleGain,
        ) >= 0.1,
    );
const stabilizeMasteringSettings = (
  settings: MasteringSettings,
): MasteringSettings => {
  const MAXIMUM_GLOBAL_EQ_DB = 1.2;

  const stabilizeGain = (value: number) =>
    roundToOneDecimal(
      clamp(
        value,
        -MAXIMUM_GLOBAL_EQ_DB,
        MAXIMUM_GLOBAL_EQ_DB,
      ),
    );

  const stabilizedSettings: MasteringSettings = {
    ...settings,

    bassGain: stabilizeGain(
      settings.bassGain,
    ),

    vocalGain: stabilizeGain(
      settings.vocalGain,
    ),

    trebleGain: stabilizeGain(
      settings.trebleGain,
    ),
  };

  console.log(
    "AI設定安定化チェック",
    {
      maximumGlobalEqDb:
        MAXIMUM_GLOBAL_EQ_DB,

      before: {
        bassGain: settings.bassGain,
        vocalGain: settings.vocalGain,
        trebleGain: settings.trebleGain,
      },

      after: {
        bassGain:
          stabilizedSettings.bassGain,
        vocalGain:
          stabilizedSettings.vocalGain,
        trebleGain:
          stabilizedSettings.trebleGain,
      },
    },
  );

  return stabilizedSettings;
};

const weightMasteringSettingsByAnalysisConfidence = (
  settings: MasteringSettings,
  summary: ReturnType<typeof summarizeSections>,
): MasteringSettings => {
  const calculateBandConfidence = (
    medianValue: number,
    standardDeviationValue: number,
  ) => {
    const relativeVariation =
      standardDeviationValue /
      Math.max(Math.abs(medianValue), 0.1);

    return clamp(
      1 - relativeVariation * 0.45,
      0.55,
      1,
    );
  };

  const sectionCoverageConfidence = clamp(
    summary.usableSectionCount / 30,
    0.65,
    1,
  );

  const bassConfidence =
    calculateBandConfidence(
      summary.bass.median,
      summary.bass.standardDeviation,
    ) * sectionCoverageConfidence;

  const vocalConfidence =
    calculateBandConfidence(
      summary.mid.median,
      summary.mid.standardDeviation,
    ) * sectionCoverageConfidence;

  const trebleConfidence =
    calculateBandConfidence(
      summary.treble.median,
      summary.treble.standardDeviation,
    ) * sectionCoverageConfidence;

  const weightedSettings: MasteringSettings = {
    ...settings,

    bassGain: roundToOneDecimal(
      settings.bassGain * bassConfidence,
    ),

    vocalGain: roundToOneDecimal(
      settings.vocalGain * vocalConfidence,
    ),

    trebleGain: roundToOneDecimal(
      settings.trebleGain * trebleConfidence,
    ),
  };

  console.log(
    "解析信頼度による固定EQ調整",
    {
      usableSectionCount:
        summary.usableSectionCount,

      confidence: {
        bass: roundToOneDecimal(
          bassConfidence,
        ),
        vocal: roundToOneDecimal(
          vocalConfidence,
        ),
        treble: roundToOneDecimal(
          trebleConfidence,
        ),
      },

      before: {
        bassGain: settings.bassGain,
        vocalGain: settings.vocalGain,
        trebleGain: settings.trebleGain,
      },

      after: {
        bassGain: weightedSettings.bassGain,
        vocalGain: weightedSettings.vocalGain,
        trebleGain: weightedSettings.trebleGain,
      },
    },
  );

  return weightedSettings;
};
const validateMasteringSettings = (
  settings: MasteringSettings,
  pythonAnalysis: Record<string, unknown>,
): MasteringSettings => {
  const corrections: string[] = [];

  let bassGain = settings.bassGain;
  let trebleGain = settings.trebleGain;
  let dynamicEqRange = settings.dynamicEq.range;
  let compressorRatio = settings.compressor.ratio;
  let compressorMix = settings.compressor.mix;

  if (bassGain <= -1.2 && dynamicEqRange >= 5) {
   dynamicEqRange = 4;

   corrections.push(
    "低域固定EQとDynamic EQの二重カットを抑制",
   );
  }

  if (bassGain >= 1.2 && dynamicEqRange >= 6) {
   dynamicEqRange = 4.5;

   corrections.push(
    "低域ブースト時のDynamic EQ過補正を抑制",
   );
  }

  const zeroCrossingRate = Number(
    pythonAnalysis.zero_crossing_rate ?? 0,
  );

  const spectralCentroid = Number(
    pythonAnalysis.spectral_centroid ?? 0,
  );

  const spectralRolloff = Number(
    pythonAnalysis.spectral_rolloff ?? 0,
  );

  const hasStrongHighFrequencyContent =
    zeroCrossingRate >= 0.18 ||
    spectralCentroid >= 5500 ||
    spectralRolloff >= 15000;

  if (
    trebleGain <= -2 &&
    hasStrongHighFrequencyContent
  ) {
    trebleGain = -1.5;

    corrections.push(
      "高域成分が多い曲での過度な高域カットを抑制",
    );
  }

  const crestFactor = Number(
    pythonAnalysis.crest_factor ?? 6,
  );

  const dynamicRangeDb = Number(
    pythonAnalysis.dynamic_range_db ?? 10,
  );

  const isAlreadyCompressed =
    crestFactor < 4.5 ||
    dynamicRangeDb < 7;

  if (
    isAlreadyCompressed &&
    compressorRatio > 1.3
  ) {
    compressorRatio = 1.3;

    corrections.push(
      "圧縮済み音源のコンプレッサ比率を抑制",
    );
  }

  if (
    isAlreadyCompressed &&
    compressorMix > 0.3
  ) {
    compressorMix = 0.3;

    corrections.push(
      "圧縮済み音源のコンプレッサMixを抑制",
    );
  }

  const validatedSettings: MasteringSettings = {
    ...settings,

    bassGain: roundToOneDecimal(
      clamp(bassGain, -4, 4),
    ),

    trebleGain: roundToOneDecimal(
      clamp(trebleGain, -4, 4),
    ),

    dynamicEq: {
      ...settings.dynamicEq,

      range: roundToOneDecimal(
        clamp(dynamicEqRange, 2, 8),
      ),
    },

    compressor: {
      ...settings.compressor,

      ratio: roundToOneDecimal(
        clamp(compressorRatio, 1.1, 2),
      ),

      mix: roundToOneDecimal(
        clamp(compressorMix, 0.25, 0.5),
      ),
    },
  };

  console.log(
    "マスタリング設定整合性チェック",
    {
      corrections,

      before: {
        bassGain: settings.bassGain,
        trebleGain: settings.trebleGain,
        dynamicEqRange: settings.dynamicEq.range,
        compressorRatio: settings.compressor.ratio,
        compressorMix: settings.compressor.mix,
      },

      after: {
        bassGain: validatedSettings.bassGain,
        trebleGain: validatedSettings.trebleGain,
        dynamicEqRange:
          validatedSettings.dynamicEq.range,
        compressorRatio:
          validatedSettings.compressor.ratio,
        compressorMix:
          validatedSettings.compressor.mix,
      },
    },
  );

  return validatedSettings;
};
async function measureLoudness(
  filePath: string,
  targetLufs = -12,
) {
  const { stderr } = await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-i",
    filePath,
    "-af",
    `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11:print_format=json`,
    "-f",
    "null",
    "-",
  ]);

  const jsonBlocks = stderr.match(/\{[\s\S]*?\}/g);
  const lastJsonBlock = jsonBlocks?.at(-1);

  if (!lastJsonBlock) {
    return null;
  }

  const measured = JSON.parse(lastJsonBlock) as {
    input_i?: string;
    input_tp?: string;
    input_lra?: string;
    input_thresh?: string;
    target_offset?: string;
  };

  return {
    integratedLufs: Number(measured.input_i),
    truePeakDbfs: Number(measured.input_tp),
    loudnessRange: Number(measured.input_lra),
    threshold: Number(measured.input_thresh),
    targetOffset: Number(measured.target_offset),
  };
}
async function evaluateGroundTruth(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  targetLufs: number,
): Promise<GroundTruthScore> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      overall: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      loudness: 0,
      dynamics: 0,
      goodPoints: [],
      improvements: [],
      summary: "",
    };
  }

  const afterLoudness = Number(after.loudness);

  const loudnessDifference = Number.isFinite(afterLoudness)
    ? Math.abs(afterLoudness - targetLufs)
    : Number.POSITIVE_INFINITY;

  const loudnessScore =
    loudnessDifference <= 0.3
      ? 100
      : loudnessDifference <= 0.7
        ? 90
        : loudnessDifference <= 1.5
          ? 75
          : loudnessDifference <= 3
            ? 50
            : 20;

  try {
    const response = await openai.responses.create({
      model:
        process.env.OPENAI_MODEL || "gpt-4.1-mini",

      input: [
        {
          role: "system",
          content: `
あなたはプロのマスタリングエンジニアです。

マスタリング前後の解析結果だけを見て評価してください。
100点満点で採点してください。

ラウドネスは、マスタリング前後の大小ではなく、
マスタリング後の integrated LUFS が targetLufs に
どれだけ近いかで評価してください。

ラウドネス採点基準：

差が0.3 LU以内は100点
差が0.7 LU以内は90点
差が1.5 LU以内は75点
差が3.0 LU以内は50点
差が3.0 LUを超える場合は20点

マスタリング後が目標値に近い場合、
「ラウドネスが下がった」
「全体の存在感が弱くなった」
などとは評価しないでください。

以下のJSON形式だけを返してください。

{
  "overall": number,
  "bass": number,
  "mid": number,
  "treble": number,
  "loudness": number,
  "dynamics": number,
  "goodPoints": [
    "..."
  ],
  "improvements": [
    "..."
  ],
  "summary": "50文字以内"
}
          `,
        },
        {
          role: "user",
          content: JSON.stringify({
            targetLufs,
            loudnessDifference,
            before,
            after,
          }),
        },
      ],
    });

    const cleanedOutput = response.output_text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "");

    const parsed = JSON.parse(
      cleanedOutput,
    ) as GroundTruthScore;

    const improvements = Array.isArray(
      parsed.improvements,
    )
      ? parsed.improvements.filter(
          (item) =>
            !(
              loudnessScore >= 90 &&
              item.includes("ラウドネス")
            ),
        )
      : [];

    const goodPoints = Array.isArray(
      parsed.goodPoints,
    )
      ? [...parsed.goodPoints]
      : [];

    if (
      loudnessScore >= 90 &&
      !goodPoints.some((item) =>
        item.includes("ラウドネス"),
      )
    ) {
      goodPoints.push(
        `目標ラウドネス${targetLufs} LUFSに近い値へ調整`,
      );
    }

    const bass = clamp(
      Number(parsed.bass) || 0,
      0,
      100,
    );

    const mid = clamp(
      Number(parsed.mid) || 0,
      0,
      100,
    );

    const treble = clamp(
      Number(parsed.treble) || 0,
      0,
      100,
    );

    const dynamics = clamp(
      Number(parsed.dynamics) || 0,
      0,
      100,
    );

    const overall = Math.round(
      (
        bass +
        mid +
        treble +
        loudnessScore +
        dynamics
      ) / 5,
    );

    return {
      overall,
      bass: Math.round(bass),
      mid: Math.round(mid),
      treble: Math.round(treble),
      loudness: loudnessScore,
      dynamics: Math.round(dynamics),
      goodPoints,
      improvements,

      summary:
        typeof parsed.summary === "string"
          ? parsed.summary.slice(0, 50)
          : "",
    };
  } catch (error) {
    console.error(
      "Ground Truth評価エラー",
      error,
    );

    return {
      overall: 0,
      bass: 0,
      mid: 0,
      treble: 0,
      loudness: 0,
      dynamics: 0,
      goodPoints: [],
      improvements: [],
      summary: "",
    };
  }
}
export async function POST(request: Request) {
 const formData = await request.formData();
const audioFile = formData.get("audio");

const userRequestText = Array.from(formData.values())
  .filter((value): value is string => typeof value === "string")
  .join(" ");

const backingVocalRequested =
  userRequestText.includes("かぶせ・ダブを前に出したい") ||
  userRequestText.includes("かぶせを前に出したい") ||
  userRequestText.includes("ダブを前に出したい");

if (!(audioFile instanceof File)) {
    return Response.json(
      {
        success: false,
        message: "音源ファイルが見つかりませんでした。",
      },
      { status: 400 },
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
  const safeBaseName = audioFile.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠_-]/g, "_");
  const uniqueId = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
const inputPath = join("/tmp", `${uniqueId}-${audioFile.name}`);
const analysisInputPath = join(
  "/tmp",
  `${uniqueId}-analysis-input.wav`,
);
const outputDirectory = join(process.cwd(), "public", "generated");
  const masteredFileName = `${safeBaseName}_mastered.wav`;
  const outputPath = join(
    outputDirectory,
    `${uniqueId}-${masteredFileName}`,
  );
  const firstPassOutputPath = join(
  "/tmp",
  `${uniqueId}-first-pass-mastered.wav`,
);
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(inputPath, buffer);
  try {
  await execFileAsync("ffmpeg", [
  "-y",
  "-i",
  inputPath,
  "-vn",
  "-ar",
  "44100",
  "-ac",
  "2",
  "-c:a",
  "pcm_s16le",
  analysisInputPath,
]);
const scriptPath = join(
  process.cwd(),
  "app",
  "api",
  "mastering",
  "analyze_audio.py",
);
const { stdout } = await execFileAsync("python3", [
  scriptPath,
  analysisInputPath,
]);
 const pythonAnalysis = JSON.parse(stdout);

const sections = Array.isArray(pythonAnalysis.sections)
  ? (pythonAnalysis.sections as SectionAnalysis[])
  : [];

const sectionSummary = summarizeSections(sections);
const rawSectionProfiles =
  buildSectionProfiles(sections);

const sectionProfiles =
  smoothSectionProfiles(
    rawSectionProfiles,
    3,
  );

  const sectionCorrectionCandidates =
  buildSectionCorrectionCandidates(
    sectionProfiles,
    sectionSummary,
  );
  const sectionStructureProfile =
  buildSectionStructureProfile(
    sectionProfiles,
    sectionSummary,
  );
  const protectedSectionRanges =
    buildProtectedSectionRanges(
    sectionProfiles,
    sectionSummary,
  );

console.log("AIに渡す音源情報", {
  fileName: audioFile.name,
  fileSizeBytes: audioFile.size,
  fileSizeMB,
  fileType: audioFile.type,
  estimatedQuality:
    fileSizeMB > 10 ? "高音質の可能性が高い" : "軽量ファイル",
  pythonAnalysis: {
  ...pythonAnalysis,
  sections: undefined,
  sectionSummary,
},
});

console.log(
  "5秒ごとのセクション分析",
  JSON.stringify(sections, null, 2),
);

console.log(
  "曲内相対分析サマリー",
  JSON.stringify(sectionSummary, null, 2),
);
console.log(
  "平滑化前の曲展開プロファイル",
  JSON.stringify(rawSectionProfiles, null, 2),
);

console.log(
  "平滑化後の曲展開プロファイル",
  JSON.stringify(sectionProfiles, null, 2),
);

console.log(
  "区間補正候補",
  JSON.stringify(
    sectionCorrectionCandidates,
    null,
    2,
  ),
);

console.log(
  "曲構成類似グループ",
  JSON.stringify(
    sectionStructureProfile,
    null,
    2,
  ),
);
console.log(
  "構成保護対象区間",
  JSON.stringify(
    protectedSectionRanges,
    null,
    2,
  ),
);

const bassScore = Number(pythonAnalysis.bass_energy ?? 50);
const midScore = Number(pythonAnalysis.mid_energy ?? 50);
const trebleScore = Number(pythonAnalysis.treble_energy ?? 50);
const rms = Number(pythonAnalysis.rms ?? 0.05);
const bassGain = roundToOneDecimal(
  clamp((50 - bassScore) / 12.5, -4, 4),
);
const vocalGain = roundToOneDecimal(
  clamp((55 - midScore) / 12.5, -4, 4),
);
const trebleGain = roundToOneDecimal(
  clamp((50 - trebleScore) / 12.5, -4, 4),
);
const estimatedDbfs = roundToOneDecimal(
  20 * Math.log10(Math.max(rms, 0.000001)),
);
const fallbackSettings: MasteringSettings = {
  bassGain,
  vocalGain,
  trebleGain,

  dynamicEq: {
    threshold: 35,
    range: 5,
    attack: 25,
    release: 220,
    frequency: 90,
  },

  compressor: {
    threshold: -18,
    ratio: 1.3,
    attack: 32,
    release: 260,
    makeup: 1,
    mix: 0.35,
  },

  limiter: true,
  targetLufs: -12,
  recommendation:
    "Python解析結果から、曲ごとのマスタリング設定を生成しました。",
    sectionAdjustments: [],
};

let masteringSettings = fallbackSettings;
if (process.env.OPENAI_API_KEY) {
  try {
    const aiResponse = await openai.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "system",

content: `
あなたはプロのマスタリングエンジニアです。

## 目的
自然で高品質なマスタリング設定を作成してください。
音圧よりも音質を優先してください。
過度な補正は禁止です。

## EQ
bassGain
vocalGain
trebleGain
は -4〜+4 dB の範囲で設定してください。

固定EQは曲全体の音色を整える目的で使用してください。

## Dynamic EQ
Dynamic EQ は瞬間的に出過ぎる帯域だけを制御します。

必ず曲ごとに最適化してください。
固定しきい値だけで判断せず、sectionSummary の平均・中央値・標準偏差・帯域比率を使って相対評価してください。

bass.standardDeviation が大きい場合は、曲中の低域変動が大きいと判断し、固定EQよりDynamic EQを優先してください。

bass.standardDeviation が小さく、bass.median が mid.median や treble.median に対して継続的に高い場合は、Dynamic EQを強くしすぎず、固定EQで穏やかに整えてください。

bassToMidMedianRatio と bassToTrebleMedianRatio が高い場合は、低域ブーストを慎重にしてください。
ただし、ジャンルに必要な低域まで一律に削らないでください。

threshold は 20〜45、range は 2〜8 の範囲で設定してください。
frequency は 60〜250Hz の範囲で設定してください。
FFTの sub_bass と bass を参照し、最も制御すべき帯域を選択してください。
一律に90Hzを返さず、曲ごとに最適な周波数を提案してください。

attack

・標準偏差が大きく変化の激しい曲
10〜20ms

・標準偏差が小さく安定した曲
20〜40ms

release

120〜300ms

EQとDynamic EQは役割が重複しないようにしてください。

固定EQで大きく補正する場合はDynamic EQは弱め、
Dynamic EQを強く使う場合は固定EQは控えめにしてください。

## 曲内相対分析
sectionSummary は5秒ごとの解析結果から計算した、その曲固有の統計です。
必ず以下を参照してください。

rms.mean
rms.median
rms.standardDeviation

bass.mean
bass.median
bass.standardDeviation

mid.mean
mid.median
mid.standardDeviation

treble.mean
treble.median
treble.standardDeviation

balance.bassToMidMedianRatio
balance.bassToTrebleMedianRatio

平均だけで判断せず、中央値で曲の通常状態を確認し、標準偏差で曲中の変化量を判断してください。
絶対値だけで補正量を決めず、その曲の中での相対的な偏りを優先してください。

## FFT解析
必ずFFTも参照してください。

sub_bass
20〜60Hz

bass
60〜250Hz

mid
250Hz〜2kHz

presence
2〜6kHz

air
10kHz以上

各帯域を見て判断してください。

## 追加解析
必ず以下も参照してください。

peak_dbfs
0dBFSに近いほどピーク余裕が少ないため、過度な増幅を避けてください。

crest_factor
小さいほど圧縮済みの可能性が高いため、追加コンプレッションは弱めにしてください。
大きいほどピーク差が大きいため、アタックを潰さない設定にしてください。

dynamic_range_db
小さいほどダイナミクスが少ないため、強い圧縮を避けてください。
大きいほど音量差があるため、必要な場合のみ穏やかに整えてください。

zero_crossing_rate
高いほど高域成分やノイズ成分が多い可能性があります。
trebleGainを過度に上げないでください。

spectral_centroid
高いほど明るい音色です。
高い場合はtrebleGainを控えめにしてください。

spectral_rolloff
高いほど高域まで成分が伸びています。
高い場合は高域ブーストを避けてください。

## Compressor
コンプレッサーは音量差を自然に整える目的で使用してください。
音を潰すような強い設定は禁止です。

threshold は -24〜-10 dB
ratio は 1.1〜2.0
attack は 20〜50ms
release は 150〜400ms
makeup は 1.0〜1.2
mix は 0.25〜0.5

crest_factor と dynamic_range_db が小さい場合は、ratio と mix を弱めてください。
peak_dbfs が 0dBFS に近い場合は makeup を 1.0 にしてください。
アタック音を残す場合は attack を長めにしてください。

## Loudness

targetLufs は必ず -12 にしてください。
音圧を上げるために -12 より大きな値を提案してはいけません。

limiter は true / false

## 区間ごとの補正

sectionProfiles、sectionCorrectionCandidates、sectionStructureProfileを参照し、曲全体の固定EQだけでは対応しにくい区間に限ってsectionAdjustmentsを作成してください。

sectionCorrectionCandidatesは曲内中央値・標準偏差との比較から作成した補正候補です。

sectionStructureProfileは、各区間のRMS・低域・中域・高域・密度の類似度から作成した曲構成の推定結果です。

sequenceのgroupIdが同じ区間は、曲中で同じ役割を持つ可能性があります。

最後の区間を自動的にoutro、先頭の区間を自動的にintroと決めつけてはいけません。

同じgroupIdが複数回出現し、終盤にも再登場している場合は、最後のフックや繰り返しセクションの可能性を考慮してください。

低域や高域が弱いという理由だけで、意図的に音数が少ない導入・ブレイク・アウトロを持ち上げないでください。

一方で、同じgroupIdの他の出現区間と比べて特定帯域だけが大きく異なる場合は、局所的な異常として補正を検討してください。

protectedSectionRangesに含まれる区間は、低密度区間または終端に向かうフェードの可能性が高い保護対象です。

protectedSectionRangesに含まれる区間では、bassGain、vocalGain、trebleGainの正方向の補正を提案してはいけません。

severityとreasonsを優先して判断してください。

suggestedBassGain、suggestedVocalGain、suggestedTrebleGainは参考値です。

参考値をそのまま採用する必要はありませんが、候補に存在しない区間を積極的に補正しないでください。

sectionAdjustmentsは必要な区間だけを返してください。

すべての区間を補正対象にしてはいけません。

startとendはsectionProfilesに存在する区間境界をそのまま使用してください。
存在しない時刻を作らないでください。

bassGain、vocalGain、trebleGainは曲全体の設定に追加する差分値です。
各値は -1.5〜+1.5 dB の範囲にしてください。

補正不要な帯域は0にしてください。
1区間で複数帯域を大きく動かさず、必要最小限の補正にしてください。
3秒未満の区間補正は作成しないでください。
sectionAdjustmentsは最大6件までにしてください。

## Recommendation

recommendation は20文字以内の日本語。

## 出力

必ず以下のJSON形式だけを返してください。

{
  "bassGain": number,
  "vocalGain": number,
  "trebleGain": number,

   "dynamicEq": {
    "threshold": number,
    "range": number,
    "attack": number,
    "release": number,
    "frequency": number
  },

  "compressor": {
    "threshold": number,
    "ratio": number,
    "attack": number,
    "release": number,
    "makeup": number,
    "mix": number
  },

  
  "limiter": boolean,
  "targetLufs": number,
  "recommendation": "...",
  "sectionAdjustments": [
    {
      "start": 22,
      "end": 31,
      "bassGain": -0.5,
      "vocalGain": 0,
      "trebleGain": 0
    }
  ]
}

dynamicEq、compressor、sectionAdjustmentsは必須です。
sectionAdjustmentsが不要な場合は空配列を返してください。
省略してはいけません。
`,
                  },
                  {
          role: "user",
         content: JSON.stringify({
         fileName: audioFile.name,

         bassScore,
         midScore,
         trebleScore,

         rms,
         estimatedDbfs,

         peakDbfs: pythonAnalysis.peak_dbfs,
         crestFactor: pythonAnalysis.crest_factor,
         dynamicRangeDb: pythonAnalysis.dynamic_range_db,
         zeroCrossingRate: pythonAnalysis.zero_crossing_rate,
         spectralCentroid: pythonAnalysis.spectral_centroid,
         spectralRolloff: pythonAnalysis.spectral_rolloff,

         fft: pythonAnalysis.fft,

         sectionSummary,
         sectionProfiles,
         sectionCorrectionCandidates,
         sectionStructureProfile,
         protectedSectionRanges,

         pythonAnalysis: {
         ...pythonAnalysis,
         sections: undefined,
         },
         }),
        },
      ],
    });
const cleanedOutput = aiResponse.output_text
  .trim()
  .replace(/^```json\s*/i, "")
  .replace(/^```\s*/i, "")
  .replace(/\s*```$/, "");
const parsed = JSON.parse(
  cleanedOutput,
) as Partial<MasteringSettings>;

console.log("OpenAI Raw JSON", parsed);
    masteringSettings = {
      bassGain: roundToOneDecimal(
        clamp(
          Number(parsed.bassGain ?? fallbackSettings.bassGain),
          -4,
          4,
        ),
      ),
      vocalGain: roundToOneDecimal(
        clamp(
          Number(parsed.vocalGain ?? fallbackSettings.vocalGain),
          -4,
          4,
        ),
      ),
      trebleGain: roundToOneDecimal(
        clamp(
          Number(parsed.trebleGain ?? fallbackSettings.trebleGain),
          -4,
          4,
        ),
      ),

dynamicEq: {
  threshold: Math.round(
    clamp(
      Number(
        parsed.dynamicEq?.threshold ??
          fallbackSettings.dynamicEq.threshold,
      ),
      20,
      45,
    ),
  ),

  range: roundToOneDecimal(
    clamp(
      Number(
        parsed.dynamicEq?.range ??
          fallbackSettings.dynamicEq.range,
      ),
      2,
      8,
    ),
  ),

  attack: Math.round(
    clamp(
      Number(
        parsed.dynamicEq?.attack ??
          fallbackSettings.dynamicEq.attack,
      ),
      10,
      40,
    ),
  ),

  release: Math.round(
    clamp(
      Number(
        parsed.dynamicEq?.release ??
          fallbackSettings.dynamicEq.release,
      ),
      120,
      300,
    ),
  ),

  frequency: Math.round(
    clamp(
      Number(
        parsed.dynamicEq?.frequency ??
          fallbackSettings.dynamicEq.frequency,
      ),
      60,
      250,
    ),
  ),
},
      compressor: {
        threshold: roundToOneDecimal(
          clamp(
            Number(
              parsed.compressor?.threshold ??
                fallbackSettings.compressor.threshold,
            ),
            -24,
            -10,
          ),
        ),
        ratio: roundToOneDecimal(
          clamp(
            Number(
              parsed.compressor?.ratio ??
                fallbackSettings.compressor.ratio,
            ),
            1.1,
            2,
          ),
        ),
        attack: Math.round(
          clamp(
            Number(
              parsed.compressor?.attack ??
                fallbackSettings.compressor.attack,
            ),
            20,
            50,
          ),
        ),
        release: Math.round(
          clamp(
            Number(
              parsed.compressor?.release ??
                fallbackSettings.compressor.release,
            ),
            150,
            400,
          ),
        ),
        makeup: roundToOneDecimal(
          clamp(
            Number(
              parsed.compressor?.makeup ??
                fallbackSettings.compressor.makeup,
            ),
            1,
            1.2,
          ),
        ),
        mix: roundToOneDecimal(
          clamp(
            Number(
              parsed.compressor?.mix ??
                fallbackSettings.compressor.mix,
            ),
            0.25,
            0.5,
          ),
        ),
      },
      limiter:

        typeof parsed.limiter === "boolean"
          ? parsed.limiter
          : fallbackSettings.limiter,
      targetLufs: -12,
      recommendation:
        typeof parsed.recommendation === "string" &&
        parsed.recommendation.trim()
          ? parsed.recommendation.trim()
          : fallbackSettings.recommendation,
          
    sectionAdjustments: protectSectionAdjustments(
  Array.isArray(parsed.sectionAdjustments)
    ? parsed.sectionAdjustments
        .filter(
          (
            adjustment,
          ): adjustment is SectionMasteringAdjustment =>
            Number.isFinite(
              adjustment?.start,
            ) &&
            Number.isFinite(
              adjustment?.end,
            ) &&
            Number.isFinite(
              adjustment?.bassGain,
            ) &&
            Number.isFinite(
              adjustment?.vocalGain,
            ) &&
            Number.isFinite(
              adjustment?.trebleGain,
            ) &&
            adjustment.end >
              adjustment.start &&
            adjustment.end -
              adjustment.start >=
              3,
        )
        .map((adjustment) => ({
          start: roundToOneDecimal(
            adjustment.start,
          ),

          end: roundToOneDecimal(
            adjustment.end,
          ),

          bassGain: roundToOneDecimal(
            clamp(
              adjustment.bassGain,
              -1.5,
              1.5,
            ),
          ),

          vocalGain: roundToOneDecimal(
            clamp(
              adjustment.vocalGain,
              -1.5,
              1.5,
            ),
          ),

          trebleGain: roundToOneDecimal(
            clamp(
              adjustment.trebleGain,
              -1.5,
              1.5,
            ),
          ),
        }))
        .filter((adjustment) =>
          matchesSectionProfileBoundary(
            adjustment,
            sectionProfiles,
          ),
        )
        .slice(0, 6)
    : fallbackSettings.sectionAdjustments,

  protectedSectionRanges,
),
    };
  } catch (openAiError) {
    console.error(
      "OpenAI設定生成エラー。Python計算値を使用します。",
      openAiError,
    );
  }
}
masteringSettings =
  weightMasteringSettingsByAnalysisConfidence(
    masteringSettings,
    sectionSummary,
  );

masteringSettings =
  validateMasteringSettings(
    masteringSettings,
    pythonAnalysis,
  );

masteringSettings =
  stabilizeMasteringSettings(
    masteringSettings,
  );

console.log(
  "構成保護適用後の区間補正",
  masteringSettings.sectionAdjustments,
);

console.log(
  "OpenAIマスタリング設定",
  masteringSettings,
);
const analysis = {
  loudness: estimatedDbfs,
  bass: Math.round(clamp(bassScore, 0, 100)),
  treble: Math.round(clamp(trebleScore, 0, 100)),
  vocal: Math.round(clamp(midScore, 0, 100)),
  mastering: masteringSettings,
  recommendation: masteringSettings.recommendation,
  eqSuggestion: `LOW END ${
    masteringSettings.bassGain >= 0 ? "+" : ""
  }${masteringSettings.bassGain} dB / VOCAL ${
    masteringSettings.vocalGain >= 0 ? "+" : ""
  }${masteringSettings.vocalGain} dB / HIGH END ${
    masteringSettings.trebleGain >= 0 ? "+" : ""
  }${masteringSettings.trebleGain} dB / LIMITER ${
    masteringSettings.limiter ? "ACTIVE" : "BYPASS"
  }`,
  pythonAnalysis,
};
   const sectionAdjustmentFilters =
  analysis.mastering.sectionAdjustments.flatMap(
    (adjustment) => {
      const enableExpression =
        `enable='between(t,${adjustment.start},${adjustment.end})'`;

      const filters: string[] = [];

      if (Math.abs(adjustment.bassGain) >= 0.1) {
        filters.push(
          `equalizer=f=80:t=q:w=1:g=${adjustment.bassGain}:${enableExpression}`,
        );
      }

      if (Math.abs(adjustment.vocalGain) >= 0.1) {
        filters.push(
          `equalizer=f=1200:t=q:w=1:g=${adjustment.vocalGain}:${enableExpression}`,
        );
      }

      if (Math.abs(adjustment.trebleGain) >= 0.1) {
        filters.push(
          `equalizer=f=8000:t=q:w=1:g=${adjustment.trebleGain}:${enableExpression}`,
        );
      }

      return filters;
    },
  );
const dynamicLowEndEq =
  "adynamicequalizer=" +
  [
    `threshold=${analysis.mastering.dynamicEq.threshold}`,
    `dfrequency=${analysis.mastering.dynamicEq.frequency}`,
    "dqfactor=1.2",
    `tfrequency=${analysis.mastering.dynamicEq.frequency}`,
    "tqfactor=1.1",
    `attack=${analysis.mastering.dynamicEq.attack}`,
    `release=${analysis.mastering.dynamicEq.release}`,
    "ratio=2",
    "makeup=0",
    `range=${analysis.mastering.dynamicEq.range}`,
    "mode=cutabove",
    "dftype=bandpass",
    "tftype=bell",
    "precision=double",
  ].join(":");

const crestFactor = Number(
  analysis.pythonAnalysis.crest_factor ?? 6,
);

const dynamicRangeDb = Number(
  analysis.pythonAnalysis.dynamic_range_db ?? 10,
);

const isAlreadyCompressed =
  crestFactor < 4.5 || dynamicRangeDb < 7;

const isHighlyDynamic =
  crestFactor > 8 || dynamicRangeDb > 14;

const compressorThreshold = roundToOneDecimal(
  clamp(
    analysis.mastering.compressor.threshold +
      (isAlreadyCompressed ? 4 : isHighlyDynamic ? -1 : 2),
    -24,
    -10,
  ),
);

const compressorRatio = roundToOneDecimal(
  clamp(
    analysis.mastering.compressor.ratio +
      (isAlreadyCompressed ? -0.2 : isHighlyDynamic ? 0.1 : -0.1),
    1.1,
    1.6,
  ),
);

const compressorAttack = Math.round(
  clamp(
    analysis.mastering.compressor.attack +
      (isAlreadyCompressed ? 8 : isHighlyDynamic ? 5 : 4),
    25,
    55,
  ),
);

const compressorRelease = Math.round(
  clamp(
    analysis.mastering.compressor.release +
      (isAlreadyCompressed ? 70 : isHighlyDynamic ? 20 : 40),
    180,
    420,
  ),
);

const compressorMakeup = roundToOneDecimal(
  isAlreadyCompressed
    ? 1
    : clamp(analysis.mastering.compressor.makeup, 1, 1.1),
);

const compressorMix = roundToOneDecimal(
  clamp(
    analysis.mastering.compressor.mix +
      (isAlreadyCompressed ? -0.15 : isHighlyDynamic ? -0.05 : -0.1) +
      (backingVocalRequested ? -0.05 : 0),
    0.15,
    0.35,
  ),
);

const adaptiveCompressor =
  "acompressor=" +
  [
    `threshold=${compressorThreshold}dB`,
    `ratio=${compressorRatio}`,
    `attack=${compressorAttack}`,
    `release=${compressorRelease}`,
    `makeup=${compressorMakeup}`,
    "knee=8dB",
    "detection=rms",
    "link=average",
    `mix=${compressorMix}`,
  ].join(":");

  const backingVocalFilters = backingVocalRequested
  ? [
      "equalizer=f=3200:t=q:w=1.1:g=1.3",
      "equalizer=f=5200:t=q:w=1.2:g=0.6",
      "extrastereo=m=1.08:c=0",
    ]
  : [];

const sourcePeakDbfs = Number(
  analysis.pythonAnalysis.peak_dbfs ?? 0,
);

const maximumGlobalBoostDb = Math.max(
  0,
  analysis.mastering.bassGain,
  analysis.mastering.vocalGain,
  analysis.mastering.trebleGain,
);

const maximumSectionBoostDb = Math.max(
  0,
  ...analysis.mastering.sectionAdjustments.map(
    (adjustment) =>
      Math.max(
        adjustment.bassGain,
        adjustment.vocalGain,
        adjustment.trebleGain,
      ),
  ),
);

const backingVocalBoostAllowanceDb =
  backingVocalRequested ? 1.5 : 0;

const processingSafetyMarginDb = 6;

const preLoudnormGainDb = roundToOneDecimal(
  clamp(
    -3 -
      sourcePeakDbfs -
      maximumGlobalBoostDb -
      maximumSectionBoostDb -
      backingVocalBoostAllowanceDb -
      processingSafetyMarginDb,
    -12,
    0,
  ),
);

const preLoudnormHeadroomFilter =
  `volume=${preLoudnormGainDb}dB`;

const audioFilters = [
  "highpass=f=25",
  `equalizer=f=80:t=q:w=1:g=${analysis.mastering.bassGain}`,
  `equalizer=f=1200:t=q:w=1:g=${analysis.mastering.vocalGain}`,
  `equalizer=f=8000:t=q:w=1:g=${analysis.mastering.trebleGain}`,
  ...sectionAdjustmentFilters,
  ...backingVocalFilters,
  dynamicLowEndEq,
  adaptiveCompressor,
  preLoudnormHeadroomFilter,
].join(",");
 console.log("ffmpegマスタリング開始", {
  inputPath,
  outputPath,
  backingVocalRequested,
  sectionAdjustments:
    analysis.mastering.sectionAdjustments,
  sectionAdjustmentFilters,
    sourcePeakDbfs,
  maximumGlobalBoostDb,
  maximumSectionBoostDb,
  backingVocalBoostAllowanceDb,
  processingSafetyMarginDb,
  preLoudnormGainDb,
  preLoudnormHeadroomFilter,
  audioFilters,
});
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      inputPath,
      "-vn",
      "-af",
      audioFilters,
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "pcm_f32le",
      firstPassOutputPath,
    ]);
 console.log("ffmpeg一次マスタリング完了", {
  masteredFileName,
  firstPassOutputPath,
});

const firstPassLoudness = await measureLoudness(
  firstPassOutputPath,
  analysis.mastering.targetLufs,
);

const canRunSecondPass =
  firstPassLoudness !== null &&
  Number.isFinite(firstPassLoudness.integratedLufs) &&
  Number.isFinite(firstPassLoudness.truePeakDbfs) &&
  Number.isFinite(firstPassLoudness.loudnessRange) &&
  Number.isFinite(firstPassLoudness.threshold) &&
  Number.isFinite(firstPassLoudness.targetOffset);

if (canRunSecondPass && firstPassLoudness) {
  const secondPassLoudnorm =
    "loudnorm=" +
    [
      `I=${analysis.mastering.targetLufs}`,
      "TP=-1.5",
      "LRA=11",
      `measured_I=${firstPassLoudness.integratedLufs}`,
      `measured_TP=${firstPassLoudness.truePeakDbfs}`,
      `measured_LRA=${firstPassLoudness.loudnessRange}`,
      `measured_thresh=${firstPassLoudness.threshold}`,
      `offset=${firstPassLoudness.targetOffset}`,
      "linear=true",
      "print_format=summary",
    ].join(":");

  const secondPassFilters = [
    secondPassLoudnorm,
    ...(analysis.mastering.limiter
     ? ["alimiter=limit=0.891251:level=false"]
      : []),
  ].join(",");

  await execFileAsync("ffmpeg", [
    "-y",
    "-i",
    firstPassOutputPath,
    "-vn",
    "-af",
    secondPassFilters,
    "-ar",
    "44100",
    "-ac",
    "2",
    "-c:a",
    "pcm_s24le",
    outputPath,
  ]);

  console.log("ラウドネス二次補正完了", {
    targetLufs: analysis.mastering.targetLufs,
    firstPassLoudness,
  });
} else {
  await rename(firstPassOutputPath, outputPath);

  console.warn(
    "二次補正用の測定値を取得できなかったため、一次出力を採用しました。",
  );
}

const measuredLoudness = await measureLoudness(
  outputPath,
  analysis.mastering.targetLufs,
);

console.log(
  "最終マスタリング後の音源ラウドネス測定結果",
  measuredLoudness,
);

const inputMeasuredLoudness = await measureLoudness(
  analysisInputPath,
  analysis.mastering.targetLufs,
);

const { stdout: masteredAnalysisStdout } =
  await execFileAsync("python3", [
    scriptPath,
    outputPath,
  ]);

const masteredPythonAnalysis = JSON.parse(
  masteredAnalysisStdout,
) as Record<string, unknown>;

console.log(
  "マスタリング後Python解析",
  masteredPythonAnalysis,
);

const groundTruth = await evaluateGroundTruth(
  {
    bass: Number(
      analysis.pythonAnalysis.bass_energy ?? 0,
    ),

    mid: Number(
      analysis.pythonAnalysis.mid_energy ?? 0,
    ),

    treble: Number(
      analysis.pythonAnalysis.treble_energy ?? 0,
    ),

    loudness:
      inputMeasuredLoudness?.integratedLufs ?? null,

    truePeak:
      inputMeasuredLoudness?.truePeakDbfs ?? null,

    loudnessRange:
      inputMeasuredLoudness?.loudnessRange ?? null,

    crestFactor: Number(
      analysis.pythonAnalysis.crest_factor ?? 0,
    ),

    dynamicRange: Number(
      analysis.pythonAnalysis.dynamic_range_db ?? 0,
    ),
  },
  {
    bass: Number(
      masteredPythonAnalysis.bass_energy ?? 0,
    ),

    mid: Number(
      masteredPythonAnalysis.mid_energy ?? 0,
    ),

    treble: Number(
      masteredPythonAnalysis.treble_energy ?? 0,
    ),

    loudness:
      measuredLoudness?.integratedLufs ?? null,

    truePeak:
      measuredLoudness?.truePeakDbfs ?? null,

    loudnessRange:
      measuredLoudness?.loudnessRange ?? null,

    crestFactor: Number(
      masteredPythonAnalysis.crest_factor ?? 0,
    ),

    dynamicRange: Number(
      masteredPythonAnalysis.dynamic_range_db ?? 0,
    ),
  },
  analysis.mastering.targetLufs,
);

console.log(
  "Ground Truth評価",
  groundTruth,
);
return Response.json({
  success: true,
  message: "解析とマスタリングが完了しました。",
  fileName: audioFile.name,
  fileSizeMB,
  masteredFileName,
  masteredFileUrl: `/generated/${uniqueId}-${masteredFileName}`,
  analysis: {
    ...analysis,
    measuredLoudness,
    inputMeasuredLoudness,
    masteredPythonAnalysis,
    groundTruth,
  },
});
  } catch (error) {
    console.error("音源解析・マスタリングエラー", error);
    return Response.json(
      {
        success: false,
        message:
          "音源の解析またはマスタリング中にエラーが発生しました。",
      },
      { status: 500 },
    );
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(analysisInputPath).catch(() => {});
    await unlink(firstPassOutputPath).catch(() => {});
  }
}