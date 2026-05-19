import { publicProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { z } from "zod";

export const CreditApplicationSchema = z.object({
  // Step 1 - Personal Info
  fullName: z.string().min(2),
  age: z.number().min(18).max(100),
  employmentStatus: z.enum(["employed", "self_employed", "unemployed", "retired", "student"]),
  // Step 2 - Financial Info
  annualIncome: z.number().min(0),
  monthlyExpenses: z.number().min(0),
  existingDebt: z.number().min(0),
  loanAmount: z.number().min(1000),
  loanPurpose: z.enum(["home", "car", "business", "education", "personal", "medical"]),
  // Step 3 - Credit History
  creditScore: z.number().min(300).max(850),
  missedPayments: z.number().min(0).max(50),
  yearsOfCreditHistory: z.number().min(0).max(50),
  bankruptcies: z.number().min(0).max(5),
});

export type CreditApplication = z.infer<typeof CreditApplicationSchema>;

export type RiskFactor = {
  factor: string;
  value: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
};

export type ScoringResult = {
  score: number;            // 0-100
  riskLevel: "low" | "moderate" | "high" | "very_high";
  recommendation: "approve" | "review" | "decline";
  factors: RiskFactor[];
  aiExplanation: string;
  debtToIncomeRatio: number;
  maxRecommendedLoan: number;
};

function computeRulesScore(data: CreditApplication): {
  score: number;
  factors: RiskFactor[];
  debtToIncomeRatio: number;
  maxRecommendedLoan: number;
} {
  const factors: RiskFactor[] = [];
  let score = 50; // baseline

  // --- Credit Score (weight: 30%) ---
  const csScore = data.creditScore;
  let csPoints = 0;
  let csImpact: RiskFactor["impact"] = "neutral";
  if (csScore >= 750) { csPoints = 30; csImpact = "positive"; }
  else if (csScore >= 700) { csPoints = 22; csImpact = "positive"; }
  else if (csScore >= 650) { csPoints = 14; csImpact = "neutral"; }
  else if (csScore >= 600) { csPoints = 5; csImpact = "negative"; }
  else { csPoints = -10; csImpact = "negative"; }
  score += csPoints - 15; // center around baseline
  factors.push({
    factor: "Credit Score",
    value: csScore.toString(),
    impact: csImpact,
    weight: Math.abs(csPoints),
  });

  // --- Debt-to-Income Ratio (weight: 25%) ---
  const monthlyIncome = data.annualIncome / 12;
  const totalMonthlyDebt = data.existingDebt / 12 + (data.loanAmount / 60); // assume 5yr term
  const dti = monthlyIncome > 0 ? (totalMonthlyDebt / monthlyIncome) * 100 : 100;
  let dtiPoints = 0;
  let dtiImpact: RiskFactor["impact"] = "neutral";
  if (dti < 20) { dtiPoints = 25; dtiImpact = "positive"; }
  else if (dti < 35) { dtiPoints = 15; dtiImpact = "positive"; }
  else if (dti < 43) { dtiPoints = 5; dtiImpact = "neutral"; }
  else if (dti < 50) { dtiPoints = -5; dtiImpact = "negative"; }
  else { dtiPoints = -20; dtiImpact = "negative"; }
  score += dtiPoints - 10;
  factors.push({
    factor: "Debt-to-Income Ratio",
    value: `${dti.toFixed(1)}%`,
    impact: dtiImpact,
    weight: Math.abs(dtiPoints),
  });

  // --- Employment Status (weight: 15%) ---
  let empPoints = 0;
  let empImpact: RiskFactor["impact"] = "neutral";
  switch (data.employmentStatus) {
    case "employed": empPoints = 15; empImpact = "positive"; break;
    case "self_employed": empPoints = 8; empImpact = "neutral"; break;
    case "retired": empPoints = 10; empImpact = "positive"; break;
    case "student": empPoints = -5; empImpact = "negative"; break;
    case "unemployed": empPoints = -15; empImpact = "negative"; break;
  }
  score += empPoints - 5;
  factors.push({
    factor: "Employment Status",
    value: data.employmentStatus.replace("_", " "),
    impact: empImpact,
    weight: Math.abs(empPoints),
  });

  // --- Payment History (weight: 15%) ---
  let payPoints = 0;
  let payImpact: RiskFactor["impact"] = "neutral";
  if (data.missedPayments === 0) { payPoints = 15; payImpact = "positive"; }
  else if (data.missedPayments <= 1) { payPoints = 8; payImpact = "neutral"; }
  else if (data.missedPayments <= 3) { payPoints = -5; payImpact = "negative"; }
  else { payPoints = -15; payImpact = "negative"; }
  score += payPoints - 5;
  factors.push({
    factor: "Missed Payments",
    value: data.missedPayments.toString(),
    impact: payImpact,
    weight: Math.abs(payPoints),
  });

  // --- Credit History Length (weight: 10%) ---
  let histPoints = 0;
  let histImpact: RiskFactor["impact"] = "neutral";
  if (data.yearsOfCreditHistory >= 7) { histPoints = 10; histImpact = "positive"; }
  else if (data.yearsOfCreditHistory >= 3) { histPoints = 5; histImpact = "neutral"; }
  else { histPoints = -5; histImpact = "negative"; }
  score += histPoints - 3;
  factors.push({
    factor: "Credit History Length",
    value: `${data.yearsOfCreditHistory} yrs`,
    impact: histImpact,
    weight: Math.abs(histPoints),
  });

  // --- Bankruptcies (weight: 5%) ---
  if (data.bankruptcies > 0) {
    score -= data.bankruptcies * 10;
    factors.push({
      factor: "Bankruptcies",
      value: data.bankruptcies.toString(),
      impact: "negative",
      weight: data.bankruptcies * 10,
    });
  } else {
    factors.push({
      factor: "Bankruptcies",
      value: "None",
      impact: "positive",
      weight: 5,
    });
  }

  // Clamp to 0–100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Max recommended loan: 3x annual income, reduced by DTI penalty
  const dtiMultiplier = dti < 35 ? 1 : dti < 43 ? 0.7 : 0.4;
  const maxRecommendedLoan = Math.round(data.annualIncome * 3 * dtiMultiplier);

  return { score, factors, debtToIncomeRatio: parseFloat(dti.toFixed(1)), maxRecommendedLoan };
}

function getRiskLevel(score: number): ScoringResult["riskLevel"] {
  if (score >= 70) return "low";
  if (score >= 50) return "moderate";
  if (score >= 30) return "high";
  return "very_high";
}

function getRecommendation(score: number): ScoringResult["recommendation"] {
  if (score >= 65) return "approve";
  if (score >= 40) return "review";
  return "decline";
}

async function getAIExplanation(data: CreditApplication, rulesResult: ReturnType<typeof computeRulesScore>): Promise<string> {
  const { score, factors, debtToIncomeRatio } = rulesResult;
  const riskLevel = getRiskLevel(score);
  const recommendation = getRecommendation(score);

  const prompt = `You are a senior credit risk analyst. Analyze the following loan application and provide a concise, professional explanation of the credit decision in 3–4 short paragraphs. Be specific about the numbers. Avoid generic filler. Write in plain English for a non-expert audience.

APPLICANT: ${data.fullName}, age ${data.age}
EMPLOYMENT: ${data.employmentStatus}
LOAN REQUEST: $${data.loanAmount.toLocaleString()} for ${data.loanPurpose}
ANNUAL INCOME: $${data.annualIncome.toLocaleString()}
EXISTING DEBT: $${data.existingDebt.toLocaleString()}
CREDIT SCORE: ${data.creditScore}
MISSED PAYMENTS: ${data.missedPayments}
CREDIT HISTORY: ${data.yearsOfCreditHistory} years
BANKRUPTCIES: ${data.bankruptcies}
DEBT-TO-INCOME RATIO: ${debtToIncomeRatio}%

RULES-BASED SCORE: ${score}/100
RISK LEVEL: ${riskLevel}
RECOMMENDATION: ${recommendation}

KEY FACTORS:
${factors.map(f => `- ${f.factor}: ${f.value} (${f.impact})`).join("\n")}

Write your analysis now. Start directly with the assessment — no greeting, no "Based on the above", no preamble.`;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 600,
    });
    const content = result.choices[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content.map(c => (c.type === "text" ? c.text : "")).join("");
    }
    return "AI analysis unavailable.";
  } catch {
    return "AI analysis could not be generated at this time. Please review the rules-based score above.";
  }
}

export const creditRouter = router({
  analyze: publicProcedure
    .input(CreditApplicationSchema)
    .mutation(async ({ input }): Promise<ScoringResult> => {
      const rulesResult = computeRulesScore(input);
      const { score, factors, debtToIncomeRatio, maxRecommendedLoan } = rulesResult;

      const [aiExplanation] = await Promise.all([
        getAIExplanation(input, rulesResult),
      ]);

      return {
        score,
        riskLevel: getRiskLevel(score),
        recommendation: getRecommendation(score),
        factors,
        aiExplanation,
        debtToIncomeRatio,
        maxRecommendedLoan,
      };
    }),
});
