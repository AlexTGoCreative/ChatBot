import { useState, useEffect } from 'react';
import axios from 'axios';
import './Settings.css';

const API_URL = import.meta.env.VITE_API2_URL;

export const DEFAULT_ARGUS_SETTINGS = {
  enabled: true,
  preferences: null,
};

// The two analysis-layer toggles that the "at least one layer" rule applies to.
// A non-image file type must keep at least one of these enabled.
const LAYER_FIELDS = ['reputation_enabled', 'ml_enabled'];

export default function Settings({ argusSettings, multiscanningEnabled, onSave, onClose }) {
  const [multi, setMulti] = useState(!!multiscanningEnabled);
  const [argus, setArgus] = useState({ ...DEFAULT_ARGUS_SETTINGS, ...(argusSettings || {}) });

  // Schema fetched from the engine (one feature group per file-type family).
  const [schema, setSchema] = useState([]);
  const [values, setValues] = useState({});
  // idle | loading | ready | unavailable | error
  const [loadState, setLoadState] = useState('idle');

  // Fetch the engine's workflow schema on mount.
  useEffect(() => {
    let cancelled = false;
    const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };
    (async () => {
      setLoadState('loading');
      try {
        const res = await axios.get(`${API_URL}/agatha-workflow-info`, authHeaders);
        if (cancelled) return;
        if (!res.data?.available) {
          setLoadState('unavailable');
          return;
        }
        const groups = res.data.schema?.schema || [];
        const defaults = res.data.default_values || {};
        const overlay = argusSettings?.preferences ?? null;
        setSchema(groups);
        setValues({ ...defaults, ...(overlay || {}) });
        setLoadState('ready');
      } catch (e) {
        if (!cancelled) setLoadState('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setValue = (key, val) => setValues((v) => ({ ...v, [key]: val }));

  const handleSave = () => {
    const preferences = loadState === 'ready' && Object.keys(values).length > 0 ? values : null;
    onSave({ multiscanningEnabled: multi, argusSettings: { ...argus, preferences } });
    onClose();
  };

  const noEngine = !multi && !argus.enabled;

  // Toggle an analysis layer while enforcing "at least one layer stays on".
  const toggleLayer = (groupId, fieldId, present) => {
    const key = `${groupId}.${fieldId}`;
    const current = values[key];
    if (current) {
      const others = present.filter((f) => f !== fieldId);
      const anyOtherOn = others.some((f) => values[`${groupId}.${f}`]);
      if (!anyOtherOn) return;
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
                <span className="settings-label">Argus AI Engine</span>
                <span className="settings-desc">
                  Run the Argus antivirus engine alongside multiscanning for a fast,
                  AI-powered second opinion — malware detection for files.
                </span>
              </div>
              <label className="settings-switch">
                <input
                  type="checkbox"
                  checked={argus.enabled}
                  onChange={() => setArgus((a) => ({ ...a, enabled: !a.enabled }))}
                />
                <span className="settings-slider"></span>
              </label>
            </div>

            {argus.enabled && (
              <div className="settings-subgroup">
                <span className="settings-label">Scan Layer Configuration</span>
                <span className="settings-desc">
                  Control Argus's detection layers: enable or disable the signatures layer (hash
                  database, byte-pattern matching, IOC reputation) and configure each file family
                  independently — toggle analysis layers and set the confidence threshold.
                </span>

                {loadState === 'loading' && (
                  <p className="settings-muted">Loading engine options…</p>
                )}
                {loadState === 'unavailable' && (
                  <p className="settings-warning">
                    ⚠ Argus engine is offline — per-file-type options can't be loaded. The engine
                    will use its built-in defaults when it comes back.
                  </p>
                )}
                {loadState === 'error' && (
                  <p className="settings-warning">
                    ⚠ Couldn't reach the engine to load options. Defaults will be used.
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
