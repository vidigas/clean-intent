import { useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onTryDemo: () => void;
}

interface ClarificationQuestion {
  id: string;
  question: string;
  why: string;
  options: { value: string; label: string }[];
  allowCustom: boolean;
}

interface ClarificationResponse {
  originalInput: string;
  needsClarification: boolean;
  summary: string;
  questions: ClarificationQuestion[];
}

interface IntentBreakdown {
  goal: string;
  audience?: string;
  scope?: string;
  format?: string;
  constraints?: string[];
}

interface RefinedPromptResponse {
  originalInput: string;
  refinedPrompt: string;
  intentBreakdown: IntentBreakdown;
  explanation: string;
}

type FlowStep = 'input' | 'clarifying' | 'answering' | 'refining' | 'done' | 'clear';

export function LandingPage({ onTryDemo }: LandingPageProps) {
  const [demoInput, setDemoInput] = useState('');
  const [flowStep, setFlowStep] = useState<FlowStep>('input');
  const [clarification, setClarification] = useState<ClarificationResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [refinedResult, setRefinedResult] = useState<RefinedPromptResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openWithAI = (tool: 'chatgpt' | 'claude', prompt: string) => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    const urls = {
      chatgpt: 'https://chat.openai.com/',
      claude: 'https://claude.ai/new',
    };
    window.open(urls[tool], '_blank');
  };

  const handleClean = async () => {
    if (!demoInput.trim()) return;
    setLoading(true);
    setError(null);
    setFlowStep('clarifying');
    try {
      const response = await fetch('http://localhost:3001/demo/clarify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: demoInput }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed');
      }
      const data: ClarificationResponse = await response.json();
      setClarification(data);
      setAnswers({});
      setCurrentQuestionIndex(0);

      if (data.needsClarification && data.questions.length > 0) {
        setFlowStep('answering');
      } else {
        // Prompt is clear, no questions needed
        setFlowStep('clear');
      }

      // Scroll to demo section
      setTimeout(() => {
        document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setFlowStep('input');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleNextQuestion = () => {
    if (!clarification) return;
    if (currentQuestionIndex < clarification.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      // All questions answered, refine
      handleRefine();
    }
  };

  const currentQuestion = clarification?.questions[currentQuestionIndex];

  const handleRefine = async () => {
    if (!clarification) return;
    setLoading(true);
    setError(null);
    setFlowStep('refining');
    try {
      const response = await fetch('http://localhost:3001/demo/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ originalInput: clarification.originalInput, answers }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || 'Failed');
      }
      const data: RefinedPromptResponse = await response.json();
      setRefinedResult(data);
      setFlowStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setFlowStep('answering');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setDemoInput('');
    setClarification(null);
    setAnswers({});
    setCurrentQuestionIndex(0);
    setRefinedResult(null);
    setFlowStep('input');
    setError(null);
  };

  const scrollToDemo = () => {
    document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToHowItWorks = () => {
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
  };


  const faqs = [
    {
      q: 'How is this different from prompt engineering?',
      a: "Prompt engineering teaches you how to write better prompts. Clean Intent extracts what you mean and makes it explicit — even if your prompt is messy. It's a clarification layer, not a writing tool.",
    },
    {
      q: 'Does it work with ChatGPT, Claude, and other tools?',
      a: 'Yes. Clean Intent produces standardized output that works with any AI tool. You clarify once, then use the clean intent anywhere.',
    },
    {
      q: 'Do I need to sign up to try it?',
      a: 'No. The free tier requires no account. Just visit the site and start clarifying prompts immediately.',
    },
    {
      q: "What if I don't see any choices to make?",
      a: 'That means your intent was already clear. Clean Intent will just confirm what you meant and standardize it for reuse.',
    },
    {
      q: 'Can I save and reuse my clean intents?',
      a: 'Yes, with the Pro plan. You can save intents, tag them, and reuse them across different AI tools and projects.',
    },
    {
      q: 'Is this an AI tool itself?',
      a: "Clean Intent uses AI to understand your prompt, but it's not an AI assistant. It's a clarification layer that runs before you send anything to ChatGPT, Claude, or other tools.",
    },
  ];

  return (
    <div className="landing">
      {/* Nav */}
      <nav className="nav">
        <div className="nav-left">
          <span className="logo">Clean Intent</span>
        </div>
        <div className="nav-center">
          <button className="nav-link" onClick={scrollToHowItWorks}>How it works</button>
          <button className="nav-link" onClick={scrollToDemo}>Demo</button>
        </div>
        <div className="nav-right">
          <a href="https://github.com/vidigas/clean-intent" target="_blank" rel="noopener noreferrer" className="nav-link">GitHub</a>
          <button className="nav-cta" onClick={scrollToDemo}>Try it live</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="hero-wrapper">
        <section className="hero">
          <h1>Clean your intent<br />before the AI <span className="underline">guesses</span>.</h1>
          <p className="hero-sub">
            Turn vague prompts into clear intent — so AI outputs are consistent, predictable, and actually what you want.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary" onClick={scrollToDemo}>Try it live</button>
            <button className="btn-secondary" onClick={scrollToHowItWorks}>See how it works</button>
          </div>
          <div className="hero-terminal">
            <div className="terminal-dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <div className="terminal-content">
              <div className="terminal-input">
                <textarea
                  className="terminal-input-field"
                  value={demoInput}
                  onChange={(e) => setDemoInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleClean(); } }}
                  placeholder="Write a simple but comprehensive guide to React hooks"
                  rows={2}
                />
              </div>
              {demoInput.trim() && <p className="terminal-hint">Press Enter to clean your intent</p>}
            </div>
          </div>
          {error && <p className="hero-error">{error}</p>}

          <p className="demo-hint">Watch how Clean Intent helps you clarify your prompt before sending to AI</p>

          {/* Demo flow results - directly under the terminal */}
          <div className="demo-flow" id="demo">
          {/* Loading state */}
          {(flowStep === 'clarifying' || flowStep === 'refining') && (
            <div className="flow-step-box">
              <div className="flow-loading">
                <div className="spinner"></div>
                <p>{flowStep === 'clarifying' ? 'Analyzing your prompt...' : 'Generating refined prompt...'}</p>
              </div>
            </div>
          )}

          {/* Prompt is clear - no questions needed */}
          {flowStep === 'clear' && clarification && (
            <div className="flow-step-box clear-box">
              <div className="flow-step-label">Your prompt is clear</div>
              <div className="flow-step-content">
                <p className="clear-summary">{clarification.summary}</p>
                <div className="clear-message">
                  <span className="clear-icon">✓</span>
                  <span>No clarification needed. Your intent is already well-defined.</span>
                </div>
              </div>
            </div>
          )}

          {/* Summary */}
          {clarification && flowStep === 'answering' && (
            <div className="flow-step-box">
              <div className="flow-step-label">We understood</div>
              <div className="flow-step-content summary">
                <p>{clarification.summary}</p>
              </div>
            </div>
          )}

          {/* Questions - answered ones collapsed, current one expanded */}
          {flowStep === 'answering' && clarification && (
            <div className="questions-stack">
              {/* Answered questions - collapsed */}
              {clarification.questions.slice(0, currentQuestionIndex).map((q, idx) => (
                <div key={q.id} className="answered-question">
                  <span className="answered-number">{idx + 1}</span>
                  <span className="answered-text">{q.question}</span>
                  <span className="answered-value">
                    {answers[q.id]?.startsWith('custom:')
                      ? answers[q.id].slice(7)
                      : q.options.find(o => o.value === answers[q.id])?.label || answers[q.id]}
                  </span>
                </div>
              ))}

              {/* Current question - expanded */}
              {currentQuestion && (
                <div className="flow-step-box question-box">
                  <div className="flow-step-label">
                    Question {currentQuestionIndex + 1} of {clarification.questions.length}
                  </div>
                  <div className="flow-step-content">
                    <div className="question-header">
                      <span className="question-text">{currentQuestion.question}</span>
                      <span className="question-why">{currentQuestion.why}</span>
                    </div>
                    <div className="question-options">
                      {currentQuestion.options.map((opt) => (
                        <label key={opt.value} className={`choice-option ${answers[currentQuestion.id] === opt.value ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name={currentQuestion.id}
                            value={opt.value}
                            checked={answers[currentQuestion.id] === opt.value}
                            onChange={() => handleAnswerChange(currentQuestion.id, opt.value)}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                      {currentQuestion.allowCustom && (
                        <input
                          type="text"
                          className="custom-answer"
                          placeholder="Or type your own..."
                          value={answers[currentQuestion.id]?.startsWith('custom:') ? answers[currentQuestion.id].slice(7) : ''}
                          onChange={(e) => handleAnswerChange(currentQuestion.id, `custom:${e.target.value}`)}
                        />
                      )}
                    </div>
                    <button
                      className="next-btn"
                      onClick={handleNextQuestion}
                      disabled={!answers[currentQuestion.id]}
                    >
                      {currentQuestionIndex < clarification.questions.length - 1 ? 'Next' : 'Generate refined prompt'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result */}
          {flowStep === 'done' && refinedResult && (
            <>
              <div className="flow-step-box result-box">
                <div className="flow-step-label">Refined Prompt</div>
                <div className="flow-step-content">
                  <p className="refined-text">{refinedResult.refinedPrompt}</p>
                  <div className="action-buttons">
                    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={() => handleCopy(refinedResult.refinedPrompt)}>
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </button>
                    <button className="ai-btn chatgpt" onClick={() => openWithAI('chatgpt', refinedResult.refinedPrompt)}>
                      Open ChatGPT
                    </button>
                    <button className="ai-btn claude" onClick={() => openWithAI('claude', refinedResult.refinedPrompt)}>
                      Open Claude
                    </button>
                  </div>
                </div>
              </div>

              <div className="flow-step-box breakdown-box">
                <div className="flow-step-label">Intent Breakdown</div>
                <div className="flow-step-content">
                  <div className="irl-lines">
                    <div className="irl-line">
                      <span className="irl-key">@goal</span>
                      <span className="irl-value">{refinedResult.intentBreakdown.goal}</span>
                    </div>
                    {refinedResult.intentBreakdown.audience && (
                      <div className="irl-line">
                        <span className="irl-key">@audience</span>
                        <span className="irl-value">{refinedResult.intentBreakdown.audience}</span>
                      </div>
                    )}
                    {refinedResult.intentBreakdown.scope && (
                      <div className="irl-line">
                        <span className="irl-key">@scope</span>
                        <span className="irl-value">{refinedResult.intentBreakdown.scope}</span>
                      </div>
                    )}
                    {refinedResult.intentBreakdown.format && (
                      <div className="irl-line">
                        <span className="irl-key">@format</span>
                        <span className="irl-value">{refinedResult.intentBreakdown.format}</span>
                      </div>
                    )}
                    {refinedResult.intentBreakdown.constraints && refinedResult.intentBreakdown.constraints.length > 0 && (
                      <div className="irl-line irl-constraints">
                        <span className="irl-key">@constraints</span>
                        <ul className="irl-list">
                          {refinedResult.intentBreakdown.constraints.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="intent-success">
                <span className="success-icon">✓</span>
                <span>Your prompt is now crystal clear. Copy and use it anywhere.</span>
              </div>
            </>
          )}


          {/* Error */}
          {error && (
            <div className="flow-error">
              <p>{error}</p>
            </div>
          )}

          {(flowStep === 'done' || flowStep === 'clear') && (
            <button className="btn-secondary try-again" onClick={handleReset}>
              Try another prompt
            </button>
          )}
          </div>
        </section>
      </div>

      {/* One-liner */}
      <section className="oneliner">
        <div className="oneliner-box">
          <h2>AI doesn't struggle with intelligence —<br />it struggles with unclear intent.</h2>
          <p>Clean Intent makes your intent explicit before the AI runs.</p>
        </div>
      </section>

      {/* Problem */}
      <section className="problem">
        <h2>This happens all the time</h2>
        <p className="section-sub">Sound familiar?</p>

        <div className="problem-grid">
          <div className="problem-card">
            <div className="problem-icon orange">↻</div>
            <h4>You ask for "simple but detailed"</h4>
            <p>The AI picks one direction and ignores the other. You're left wondering which version you got.</p>
          </div>
          <div className="problem-card">
            <div className="problem-icon pink">✦</div>
            <h4>You want "creative but strict"</h4>
            <p>These contradict. The AI guesses your priority. Sometimes it guesses wrong.</p>
          </div>
          <div className="problem-card">
            <div className="problem-icon blue">↺</div>
            <h4>You rewrite the same prompt again and again</h4>
            <p>Tweaking words, hoping the AI will finally understand what you meant.</p>
          </div>
          <div className="problem-card">
            <div className="problem-icon purple">⇄</div>
            <h4>Different tools give different results</h4>
            <p>Same prompt, different AI, completely different output. No consistency.</p>
          </div>
          <div className="problem-card">
            <div className="problem-icon yellow">◆</div>
            <h4>The AI guesses — and sometimes guesses wrong</h4>
            <p>You waste time regenerating, clarifying, or starting over.</p>
          </div>
          <div className="problem-card">
            <div className="problem-icon red">?</div>
            <h4>You're never quite sure what you'll get</h4>
            <p>Every prompt feels like a gamble. Predictability is a luxury.</p>
          </div>
        </div>

        <div className="problem-solution">
          <p>Clean Intent helps you decide before the AI does.</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="how-it-works">
        <span className="section-badge">How It Works</span>
        <h2>Three simple steps</h2>
        <p className="section-sub">From messy input to crystal clear intent</p>

        <div className="steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Understand</h3>
              <p>We extract the goal, scope, and format from your prompt. No magic — just intelligent parsing of what you actually wrote.</p>
              <div className="step-example">
                <div className="example-row"><span className="label purple">Goal:</span> Write a guide</div>
                <div className="example-row"><span className="label blue">Topic:</span> React hooks</div>
                <div className="example-row"><span className="label green">Scope:</span> Simple + Comprehensive</div>
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-number blue">2</div>
            <div className="step-content">
              <h3>Clarify</h3>
              <p>When your intent forks into multiple directions, we surface the choice. You pick. The AI doesn't have to guess.</p>
              <div className="step-example">
                <span className="choices-label">Choose what you mean:</span>
                <div className="choice-row">
                  <span>Quick overview (simple)</span>
                  <span className="radio"></span>
                </div>
                <div className="choice-row selected">
                  <span>Deep dive (comprehensive)</span>
                  <span className="radio checked"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="step">
            <div className="step-number green">3</div>
            <div className="step-content">
              <h3>Standardize</h3>
              <p>We produce clean, explicit intent that any AI can understand. Reusable, consistent, predictable.</p>
              <div className="step-example output">
                <div className="output-header">
                  <span className="green">Clean Intent Output</span>
                  <span className="copy-icon">📋</span>
                </div>
                <p className="output-text">Write a comprehensive guide to React hooks. Include detailed explanations, code examples, and best practices. Target audience: intermediate developers.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="comparison">
        <h2>This is not prompt rewriting</h2>
        <p className="section-sub">We don't make prompts longer. We make intent clearer.</p>

        <div className="comparison-table">
          <div className="table-header">
            <div className="col">APPROACH</div>
            <div className="col">ASKING AI AGAIN</div>
            <div className="col">CLEAN INTENT</div>
          </div>
          <div className="table-row">
            <div className="col label">Method</div>
            <div className="col bad"><span className="x">✕</span> Guessing</div>
            <div className="col good"><span className="check">✓</span> Explicit choice</div>
          </div>
          <div className="table-row">
            <div className="col label">Consistency</div>
            <div className="col bad"><span className="x">✕</span> Inconsistent</div>
            <div className="col good"><span className="check">✓</span> Deterministic</div>
          </div>
          <div className="table-row">
            <div className="col label">Reusability</div>
            <div className="col bad"><span className="x">✕</span> Disposable</div>
            <div className="col good"><span className="check">✓</span> Reusable</div>
          </div>
          <div className="table-row">
            <div className="col label">Predictability</div>
            <div className="col bad"><span className="x">✕</span> Variable results</div>
            <div className="col good"><span className="check">✓</span> Predictable output</div>
          </div>
          <div className="table-row">
            <div className="col label">Time spent</div>
            <div className="col bad"><span className="x">✕</span> Multiple iterations</div>
            <div className="col good"><span className="check">✓</span> One clear pass</div>
          </div>
        </div>

        <div className="comparison-footer">
          <p>We don't make AI smarter. We make your intent clearer.</p>
        </div>
      </section>

      {/* Who It's For */}
      <section className="who">
        <h2>Who it's for</h2>
        <p className="section-sub">Built for people who prompt daily</p>

        <div className="who-grid">
          <div className="who-card">
            <div className="who-icon yellow">⚡</div>
            <h3>Power Users</h3>
            <p>You use ChatGPT, Claude, or Cursor multiple times per day. You know what you want — you just need the AI to understand it consistently.</p>
            <ul>
              <li><span className="check">✓</span> Stop rewriting prompts</li>
              <li><span className="check">✓</span> Get predictable results</li>
              <li><span className="check">✓</span> Save time on every prompt</li>
            </ul>
          </div>
          <div className="who-card">
            <div className="who-icon purple">🔨</div>
            <h3>Builders & Creators</h3>
            <p>You're building products with AI tools like Cursor, Lovable, or v0. Precision matters. Every unclear prompt costs you time.</p>
            <ul>
              <li><span className="check">✓</span> Ship faster with clear specs</li>
              <li><span className="check">✓</span> Reduce back-and-forth</li>
              <li><span className="check">✓</span> Reuse intent across tools</li>
            </ul>
          </div>
          <div className="who-card">
            <div className="who-icon pink">👥</div>
            <h3>Teams</h3>
            <p>Your team needs consistent AI outputs. Clean Intent ensures everyone gets the same result from the same intent — no surprises.</p>
            <ul>
              <li><span className="check">✓</span> Standardize prompts</li>
              <li><span className="check">✓</span> Share reusable intent</li>
              <li><span className="check">✓</span> Maintain quality at scale</li>
            </ul>
          </div>
        </div>

        <div className="who-note">
          <p>If you prompt once a week, this probably isn't for you.</p>
        </div>
      </section>


      {/* Vision */}
      <section className="vision">
        <div className="vision-box">
          <div className="vision-icon">💡</div>
          <h2>Today, humans speak in messy language<br />and hope AI understands.</h2>
          <p>Clean Intent makes intent explicit.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <h2>Clean your intent.<br />Before the AI guesses.</h2>
        <p>Stop rewriting prompts. Start getting predictable results.</p>
        <div className="cta-buttons">
          <button className="btn-primary" onClick={scrollToDemo}>Try it live</button>
          <a href="https://github.com/vidigas/clean-intent" target="_blank" rel="noopener noreferrer" className="btn-secondary">View on GitHub</a>
        </div>
        <p className="cta-note">Free and open source.</p>
      </section>

      {/* FAQ */}
      <section className="faq">
        <h2>Common questions</h2>
        <p className="section-sub">Everything you need to know</p>

        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item ${openFaq === i ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{faq.q}</span>
                <span className="faq-arrow">›</span>
              </button>
              {openFaq === i && (
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-grid">
          <div className="footer-brand">
            <span className="logo">Clean Intent</span>
            <p>Making intent explicit before AI execution.</p>
          </div>
          <div className="footer-col">
            <h4>PRODUCT</h4>
            <a href="#how-it-works">How it works</a>
            <a href="#demo">Demo</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="footer-col">
            <h4>PROJECT</h4>
            <a href="https://github.com/vidigas/clean-intent" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/vidigas/clean-intent/issues" target="_blank" rel="noopener noreferrer">Issues</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
