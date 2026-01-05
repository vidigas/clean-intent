import { useState, useEffect } from 'react';
import { LandingPage } from './components/LandingPage';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_KEY_STORAGE_KEY = 'irl_api_key';

interface Constraint {
  text: string;
  type: 'hard' | 'soft';
}

interface Conflict {
  type: string;
  description: string;
  severity: 'warning' | 'blocking';
  terms: string[];
}

interface OutputExpectation {
  length: string | null;
  format: string | null;
  structure: string[] | null;
}

interface Intent {
  version: string;
  primaryGoal: string;
  taskType: string | null;
  audience: string | null;
  domain: string | null;
  constraints: {
    hard: Constraint[];
    soft: Constraint[];
  };
  outputExpectations: OutputExpectation | null;
  conflicts: Conflict[];
  requiresClarification: boolean;
  rawInput: string;
  assumptions: string[];
}

interface NormalizeResponse {
  intent: Intent;
  irl: string;
  compiled: string;
}

function Demo({ onBack }: { onBack: () => void }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<NormalizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
    } else {
      setShowSettings(true);
    }
  }, []);

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    if (value) {
      localStorage.setItem(API_KEY_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
    }
  };

  const handleEnhance = async () => {
    if (!input.trim()) return;
    if (!apiKey) {
      setError('Please enter your IRL API key first');
      setShowSettings(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/v1/normalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ text: input }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to normalize intent');
      }

      const data: NormalizeResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-btn" onClick={onBack}>← Back</button>
            <div>
              <h1>IRL</h1>
              <p className="subtitle">Intent Representation Language</p>
            </div>
          </div>
          <button
            className="settings-toggle"
            onClick={() => setShowSettings(!showSettings)}
          >
            {apiKey ? 'API Key Set' : 'Set API Key'}
          </button>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <label htmlFor="api-key">IRL API Key</label>
            <input
              id="api-key"
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="irl_..."
            />
            <p className="settings-hint">
              Get your API key from the dashboard.
              {!apiKey && ' Required to use the demo.'}
            </p>
          </div>
        )}
      </header>

      <main className="main">
        <section className="input-section">
          <label htmlFor="intent-input">Your intent (natural language)</label>
          <textarea
            id="intent-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you want to accomplish. Be as natural as you like..."
            rows={6}
          />
          <button
            className="enhance-button"
            onClick={handleEnhance}
            disabled={loading || !input.trim()}
          >
            {loading ? 'Processing...' : 'Enhance Intent'}
          </button>
          {error && <p className="error">{error}</p>}
        </section>

        {result && (
          <div className="results">
            <section className="panel">
              <div className="panel-header">
                <h2>Parsed Intent</h2>
              </div>
              <div className="panel-content">
                <div className="intent-field">
                  <span className="label">Goal:</span>
                  <span className="value">{result.intent.primaryGoal}</span>
                </div>

                {result.intent.taskType && (
                  <div className="intent-field">
                    <span className="label">Task Type:</span>
                    <span className="value badge">{result.intent.taskType}</span>
                  </div>
                )}

                {result.intent.audience && (
                  <div className="intent-field">
                    <span className="label">Audience:</span>
                    <span className="value">{result.intent.audience}</span>
                  </div>
                )}

                {result.intent.domain && (
                  <div className="intent-field">
                    <span className="label">Domain:</span>
                    <span className="value badge">{result.intent.domain}</span>
                  </div>
                )}

                {result.intent.constraints.hard.length > 0 && (
                  <div className="intent-field">
                    <span className="label">Hard Constraints:</span>
                    <ul className="constraints-list">
                      {result.intent.constraints.hard.map((c, i) => (
                        <li key={i}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.intent.constraints.soft.length > 0 && (
                  <div className="intent-field">
                    <span className="label">Preferences:</span>
                    <ul className="constraints-list soft">
                      {result.intent.constraints.soft.map((c, i) => (
                        <li key={i}>{c.text}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.intent.outputExpectations && (
                  <div className="intent-field">
                    <span className="label">Output:</span>
                    <span className="value">
                      {[
                        result.intent.outputExpectations.length,
                        result.intent.outputExpectations.format,
                      ]
                        .filter(Boolean)
                        .join(', ') || 'No specific requirements'}
                    </span>
                  </div>
                )}

                {result.intent.conflicts.length > 0 && (
                  <div className="conflicts-section">
                    <h3>Detected Conflicts</h3>
                    {result.intent.conflicts.map((conflict, i) => (
                      <div
                        key={i}
                        className={`conflict ${conflict.severity}`}
                      >
                        <span className="conflict-badge">{conflict.severity}</span>
                        <span className="conflict-desc">{conflict.description}</span>
                        <span className="conflict-terms">
                          Terms: {conflict.terms.join(' vs ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {result.intent.assumptions.length > 0 && (
                  <div className="assumptions-section">
                    <h3>Assumptions Made</h3>
                    <ul>
                      {result.intent.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>IRL Format</h2>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(result.irl, 'irl')}
                >
                  {copiedField === 'irl' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="code-block">{result.irl}</pre>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Compiled Prompt</h2>
                <button
                  className="copy-button"
                  onClick={() => copyToClipboard(result.compiled, 'compiled')}
                >
                  {copiedField === 'compiled' ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="code-block">{result.compiled}</pre>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function App() {
  const [showDemo, setShowDemo] = useState(false);

  if (showDemo) {
    return <Demo onBack={() => setShowDemo(false)} />;
  }

  return <LandingPage onTryDemo={() => setShowDemo(true)} />;
}

export default App;
