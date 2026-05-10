import { useState } from 'react';

const API = '/api';

function hostnameColor(hostname) {
  let h = 0;
  for (const c of hostname) h = c.charCodeAt(0) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360}, 60%, 58%)`;
}

export default function App() {
  const [hello, setHello]   = useState(null);
  const [info, setInfo]     = useState(null);
  const [health, setHealth] = useState(null);
  const [lbHits, setLbHits] = useState([]);
  const [error, setError]   = useState('');

  const call = async (path, setter) => {
    try {
      setError('');
      const res = await fetch(`${API}/${path}`);
      setter(await res.json());
    } catch (e) { setError(e.message); }
  };

  const lbDemo = async () => {
    setLbHits([]);
    const results = [];
    for (let i = 0; i < 10; i++) {
      try {
        const r = await fetch(`${API}/hello`);
        results.push(await r.json());
      } catch { results.push({ hostname: 'error' }); }
    }
    setLbHits(results);
  };

  return (
    <>
      <div className="grain" />

      <header>
        <div className="logo">⎈</div>
        <h1>Kubernetes <span className="accent">React</span> + <span className="accent2">Spring&nbsp;Boot</span></h1>
        <p className="sub">Project 2 — Full-Stack Java Demo</p>
      </header>

      <main>
        {error && <div className="toast">{error}</div>}

        {/* Hello Card */}
        <section className="card">
          <h2>🔗 API Response</h2>
          <button onClick={() => call('hello', setHello)}>Call /api/hello</button>
          <pre className="box">{hello ? JSON.stringify(hello, null, 2) : 'Click to call backend…'}</pre>
        </section>

        {/* Info Card */}
        <section className="card">
          <h2>🖥️ Pod Info</h2>
          <button onClick={() => call('info', setInfo)}>Fetch /api/info</button>
          <pre className="box">{info ? JSON.stringify(info, null, 2) : 'Pod metadata…'}</pre>
        </section>

        {/* Health Card */}
        <section className="card">
          <h2>💚 Health Check</h2>
          <button onClick={() => call('health', setHealth)}>Check /api/health</button>
          <pre className="box">{health ? JSON.stringify(health, null, 2) : 'Health status…'}</pre>
        </section>

        {/* LB Card */}
        <section className="card wide">
          <h2>⚖️ Load Balancing Demo</h2>
          <p className="hint">Hit the API rapidly to see requests spread across replicas.</p>
          <button onClick={lbDemo}>Send 10 Requests</button>
          <div className="lb-grid">
            {lbHits.map((h, i) => (
              <div
                key={i}
                className="chip"
                style={{
                  borderColor: hostnameColor(h.hostname),
                  color: hostnameColor(h.hostname),
                  animationDelay: `${i * 0.06}s`
                }}
              >
                {h.hostname}
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer>
        <p>Built for the <strong>K8s Workshop</strong> — KillerCoda</p>
      </footer>
    </>
  );
}
