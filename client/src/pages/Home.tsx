import { trpc } from "@/lib/trpc";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User, DollarSign, CreditCard, ChevronRight, ChevronLeft,
  CheckCircle2, AlertTriangle, XCircle, Sparkles, RotateCcw,
  TrendingUp, TrendingDown, Minus, Shield, Clock, FileText, Activity
} from "lucide-react";
import type { ScoringResult } from "../../../server/creditRouter";

type FormData = {
  fullName: string; age: string; employmentStatus: string;
  annualIncome: string; monthlyExpenses: string; existingDebt: string;
  loanAmount: string; loanPurpose: string;
  creditScore: string; missedPayments: string; yearsOfCreditHistory: string; bankruptcies: string;
};

const INITIAL: FormData = {
  fullName: "", age: "", employmentStatus: "",
  annualIncome: "", monthlyExpenses: "", existingDebt: "", loanAmount: "", loanPurpose: "",
  creditScore: "", missedPayments: "", yearsOfCreditHistory: "", bankruptcies: "",
};

const STEPS = [
  { id: 0, label: "Personal", icon: User, title: "Personal Information", subtitle: "Tell us a bit about yourself" },
  { id: 1, label: "Financial", icon: DollarSign, title: "Financial Profile", subtitle: "Your income, expenses and loan request" },
  { id: 2, label: "Credit", icon: CreditCard, title: "Credit History", subtitle: "Your past borrowing record" },
];

const fmt = (n: number) => "$" + n.toLocaleString();

const RISK_CONFIG = {
  low: { label: "Low Risk", color: "#22c55e", bg: "rgba(34,197,94,0.1)", icon: CheckCircle2, rec: "Approved" },
  moderate: { label: "Moderate Risk", color: "#f59e0b", bg: "rgba(245,158,11,0.1)", icon: AlertTriangle, rec: "Manual Review" },
  high: { label: "High Risk", color: "#f97316", bg: "rgba(249,115,22,0.1)", icon: AlertTriangle, rec: "Declined" },
  very_high: { label: "Very High Risk", color: "#ef4444", bg: "rgba(239,68,68,0.1)", icon: XCircle, rec: "Declined" },
};

function FieldGroup({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontFamily: "DM Sans, sans-serif", fontWeight: 500, fontSize: 13, color: "#374151" }}>{label}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder, min, max }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; min?: string; max?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} min={min} max={max}
      style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${focused ? "#6366f1" : "#e5e7eb"}`, borderRadius: 10, fontSize: 14, outline: "none", background: focused ? "#fff" : "#fafafa", fontFamily: "DM Sans, sans-serif", color: "#111827", boxSizing: "border-box", transition: "all 0.15s", boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.12)" : "none" }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
  );
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${focused ? "#6366f1" : "#e5e7eb"}`, borderRadius: 10, fontSize: 14, outline: "none", background: "#fafafa", fontFamily: "DM Sans, sans-serif", color: value ? "#111827" : "#9ca3af", cursor: "pointer", boxSizing: "border-box", transition: "all 0.15s", appearance: "none" }}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const r = 73;
  const stroke = 13;
  const half = r * Math.PI;
  const dashoffset = half - (score / 100) * half;
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : score >= 30 ? "#f97316" : "#ef4444";
  return (
    <div style={{ position: "relative", width: 180, height: 100, margin: "0 auto" }}>
      <svg width={180} height={100} overflow="visible">
        <path d="M 13 90 A 73 73 0 0 1 167 90" fill="none" stroke="#f3f4f6" strokeWidth={stroke} strokeLinecap="round" />
        <motion.path d="M 13 90 A 73 73 0 0 1 167 90" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${half} ${half}`}
          initial={{ strokeDashoffset: half }} animate={{ strokeDashoffset: dashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }} />
      </svg>
      <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
          style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 42, color, lineHeight: 1 }}>{score}</motion.div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>/ 100</div>
      </div>
    </div>
  );
}

function FactorRow({ factor, value, impact, weight, delay }: { factor: string; value: string; impact: string; weight: number; delay: number }) {
  const color = impact === "positive" ? "#22c55e" : impact === "negative" ? "#ef4444" : "#6b7280";
  const Icon = impact === "positive" ? TrendingUp : impact === "negative" ? TrendingDown : Minus;
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay }}
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "#f9fafb", border: "1px solid #f3f4f6" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: color + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={14} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 13, color: "#374151" }}>{factor}</div>
        <div style={{ fontSize: 12, color: "#9ca3af" }}>{value}</div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color, background: color + "15", padding: "2px 8px", borderRadius: 6 }}>
        {impact === "positive" ? "+" : impact === "negative" ? "−" : "~"}{weight}pts
      </div>
    </motion.div>
  );
}

export default function Home() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const topRef = useRef<HTMLDivElement>(null);
  const mutation = trpc.credit.analyze.useMutation({ onSuccess: setResult });

  const set = (k: keyof FormData) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: undefined })); };

  const validate = (s: number) => {
    const e: typeof errors = {};
    if (s === 0) {
      if (!form.fullName.trim()) e.fullName = "Required";
      if (!form.age || +form.age < 18 || +form.age > 100) e.age = "Must be 18–100";
      if (!form.employmentStatus) e.employmentStatus = "Required";
    }
    if (s === 1) {
      if (form.annualIncome === "" || +form.annualIncome < 0) e.annualIncome = "Required";
      if (form.monthlyExpenses === "" || +form.monthlyExpenses < 0) e.monthlyExpenses = "Required";
      if (form.existingDebt === "" || +form.existingDebt < 0) e.existingDebt = "Required";
      if (!form.loanAmount || +form.loanAmount < 1000) e.loanAmount = "Minimum $1,000";
      if (!form.loanPurpose) e.loanPurpose = "Required";
    }
    if (s === 2) {
      if (!form.creditScore || +form.creditScore < 300 || +form.creditScore > 850) e.creditScore = "Must be 300–850";
      if (form.missedPayments === "") e.missedPayments = "Required";
      if (!form.yearsOfCreditHistory) e.yearsOfCreditHistory = "Required";
      if (form.bankruptcies === "") e.bankruptcies = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (!validate(step)) return;
    if (step < 2) { setStep(s => s + 1); topRef.current?.scrollIntoView({ behavior: "smooth" }); }
    else mutation.mutate({ fullName: form.fullName, age: +form.age, employmentStatus: form.employmentStatus as any, annualIncome: +form.annualIncome, monthlyExpenses: +form.monthlyExpenses, existingDebt: +form.existingDebt, loanAmount: +form.loanAmount, loanPurpose: form.loanPurpose as any, creditScore: +form.creditScore, missedPayments: +form.missedPayments, yearsOfCreditHistory: +form.yearsOfCreditHistory, bankruptcies: +form.bankruptcies });
  };

  const reset = () => { setStep(0); setForm(INITIAL); setResult(null); setErrors({}); mutation.reset(); };
  const e = (k: keyof FormData) => errors[k] ? <span style={{ fontSize: 11, color: "#ef4444" }}>{errors[k]}</span> : null;
  const riskCfg = result ? RISK_CONFIG[result.riskLevel] : null;

  // inject fonts
  if (typeof document !== "undefined" && !document.getElementById("cr-fonts")) {
    const l = document.createElement("link"); l.id = "cr-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }

  return (
    <div ref={topRef} style={{ minHeight: "100vh", background: "linear-gradient(135deg,#f8f9ff,#f0f4ff 50%,#faf5ff)", fontFamily: "DM Sans, sans-serif", padding: "32px 16px 72px" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 100, padding: "6px 16px", marginBottom: 16 }}>
          <Shield size={14} color="#6366f1" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", letterSpacing: "0.04em" }}>CREDIT RISK ENGINE</span>
        </div>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: "clamp(28px,5vw,46px)", color: "#111827", margin: 0, lineHeight: 1.1 }}>Credit Risk Scorer</h1>
        <p style={{ color: "#6b7280", marginTop: 10, fontSize: 15 }}>Rules-based scoring + AI-powered analysis</p>
      </motion.div>

      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        <AnimatePresence mode="wait">

          {/* ── RESULT ─────────────────────────────────────── */}
          {result && riskCfg ? (
            <motion.div key="result" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Score card */}
              <div style={{ background: "#fff", borderRadius: 20, padding: "36px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6", marginBottom: 14 }}>
                <ScoreGauge score={result.score} />
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }} style={{ textAlign: "center", marginTop: 12 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: riskCfg.bg, border: `1.5px solid ${riskCfg.color}30`, borderRadius: 100, padding: "6px 18px" }}>
                    <riskCfg.icon size={15} color={riskCfg.color} />
                    <span style={{ fontWeight: 700, fontSize: 14, color: riskCfg.color }}>{riskCfg.label}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 28, marginTop: 18 }}>
                    {[["DECISION", riskCfg.rec, riskCfg.color], ["DTI RATIO", result.debtToIncomeRatio + "%", "#374151"], ["MAX LOAN", fmt(result.maxRecommendedLoan), "#374151"]].map(([lbl, val, col], i) => (
                      <div key={i} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, letterSpacing: "0.06em" }}>{lbl}</div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: col, marginTop: 3 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Factors */}
              <div style={{ background: "#fff", borderRadius: 20, padding: "24px 24px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Activity size={15} color="#6366f1" />
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, color: "#111827" }}>Risk Factors</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {result.factors.map((f, i) => <FactorRow key={f.factor} {...f} delay={i * 0.07} />)}
                </div>
              </div>

              {/* AI */}
              <div style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius: 20, padding: "24px 28px", boxShadow: "0 4px 24px rgba(99,102,241,0.25)", marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Sparkles size={15} color="#fff" />
                  <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15, color: "#fff" }}>AI Analysis</span>
                </div>
                <p style={{ color: "rgba(255,255,255,0.92)", fontSize: 14, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" }}>{result.aiExplanation}</p>
              </div>

              <div style={{ display: "flex", justifyContent: "center" }}>
                <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "12px 28px", fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: "DM Sans, sans-serif" }}>
                  <RotateCcw size={14} /> New Assessment
                </button>
              </div>
            </motion.div>

          /* ── LOADING ─────────────────────────────────────── */
          ) : mutation.isPending ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: "#fff", borderRadius: 20, padding: "72px 32px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", textAlign: "center" }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                style={{ width: 48, height: 48, border: "3px solid #f3f4f6", borderTopColor: "#6366f1", borderRadius: "50%", margin: "0 auto 20px" }} />
              <p style={{ color: "#6b7280", fontWeight: 500, margin: 0 }}>Analyzing your application…</p>
              <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 6 }}>Running risk model + AI explanation</p>
            </motion.div>

          /* ── FORM ─────────────────────────────────────────── */
          ) : (
            <motion.div key="form" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {/* Step indicators */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 32 }}>
                {STEPS.map((s, i) => {
                  const done = i < step, active = i === step;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: done ? "#6366f1" : active ? "#fff" : "#f9fafb", border: active ? "2.5px solid #6366f1" : done ? "none" : "2px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: active ? "0 0 0 4px rgba(99,102,241,0.15)" : "none", transition: "all 0.3s" }}>
                          {done ? <CheckCircle2 size={18} color="#fff" /> : <s.icon size={16} color={active ? "#6366f1" : "#9ca3af"} />}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: active ? 600 : 400, color: active ? "#6366f1" : done ? "#374151" : "#9ca3af" }}>{s.label}</span>
                      </div>
                      {i < 2 && <div style={{ width: 56, height: 2, background: i < step ? "#6366f1" : "#e5e7eb", margin: "0 8px", marginBottom: 22, transition: "background 0.3s" }} />}
                    </div>
                  );
                })}
              </div>

              {/* Form card */}
              <div style={{ background: "#fff", borderRadius: 20, padding: "30px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.07)", border: "1px solid #f3f4f6" }}>
                <div style={{ marginBottom: 26 }}>
                  <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 22, color: "#111827", margin: 0 }}>{STEPS[step].title}</h2>
                  <p style={{ color: "#6b7280", marginTop: 4, fontSize: 14, margin: "4px 0 0" }}>{STEPS[step].subtitle}</p>
                </div>

                <AnimatePresence mode="wait">
                  {step === 0 && (
                    <motion.div key="s0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      <FieldGroup label="Full Name"><Input value={form.fullName} onChange={set("fullName")} placeholder="Jane Doe" />{e("fullName")}</FieldGroup>
                      <FieldGroup label="Age"><Input value={form.age} onChange={set("age")} type="number" placeholder="30" min="18" max="100" />{e("age")}</FieldGroup>
                      <FieldGroup label="Employment Status">
                        <Select value={form.employmentStatus} onChange={set("employmentStatus")} placeholder="Select status"
                          options={[{ value: "employed", label: "Employed (full-time)" }, { value: "self_employed", label: "Self-Employed" }, { value: "retired", label: "Retired" }, { value: "student", label: "Student" }, { value: "unemployed", label: "Unemployed" }]} />
                        {e("employmentStatus")}
                      </FieldGroup>
                    </motion.div>
                  )}
                  {step === 1 && (
                    <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      <FieldGroup label="Annual Income ($)" hint="Gross income before taxes"><Input value={form.annualIncome} onChange={set("annualIncome")} type="number" placeholder="75000" min="0" />{e("annualIncome")}</FieldGroup>
                      <FieldGroup label="Monthly Expenses ($)" hint="Rent, utilities, groceries, etc."><Input value={form.monthlyExpenses} onChange={set("monthlyExpenses")} type="number" placeholder="2000" min="0" />{e("monthlyExpenses")}</FieldGroup>
                      <FieldGroup label="Total Existing Debt ($)" hint="All current loans and credit card balances"><Input value={form.existingDebt} onChange={set("existingDebt")} type="number" placeholder="10000" min="0" />{e("existingDebt")}</FieldGroup>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <FieldGroup label="Loan Amount ($)"><Input value={form.loanAmount} onChange={set("loanAmount")} type="number" placeholder="25000" min="1000" />{e("loanAmount")}</FieldGroup>
                        <FieldGroup label="Loan Purpose">
                          <Select value={form.loanPurpose} onChange={set("loanPurpose")} placeholder="Purpose"
                            options={[{ value: "home", label: "Home" }, { value: "car", label: "Car" }, { value: "business", label: "Business" }, { value: "education", label: "Education" }, { value: "personal", label: "Personal" }, { value: "medical", label: "Medical" }]} />
                          {e("loanPurpose")}
                        </FieldGroup>
                      </div>
                    </motion.div>
                  )}
                  {step === 2 && (
                    <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                      <FieldGroup label="Credit Score" hint="FICO score between 300 and 850">
                        <Input value={form.creditScore} onChange={set("creditScore")} type="number" placeholder="720" min="300" max="850" />
                        {e("creditScore")}
                        {form.creditScore && +form.creditScore >= 300 && +form.creditScore <= 850 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                            {[["300","579","#ef4444","Poor"],["580","669","#f97316","Fair"],["670","739","#f59e0b","Good"],["740","799","#22c55e","Very Good"],["800","850","#10b981","Exceptional"]].map(([lo,hi,c,lbl]) => (
                              <div key={lbl} style={{ flex: 1, height: 4, borderRadius: 4, background: +form.creditScore >= +lo && +form.creditScore <= +hi ? c : "#e5e7eb", transition: "background 0.2s" }} title={`${lbl}: ${lo}–${hi}`} />
                            ))}
                          </div>
                        )}
                      </FieldGroup>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <FieldGroup label="Missed Payments" hint="Past 2 years"><Input value={form.missedPayments} onChange={set("missedPayments")} type="number" placeholder="0" min="0" />{e("missedPayments")}</FieldGroup>
                        <FieldGroup label="Years of Credit History"><Input value={form.yearsOfCreditHistory} onChange={set("yearsOfCreditHistory")} type="number" placeholder="5" min="0" />{e("yearsOfCreditHistory")}</FieldGroup>
                      </div>
                      <FieldGroup label="Bankruptcies" hint="Total bankruptcies filed"><Input value={form.bankruptcies} onChange={set("bankruptcies")} type="number" placeholder="0" min="0" />{e("bankruptcies")}</FieldGroup>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Nav buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
                  <button onClick={() => { setStep(s => s - 1); topRef.current?.scrollIntoView({ behavior: "smooth" }); }} disabled={step === 0}
                    style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "11px 22px", fontSize: 14, fontWeight: 500, color: step === 0 ? "#d1d5db" : "#374151", cursor: step === 0 ? "not-allowed" : "pointer", fontFamily: "DM Sans, sans-serif" }}>
                    <ChevronLeft size={16} /> Back
                  </button>
                  <button onClick={next}
                    style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", borderRadius: 12, padding: "12px 28px", fontSize: 14, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "DM Sans, sans-serif", boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}>
                    {step === 2 ? <><Sparkles size={14} /> Analyze Risk</> : <>Next <ChevronRight size={16} /></>}
                  </button>
                </div>

                {mutation.isError && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ marginTop: 16, padding: "12px 16px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#dc2626", fontSize: 13 }}>
                    {mutation.error?.message || "Something went wrong. Please try again."}
                  </motion.div>
                )}
              </div>

              <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, marginTop: 20 }}>
                For demonstration purposes only. Not financial advice.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
