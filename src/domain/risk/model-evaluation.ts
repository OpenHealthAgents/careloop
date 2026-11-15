import { RiskLevel } from "@prisma/client";
import type { RiskScoringEngine, RiskScoringInput } from "./risk-engine";
import { stripSensitiveAttributesForRiskScoring } from "./prioritization";

export interface RiskEvaluationSample {
  id: string;
  input: RiskScoringInput & {
    raceEthnicity?: string;
    gender?: string;
  };
  /** Ground truth: true if the referral experienced non-completion / drop-off */
  actualDroppedOff: boolean;
}

export interface RiskBandCalibration {
  band: RiskLevel;
  count: number;
  observedDropOffRate: number;
  meanPredictedScore: number;
}

export interface RiskModelEvaluationReport {
  modelVersion: string;
  sampleCount: number;
  aucRoc: number;
  brierScore: number;
  precisionAtTopK: number;
  recallAtTopK: number;
  topK: number;
  calibrationByBand: RiskBandCalibration[];
  counterfactualFairnessMaxDelta: number;
}

export async function evaluateRiskPrioritizationModel(
  engine: RiskScoringEngine,
  samples: RiskEvaluationSample[],
  topK = 3
): Promise<RiskModelEvaluationReport> {
  const scored = await Promise.all(
    samples.map(async (sample) => {
      const sanitizedInput = stripSensitiveAttributesForRiskScoring(
        sample.input as unknown as Record<string, unknown>
      );
      const output = await engine.scoreReferral(sanitizedInput);

      // Counterfactual fairness check: perturbing sensitive attribute must not alter score
      const perturbedInput = stripSensitiveAttributesForRiskScoring({
        ...(sample.input as unknown as Record<string, unknown>),
        raceEthnicity: "PERTURBED_GROUP",
        gender: "PERTURBED_GENDER",
      });
      const perturbedOutput = await engine.scoreReferral(perturbedInput);
      const counterfactualDelta = Math.abs(output.riskScore - perturbedOutput.riskScore);

      return {
        sample,
        output,
        prob: output.riskScore / 100,
        counterfactualDelta,
      };
    })
  );

  // Exact pairwise AUC-ROC
  const positives = scored.filter((s) => s.sample.actualDroppedOff);
  const negatives = scored.filter((s) => !s.sample.actualDroppedOff);
  let concordant = 0;
  let ties = 0;
  const totalPairs = positives.length * negatives.length;

  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.output.riskScore > neg.output.riskScore) concordant += 1;
      else if (pos.output.riskScore === neg.output.riskScore) ties += 1;
    }
  }
  const aucRoc =
    totalPairs > 0 ? Number(((concordant + 0.5 * ties) / totalPairs).toFixed(4)) : 1;

  // Brier score
  const brierScore =
    scored.length > 0
      ? Number(
          (
            scored.reduce((sum, s) => {
              const y = s.sample.actualDroppedOff ? 1 : 0;
              return sum + (s.prob - y) ** 2;
            }, 0) / scored.length
          ).toFixed(4)
        )
      : 0;

  // Precision@K and Recall@K
  const k = Math.min(topK, scored.length);
  const byScoreDesc = [...scored].sort((a, b) => b.output.riskScore - a.output.riskScore);
  const topKSlices = byScoreDesc.slice(0, k);
  const tpAtK = topKSlices.filter((s) => s.sample.actualDroppedOff).length;
  const precisionAtTopK = k > 0 ? Number((tpAtK / k).toFixed(4)) : 0;
  const recallAtTopK =
    positives.length > 0 ? Number((tpAtK / positives.length).toFixed(4)) : 1;

  // Calibration by risk band
  const bands: RiskLevel[] = ["HIGH", "MEDIUM", "LOW", "UNKNOWN"];
  const calibrationByBand: RiskBandCalibration[] = bands
    .map((band) => {
      const group = scored.filter((s) => s.output.riskLevel === band);
      if (group.length === 0) return null;
      return {
        band,
        count: group.length,
        observedDropOffRate: Number(
          (group.filter((s) => s.sample.actualDroppedOff).length / group.length).toFixed(4)
        ),
        meanPredictedScore: Number(
          (group.reduce((sum, s) => sum + s.output.riskScore, 0) / group.length).toFixed(2)
        ),
      };
    })
    .filter((b): b is RiskBandCalibration => b !== null);

  const counterfactualFairnessMaxDelta = scored.reduce(
    (max, s) => Math.max(max, s.counterfactualDelta),
    0
  );

  return {
    modelVersion: engine.modelVersion,
    sampleCount: scored.length,
    aucRoc,
    brierScore,
    precisionAtTopK,
    recallAtTopK,
    topK: k,
    calibrationByBand,
    counterfactualFairnessMaxDelta,
  };
}
