import { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';

const API_URL = import.meta.env.VITE_API2_URL;

export const DEFAULT_AGATHA_SETTINGS = {
  enabled: true,
  // Operating mode that governs Agatha's verdict regime:
  //   'detection'  — binary verdict (Clean / Infected), tuned for low false-positives.
  //   'deflection' — ternary verdict (Clean / Unknown / Infected), tuned for low
  //                  false-negatives; the Unknown band forwards to a heavier
  //                  multiscanning platform (Agatha acts as a fast pre-filter).
  mode: 'detection',
  // Per-mode preferences. Each value is a flat dotted-key map sent verbatim to
  // the engine's `process` endpoint (e.g. { "pe": true, "pe.ml_enabled": true,
  // "pe.threshold": 80 }), or null to "let that mode's engine use its profile
  // defaults". The maps are kept SEPARATE per mode because the engine's threshold
  // defaults differ between the detection and deflection profiles.
  preferences: { detection: null, deflection: null },
};

// The two analysis-layer toggles that the "at least one layer" rule applies to.
// A non-image file type must keep at least one of these enabled.
const LAYER_FIELDS = ['reputation_enabled', 'ml_enabled'];

export default function Settings({ agathaSettings, multiscanningEnabled, onSave, onClose }) {
  const [multi, setMulti] = useState(!!multiscanningEnabled);
  const [agatha, setAgatha] = useState({ ...DEFAULT_AGATHA_SETTINGS, ...(agathaSettings || {}) });

  // Schema fetched from the engine (one feature group per file-type family) plus
  // the current flat values map the user is editing for the ACTIVE mode.
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState({});
  // Per-mode edited preference slices, captured as the user edits/switches modes.
  // null for a mode means "untouched this session" — its saved prefs (or engine
  // defaults) are preserved on save. Seeded from the saved per-mode prefs.
  const [prefsDraft, setPrefsDraft] = useState(() => ({
    detection: agathaSettings?.preferences?.detection ?? null,
    deflection: agathaSettings?.preferences?.deflection ?? null,
  }));
  // idle | loading | ready | unavailable | error
  const [loadState, setLoadState] = useState('idle');
  // Whether the running engine build ships the deflection (ternary) model.
  // Defaults to true so the option stays available unless the engine says no.
  const [deflectionAvailable, setDeflectionAvailable] = useState(true);

  // Best-effort: ask the engine whether the deflection model is available in
  // this build. If the call fails we leave the option enabled (default true).
  // Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    (async () => {
      try {
        const cfg = await axios.get(`${API_URL}/agatha-config`, authHeaders);
        if (!cancelled && cfg.data?.deflection_available === false) {
          setDeflectionAvailable(false);
          // Don't leave the user pinned to an unavailable mode.
          setAgatha((a) => (a.mode === 'deflection' ? { ...a, mode: 'detection' } : a));
        }
      } catch (e) {
        // Ignore — keep deflection available by default.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the engine's workflow schema for the ACTIVE mode, RE-FETCHING whenever
  // the mode changes — the threshold defaults differ per mode. Seed the editable
  // `values` from this mode's engine defaults, overlaid with this mode's edited
  // draft (or its saved prefs) so the controls reflect the selected mode.
  useEffect(() => {
    let cancelled = false;
    const mode = agatha.mode || 'detection';
    const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    (async () => {
      setLoadState('loading');
      try {
        const res = await axios.get(`${API_URL}/agatha-workflow-info?mode=${mode}`, authHeaders);
        if (cancelled) return;
        if (!res.data?.available) {
          setLoadState('unavailable');
          return;
        }
        const groups = res.data.schema?.schema || [];
        const defaults = res.data.default_values || {};
        // Prefer this session's edited draft for the mode; fall back to the saved
        // per-mode prefs. Either is overlaid on the engine defaults.
        const overlay = prefsDraft[mode] ?? agathaSettings?.preferences?.[mode] ?? null;
        setSchema(groups);
        setValues({ ...defaults, ...(overlay || {}) });
        setLoadState('ready');
      } catch (e) {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agatha.mode]);

  const setValue = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  // Switch the editing target to another mode. Commit the active mode's current
  // edits into its draft slice first (so they aren't lost), then flip the mode —
  // the schema effect re-fetches and re-seeds `values` from the new mode.
  const switchMode = (nextMode) => {
    if (nextMode === agatha.mode) return;
    if (loadState === 'ready') {
      const current = agatha.mode || 'detection';
      setPrefsDraft((d) => ({ ...d, [current]: values }));
    }
    setAgatha((a) => ({ ...a, mode: nextMode }));
  };

  const handleSave = () => {
    const activeMode = agatha.mode || 'detection';
    // Fold the active mode's live edits into the per-mode draft. The non-active
    // mode keeps whatever it had (its own edits this session, or null → saved
    // prefs / engine defaults preserved below).
    const draft = { ...prefsDraft };
    if (loadState === 'ready') draft[activeMode] = values;

    // Build the persisted per-mode preferences. For each mode use this session's
    // draft if it was touched; otherwise preserve the previously-saved slice
    // (null = use that mode's engine defaults). Never overwrite the untouched
    // mode's good prefs.
    const prevPrefs = agathaSettings?.preferences || {};
    const preferences = {
      detection: draft.detection ?? prevPrefs.detection ?? null,
      deflection: draft.deflection ?? prevPrefs.deflection ?? null,
    };
    onSave({ multiscanningEnabled: multi, agathaSettings: { ...agatha, preferences } });
    onClose();
  };

  const noEngine = !multi && !agatha.enabled;

  // Toggle an analysis layer while enforcing "at least one layer stays on".
  const toggleLayer = (groupId, fieldId, present) => {
    const key = `${groupId}.${fieldId}`;
    const current = values[key];
    if (current) {
      // Trying to turn this one off — block it if it's the last one standing.
      const others = present.filter((f) => f !== fieldId);
      const anyOtherOn = others.some((f) => values[`${groupId}.${f}`]);
      if (!anyOtherOn) return; // ignore; keep at least one layer active
    }
    setValue(key, !current);
  };

  const renderField = (groupId, field, layerFieldsPresent) => {
    const key = `${groupId}.${field.id}`;
    const val = values[key];

    if (field.type === 'int') {
      const min = field.min ?? 0;
      const max = field.max ?? 100;
      const step = field.step ?? 1;
      const num = typeof val === 'number' ? val : (field.default_value ?? 0);
      return (
        <div className="settings-field settings-field-range" key={key}>
          <div className="settings-field-head">
            <span className="settings-field-label">{field.display_name}</span>
            <span className="settings-field-value">{num}%</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={num}
            onChange={(e) => setValue(key, Number(e.target.value))}
          />
          {field.info && <span className="settings-field-info">{field.info}</span>}
        </div>
      );
    }

    // bool
    const isLayer = LAYER_FIELDS.includes(field.id);
    return (
      <div className="settings-field settings-field-toggle" key={key}>
        <div className="settings-field-text">
          <span className="settings-field-label">{field.display_name}</span>
          {field.info && <span className="settings-field-info">{field.info}</span>}
        </div>
        <label className="settings-switch settings-switch-sm">
          <input
            type="checkbox"
            checked={!!val}
            onChange={() =>
              isLayer
                ? toggleLayer(groupId, field.id, layerFieldsPresent)
                : setValue(key, !val)
            }
          />
          <span className="settings-slider"></span>
        </label>
      </div>
    );
  };

  const renderGroup = (group) => {
    const masterOn = !!values[group.id];
    const fields = group.fields || [];
    const layerFieldsPresent = fields
      .filter((f) => LAYER_FIELDS.includes(f.id))
      .map((f) => f.id);

    return (
      <div className={`settings-typecard ${masterOn ? 'open' : ''}`} key={group.id}>
        <div className="settings-typecard-head">
          <div className="settings-field-text">
            <span className="settings-label">{group.display_name}</span>
            {group.info && <span className="settings-desc">{group.info}</span>}
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={masterOn}
              onChange={() => setValue(group.id, !masterOn)}
            />
            <span className="settings-slider"></span>
          </label>
        </div>

        {masterOn && fields.length > 0 && (
          <div className="settings-typecard-body">
            {fields.map((f) => renderField(group.id, f, layerFieldsPresent))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-popup" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <div className="settings-header-left">
            <h2>Settings</h2>
          </div>
          <button className="settings-close-btn" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="settings-body">
          <section className="settings-section">
            <h3 className="settings-section-title">Scanning Engines</h3>
            <p className="settings-section-hint">
              Choose which detection layers run when you scan a file or URL.
            </p>

            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <span className="settings-label">MetaDefender Multiscanning</span>
                <span className="settings-desc">
                  Check every file against 20+ commercial anti-malware engines in a single pass.
                </span>
              </div>
              <label className="settings-switch">
                <input type="checkbox" checked={multi} onChange={() => setMulti((v) => !v)} />
                <span className="settings-slider"></span>
              </label>
            </div>

            <div className="settings-toggle-row">
              <div className="settings-toggle-info">
                <span className="settings-label">Agatha AI Engine</span>
                <span className="settings-desc">
                  Run the Agatha ONNX detection engine alongside multiscanning for a fast,
                  signature-free second opinion — file classification plus a dedicated URL model.
                </span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={agatha.enabled}
                  onChange={() => setAgatha((a) => ({ ...a, enabled: !a.enabled }))}
                />
                <span className="settings-slider"></span>
              </label>
            </div>

            {agatha.enabled && (
              <div className="settings-subgroup">
                <span className="settings-label">Operating Mode</span>
                <span className="settings-desc">
                  <strong>Detection</strong> returns a binary verdict (Clean / Infected) tuned for
                  few false positives. <strong>Deflection</strong> adds an Unknown band that is
                  forwarded to multiscanning, tuned for few false negatives — Agatha acts as a fast
                  pre-filter.
                </span>
                <div className="settings-segmented" role="group" aria-label="Agatha operating mode">
                  <button
                    type="button"
                    className={`settings-segmented-btn ${agatha.mode === 'detection' ? 'active' : ''}`}
                    aria-pressed={agatha.mode === 'detection'}
                    onClick={() => switchMode('detection')}
                  >
                    Detection
                  </button>
                  <button
                    type="button"
                    className={`settings-segmented-btn ${agatha.mode === 'deflection' ? 'active' : ''}`}
                    aria-pressed={agatha.mode === 'deflection'}
                    disabled={!deflectionAvailable}
                    onClick={() => switchMode('deflection')}
                  >
                    Deflection
                  </button>
                </div>
                {!deflectionAvailable && (
                  <span className="settings-field-info">Deflection requires a deflection build.</span>
                )}
              </div>
            )}

            {agatha.enabled && (
              <div className="settings-subgroup">
                <span className="settings-label">Scan Layer Configuration</span>
                <span className="settings-desc">
                  Control Agatha's detection layers: enable or disable the signatures layer (hash
                  database, byte-pattern matching, IOC reputation) and configure each file family
                  independently — toggle analysis layers and set the confidence threshold.
                </span>

                {loadState === 'loading' && (
                  <p className="settings-muted">Loading engine options…</p>
                )}
                {loadState === 'unavailable' && (
                  <p className="settings-warning">
                    ⚠ Agatha engine is offline — per-file-type options can’t be loaded. The engine
                    will use its built-in defaults when it comes back.
                  </p>
                )}
                {loadState === 'error' && (
                  <p className="settings-warning">
                    ⚠ Couldn’t reach the engine to load options. Defaults will be used.
                  </p>
                )}

                {loadState === 'ready' && (
                  <div className="settings-typecards">
                    {schema.map(renderGroup)}
                  </div>
                )}
              </div>
            )}

            {noEngine && (
              <p className="settings-warning">
                ⚠ No engine is enabled — file scans will have nothing to run. Enable at least one.
              </p>
            )}
          </section>
        </div>

        <div className="settings-footer">
          <button className="settings-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="settings-btn-save" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}
