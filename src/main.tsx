import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexProvider, ConvexReactClient, useAction, useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { api } from '../convex/_generated/api';
import './styles.css';

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

type EmploymentType = 'full-time' | 'freelance';

type FormState = {
  email: string;
  employmentType: EmploymentType;
  role: string;
  city: string;
  experience: string;
  salaryOrRate: string;
  companySize: string;
};

type Analysis = {
  id: string;
  role: string;
  city: string;
  employmentType: EmploymentType;
  experience: number;
  salaryOrRate: number;
  percentile: number;
  marketMin: number;
  marketMedian: number;
  marketMax: number;
  suggested: number;
  confidence: number;
  sources: string[];
  sourceLinks: string[];
  communityComparables: number;
  communityPool: number;
  explanation: string;
};

type LiveResearch = {
  configured: boolean;
  answer: string;
  sources: Array<{
    name: string;
    url: string;
    snippet: string;
  }>;
  searchedAt: number;
  query: string;
  rawResultCount?: number;
  error?: string;
};

const initialForm: FormState = {
  email: '',
  employmentType: 'full-time',
  role: '',
  city: '',
  experience: '',
  salaryOrRate: '',
  companySize: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown) {
  if (error instanceof ConvexError) return String(error.data);
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

function currency(value: number, type: EmploymentType) {
  if (type === 'freelance') {
    return `₹${Math.round(value).toLocaleString('en-IN')}/hr`;
  }
  return `₹${Number(value.toFixed(1)).toLocaleString('en-IN')} LPA`;
}

function compactAmount(value: number) {
  return Number(value.toFixed(1)).toLocaleString('en-IN');
}

function compactCurrency(value: number, type: EmploymentType) {
  if (type === 'freelance') {
    return `₹${Math.round(value).toLocaleString('en-IN')}/hr`;
  }
  return `₹${compactAmount(value)}L`;
}

function resultBreakdown(result: Analysis) {
  const current = result.salaryOrRate;
  const belowMarket = current < result.marketMin;
  const aboveMarket = current > result.marketMax;

  if (belowMarket) {
    const gap = result.marketMin - current;
    const percent = Math.round((gap / result.marketMin) * 100);
    return {
      marketLine: `Market pays ${compactCurrency(result.marketMin, result.employmentType)}–${compactCurrency(result.marketMax, result.employmentType)} for this role`,
      gapLine: `You are underpaid ${compactCurrency(gap, result.employmentType)} (~${percent}% below market)`,
    };
  }

  if (aboveMarket) {
    const gap = current - result.marketMax;
    const percent = Math.round((gap / result.marketMax) * 100);
    return {
      marketLine: `Market pays ${compactCurrency(result.marketMin, result.employmentType)}–${compactCurrency(result.marketMax, result.employmentType)} for this role`,
      gapLine: `You are above market by ${compactCurrency(gap, result.employmentType)} (~${percent}% above market)`,
    };
  }

  return {
    marketLine: `Market pays ${compactCurrency(result.marketMin, result.employmentType)}–${compactCurrency(result.marketMax, result.employmentType)} for this role`,
    gapLine: `You are within the market range for this role`,
  };
}

function downloadResultCard(result: Analysis) {
  const title = 'AM I UNDERPAID?';
  const details = resultBreakdown(result);
  const lines = [
    title,
    details.gapLine,
    `${result.role} • ${result.city}`,
    `${result.experience} years experience`,
    details.marketLine,
    `${result.employmentType === 'freelance' ? 'Suggested quote' : 'Suggested target'}: ${currency(result.suggested, result.employmentType)}`,
    `Confidence: ${result.confidence}%`,
    `Community pool: ${result.communityPool.toLocaleString('en-IN')} checks`,
    'Check yours: amIunderpaid.app',
  ];

  const escaped = lines.map((line) =>
    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );
  const text = escaped
    .map((line, index) => `<text x="56" y="${78 + index * 58}" class="${index === 0 ? 'title' : index === 1 ? 'hero' : 'line'}">${line}</text>`)
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="720" viewBox="0 0 1080 720">
    <defs>
      <style>.title{font:800 40px Inter,Arial,sans-serif;fill:#24452c;letter-spacing:4px}.hero{font:800 42px Inter,Arial,sans-serif;fill:#0a0a0a}.line{font:500 28px Inter,Arial,sans-serif;fill:#18181b}</style>
    </defs>
    <rect width="1080" height="720" rx="42" fill="#f7f7f4"/>
    <rect x="32" y="32" width="1016" height="656" rx="32" fill="#ffffff" stroke="#d4d4d8"/>
    ${text}
  </svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `am-i-underpaid-${result.role.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.svg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ProductApp() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [step, setStep] = useState<'email' | 'details'>('email');
  const [error, setError] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [liveResearch, setLiveResearch] = useState<LiveResearch | null>(null);
  const [liveResearchError, setLiveResearchError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitInProgress = useRef(false);
  const submitAndAnalyze = useMutation(api.submissions.submitAndAnalyze);
  const fetchSalaryData = useAction(api.marketResearch.fetchSalaryData);

  const isFreelance = form.employmentType === 'freelance';
  const normalizedEmail = form.email.trim().toLowerCase();
  const isEmailReady = EMAIL_REGEX.test(normalizedEmail);
  const isFormReady = Boolean(
    form.role.trim() &&
      form.city.trim() &&
      form.experience.trim() &&
      form.salaryOrRate.trim() &&
      Number.isFinite(Number(form.experience)) &&
      Number.isFinite(Number(form.salaryOrRate)) &&
      Number(form.salaryOrRate) > 0,
  );
  const resultDetails = result ? resultBreakdown(result) : null;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (error) setError('');
  }

  function editDetails() {
    setResult(null);
    setStep('details');
    setError('');
  }

  function proceedToDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isEmailReady) {
      setError('Please enter a valid email address to continue.');
      return;
    }
    setError('');
    setStep('details');
  }

  function backToEmail() {
    setError('');
    setStep('email');
  }

  async function handleCheck() {
    if (!isEmailReady) {
      setError('Please enter a valid email address to continue.');
      setStep('email');
      return;
    }
    if (!isFormReady || isSubmitting || submitInProgress.current) return;

    const experience = Number(form.experience);
    const salaryOrRate = Number(form.salaryOrRate);

    if (!form.role.trim() || !form.city.trim()) {
      setError('Enter your role and city to compare against the market.');
      return;
    }
    if (!Number.isFinite(experience) || experience < 0) {
      setError('Enter valid years of experience.');
      return;
    }
    if (!Number.isFinite(salaryOrRate) || salaryOrRate <= 0) {
      setError(isFreelance ? 'Enter a valid hourly rate.' : 'Enter a valid annual CTC in LPA.');
      return;
    }

    submitInProgress.current = true;
    setIsSubmitting(true);
    setError('');
    setLiveResearch(null);
    setLiveResearchError('');
    try {
      const response = await submitAndAnalyze({
        employmentType: form.employmentType,
        role: form.role,
        city: form.city,
        experience,
        salaryOrRate,
        email: normalizedEmail,
        companySize: form.companySize.trim() || undefined,
      });
      setResult(response as Analysis);

      try {
        const research = await fetchSalaryData({
          role: form.role,
          city: form.city,
          experience,
        });
        setLiveResearch(research as LiveResearch);
      } catch (researchError) {
        setLiveResearchError(getErrorMessage(researchError));
      }
    } catch (submissionError) {
      setError(getErrorMessage(submissionError));
    } finally {
      submitInProgress.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="checker-shell">
        {step === 'email' && !result && (
          <div className="checker-intro">
            <h1>Check if you&apos;re <span>underpaid</span></h1>
            <p>Negotiate your next offer with real market data.</p>
          </div>
        )}

        <div className={`checker-card ${result ? 'results-card' : ''}`}>
          {result ? (
            <section className="result-view" aria-live="polite">
              <div className="result-hero-panel">
                <button className="back-action" type="button" onClick={editDetails}>
                  <span aria-hidden="true">←</span> Edit details
                </button>

                <div className="result-hero-copy">
                  <p className="card-label">Your market range</p>
                  <h2>{result.role} in {result.city}, here&apos;s your market range</h2>
                  <strong className="market-hero-number">
                    {compactCurrency(result.marketMin, result.employmentType)}–{compactCurrency(result.marketMax, result.employmentType)}
                  </strong>
                  <span className="submission-badge">
                    <span className="users-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M16.5 11.5c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3Zm-9 0c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3Zm0 2c-2.2 0-5.5 1.1-5.5 3.3V18h11v-1.2c0-2.2-3.3-3.3-5.5-3.3Zm9 0c-.3 0-.7 0-1.1.1 1.1.8 1.9 1.8 1.9 3.2V18H22v-1.2c0-2.2-3.3-3.3-5.5-3.3Z" />
                      </svg>
                    </span>
                    based on {result.communityPool.toLocaleString('en-IN')}+ anonymous submissions
                  </span>
                </div>
              </div>

              <div className="result-body-panel">
                {resultDetails && (
                  <div className="comparison-copy">
                    <p>{resultDetails.gapLine}</p>
                    <p className="market-line">{resultDetails.marketLine}</p>
                  </div>
                )}

                <div className="trust-row-list" aria-label="Trust and features">
                  <div className="trust-row-item">
                    <span className="feature-icon" aria-hidden="true">●</span>
                    <div>
                      <strong>email captured privately</strong>
                      <span>no name required</span>
                    </div>
                  </div>
                  <div className="trust-row-item">
                    <span className="feature-icon" aria-hidden="true">◇</span>
                    <div>
                      <strong>no paperwork needed</strong>
                      <span>just role, city and experience</span>
                    </div>
                  </div>
                  <div className="trust-row-item">
                    <span className="feature-icon" aria-hidden="true">↻</span>
                    <div>
                      <strong>updated market data</strong>
                      <span>refreshed from live submissions</span>
                    </div>
                  </div>
                </div>

                <details className="calculation-details">
                  <summary>how we calculate this</summary>
                  <p>{result.explanation}</p>
                  <p>We blend the deterministic market model with anonymous community submissions. Suggested target: {currency(result.suggested, result.employmentType)}. Confidence: {result.confidence}%.</p>
                </details>

                <button className="share-result-action" type="button" onClick={() => downloadResultCard(result)}>
                  Share your result <span aria-hidden="true">→</span>
                </button>

                <p className="result-trust-note"><span aria-hidden="true">✓</span> trusted by professionals across India</p>
              </div>
            </section>
          ) : step === 'email' ? (
            <form className="check-form email-step-form" onSubmit={proceedToDetails} noValidate>
              <label>
                Email address
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => update('email', event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </label>

              {error && <p className="form-message" role="alert">{error}</p>}

              <button className="primary-action" type="submit" disabled={!isEmailReady}>
                Proceed
              </button>
              <p className="privacy-note">We&apos;ll use this to send your result and product updates. Your salary details stay private.</p>
            </form>
          ) : (
            <form
              className="check-form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCheck();
              }}
              noValidate
            >
              <button className="back-action details-back-action" type="button" onClick={backToEmail}>
                <span aria-hidden="true">←</span> Email
              </button>

              <div className="mode-toggle" role="radiogroup" aria-label="Employment type">
                <button
                  className={form.employmentType === 'full-time' ? 'active' : ''}
                  type="button"
                  onClick={() => update('employmentType', 'full-time')}
                >
                  Full-time
                </button>
                <button
                  className={form.employmentType === 'freelance' ? 'active' : ''}
                  type="button"
                  onClick={() => update('employmentType', 'freelance')}
                >
                  Freelancer
                </button>
              </div>

              <label>
                Role
                <input value={form.role} onChange={(event) => update('role', event.target.value)} placeholder="Product Designer" />
              </label>

              <label>
                City
                <input value={form.city} onChange={(event) => update('city', event.target.value)} placeholder="Bangalore" />
              </label>

              <div className="field-grid">
                <label>
                  Experience
                  <input
                    min="0"
                    step="0.5"
                    type="number"
                    value={form.experience}
                    onChange={(event) => update('experience', event.target.value)}
                    placeholder="4.5"
                  />
                </label>
                <label>
                  {isFreelance ? 'Hourly rate (₹)' : 'Annual CTC (LPA)'}
                  <input
                    min="0"
                    step={isFreelance ? '50' : '0.1'}
                    type="number"
                    value={form.salaryOrRate}
                    onChange={(event) => update('salaryOrRate', event.target.value)}
                    placeholder={isFreelance ? '1800' : '18'}
                  />
                </label>
              </div>

              {!isFreelance && (
                <label>
                  <span className="field-label-text">Company size <span className="optional">(optional)</span></span>
                  <span className="select-shell">
                    <select value={form.companySize} onChange={(event) => update('companySize', event.target.value)}>
                      <option value="">Any size</option>
                      <option value="Startup">Startup</option>
                      <option value="Mid-market">Mid-market</option>
                      <option value="Enterprise">Enterprise</option>
                    </select>
                  </span>
                </label>
              )}

              {error && <p className="form-message" role="alert">{error}</p>}

              <button
                className="primary-action"
                type="button"
                disabled={!isFormReady || isSubmitting}
                onClick={() => void handleCheck()}
                onPointerDown={() => void handleCheck()}
              >
                {isSubmitting ? 'Calculating…' : 'Check my market position'}
              </button>
              <p className="privacy-note">Your check is stored with your email so we can send the result and improve comparisons.</p>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}

function sourceLinksLabel(source: string, link?: string) {
  return link ? `${source} · ${link}` : source;
}

function MissingConnection() {
  return (
    <main className="page-shell missing-connection">
      <section className="checker-card">
        <p className="eyebrow">Connection needed</p>
        <h1>Convex is not connected yet.</h1>
        <p className="hero-subtitle">
          Add <code>VITE_CONVEX_URL</code> to <code>.env.local</code> or run <code>npx convex dev</code> locally, then reload.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {convex ? (
      <ConvexProvider client={convex}>
        <ProductApp />
      </ConvexProvider>
    ) : (
      <MissingConnection />
    )}
  </React.StrictMode>,
);
