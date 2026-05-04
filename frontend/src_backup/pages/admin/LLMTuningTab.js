"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LLMTuningTab;
var react_1 = require("react");
var api_1 = require("../../api");
var authStore_1 = require("../../store/authStore");
function LLMTuningTab() {
    var _this = this;
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    var theme = (0, authStore_1.useAuthStore)().theme;
    var _k = (0, react_1.useState)(null), status = _k[0], setStatus = _k[1];
    var _l = (0, react_1.useState)([]), samples = _l[0], setSamples = _l[1];
    var _m = (0, react_1.useState)(true), loading = _m[0], setLoading = _m[1];
    var _o = (0, react_1.useState)(false), triggering = _o[0], setTriggering = _o[1];
    var _p = (0, react_1.useState)(false), samplesLoading = _p[0], setSamplesLoading = _p[1];
    var _q = (0, react_1.useState)(false), clearing = _q[0], setClearing = _q[1];
    var _r = (0, react_1.useState)(false), toggling = _r[0], setToggling = _r[1];
    var _s = (0, react_1.useState)(''), minExamplesInput = _s[0], setMinExamplesInput = _s[1];
    var _t = (0, react_1.useState)(false), settingMin = _t[0], setSettingMin = _t[1];
    var _u = (0, react_1.useState)(''), error = _u[0], setError = _u[1];
    var fileInputRef = (0, react_1.useRef)(null);
    var _v = (0, react_1.useState)(false), importing = _v[0], setImporting = _v[1];
    var loadStatus = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getClassificationTuningStatus()];
                case 2:
                    res = _c.sent();
                    setStatus(res.data || null);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load LLM tuning status');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        loadStatus();
        loadSamples();
    }, []);
    var loadSamples = function () { return __awaiter(_this, void 0, void 0, function () {
        var res, err_2;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setSamplesLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getClassificationTuningSamples(100)];
                case 2:
                    res = _d.sent();
                    setSamples((((_a = res.data) === null || _a === void 0 ? void 0 : _a.items) || []));
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _d.sent();
                    setError(((_c = (_b = err_2.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load tuning samples');
                    return [3 /*break*/, 5];
                case 4:
                    setSamplesLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleAutoTrigger = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setTriggering(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, api_1.apiClient.triggerClassificationAutoTuning()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadStatus()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, loadSamples()];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to trigger auto tuning');
                    return [3 /*break*/, 7];
                case 6:
                    setTriggering(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleClearSamples = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!window.confirm('Clear all LLM tuning samples? This cannot be undone.'))
                        return [2 /*return*/];
                    setClearing(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, api_1.apiClient.clearClassificationTuningSamples()];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadStatus()];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, loadSamples()];
                case 4:
                    _c.sent();
                    return [3 /*break*/, 7];
                case 5:
                    err_4 = _c.sent();
                    setError(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to clear tuning samples');
                    return [3 /*break*/, 7];
                case 6:
                    setClearing(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var handleToggleAutoTuning = function () { return __awaiter(_this, void 0, void 0, function () {
        var next, err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    next = !(status === null || status === void 0 ? void 0 : status.autoTuningEnabled);
                    if (!window.confirm("Disable LLM auto-tuning?".concat(next ? '' : ' Re-enable will resume scheduled triggers.')))
                        return [2 /*return*/];
                    setToggling(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.setClassificationTuningAutoToggle(next)];
                case 2:
                    _c.sent();
                    return [4 /*yield*/, loadStatus()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_5 = _c.sent();
                    setError(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to toggle auto-tuning');
                    return [3 /*break*/, 6];
                case 5:
                    setToggling(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleSetMinExamples = function () { return __awaiter(_this, void 0, void 0, function () {
        var val, err_6;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    val = parseInt(minExamplesInput, 10);
                    if (isNaN(val) || val < 100) {
                        alert('Minimum examples must be at least 100');
                        return [2 /*return*/];
                    }
                    setSettingMin(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.setClassificationMinExamples(val)];
                case 2:
                    _c.sent();
                    setMinExamplesInput('');
                    return [4 /*yield*/, loadStatus()];
                case 3:
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_6 = _c.sent();
                    setError(((_b = (_a = err_6.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to set min examples');
                    return [3 /*break*/, 6];
                case 5:
                    setSettingMin(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var handleImportExamples = function (event) { return __awaiter(_this, void 0, void 0, function () {
        var file, err_7;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    file = (_a = event.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (!file)
                        return [2 /*return*/];
                    setImporting(true);
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, ((_b = api_1.apiClient.importClassificationTuningExamples) === null || _b === void 0 ? void 0 : _b.call(api_1.apiClient, file))];
                case 2:
                    _e.sent();
                    return [4 /*yield*/, loadStatus()];
                case 3:
                    _e.sent();
                    return [4 /*yield*/, loadSamples()];
                case 4:
                    _e.sent();
                    if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                    }
                    return [3 /*break*/, 7];
                case 5:
                    err_7 = _e.sent();
                    setError(((_d = (_c = err_7.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to import tuning examples');
                    return [3 /*break*/, 7];
                case 6:
                    setImporting(false);
                    return [7 /*endfinally*/];
                case 7: return [2 /*return*/];
            }
        });
    }); };
    var renderLastResult = function () {
        var _a, _b;
        if (!(status === null || status === void 0 ? void 0 : status.lastAutoTrigger)) {
            return <div style={{ color: '#888' }}>No trigger attempt yet.</div>;
        }
        var last = status.lastAutoTrigger;
        return (<div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
        <div><strong>Triggered:</strong> {String((_b = (_a = last.triggered) !== null && _a !== void 0 ? _a : last.state) !== null && _b !== void 0 ? _b : 'N/A')}</div>
        {last.reason && <div><strong>Reason:</strong> {String(last.reason)}</div>}
        {last.gcsUri && <div><strong>Dataset URI:</strong> {String(last.gcsUri)}</div>}
        {last.trainDatasetUri && <div><strong>Train Dataset:</strong> {String(last.trainDatasetUri)}</div>}
        {last.validationDatasetUri && <div><strong>Validation Dataset:</strong> {String(last.validationDatasetUri)}</div>}
        {last.trainCount && <div><strong>Train Count:</strong> {String(last.trainCount)}</div>}
        {last.validationCount && <div><strong>Validation Count:</strong> {String(last.validationCount)}</div>}
        {last.tuningJobResourceName && <div><strong>Tuning Job:</strong> {String(last.tuningJobResourceName)}</div>}
        {last.state && <div><strong>State:</strong> {String(last.state)}</div>}
        {last.jobId && <div><strong>Job ID:</strong> {String(last.jobId)}</div>}
        {last.error && <div style={{ color: '#dc3545' }}><strong>Error:</strong> {String(last.error)}</div>}
      </div>);
    };
    var cardStyle = {
        background: theme === 'dark' ? '#1e1e1e' : '#fff',
        border: "1px solid ".concat(theme === 'dark' ? '#333' : '#e0e0e0'),
        borderRadius: '8px',
        padding: '20px',
    };
    var readyToTune = ((_a = status === null || status === void 0 ? void 0 : status.exampleCount) !== null && _a !== void 0 ? _a : 0) >= ((_b = status === null || status === void 0 ? void 0 : status.minExamples) !== null && _b !== void 0 ? _b : 100);
    if (loading) {
        return <h3>Loading LLM tuning status...</h3>;
    }
    return (<div style={{ display: 'grid', gap: '20px' }}>
      {error && (<div style={{
                padding: '12px 16px',
                background: '#dc3545',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '14px'
            }}>
          {error}
        </div>)}

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0, marginBottom: '8px' }}>LLM Auto Tuning</h2>
        <p style={{ color: '#666', marginTop: 0, marginBottom: '16px' }}>
          View current sample count and trigger the auto flow manually.
        </p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
        }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Samples Collected</div>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{(_c = status === null || status === void 0 ? void 0 : status.exampleCount) !== null && _c !== void 0 ? _c : 0}</div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '220px'
        }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>Minimum Required</div>
            <div style={{ fontSize: '20px', fontWeight: 700, marginBottom: '6px' }}>{(_d = status === null || status === void 0 ? void 0 : status.minExamples) !== null && _d !== void 0 ? _d : 100}</div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <input type="number" min={100} placeholder={"Min 100"} value={minExamplesInput} onChange={function (e) { return setMinExamplesInput(e.target.value); }} onKeyDown={function (e) { return e.key === 'Enter' && handleSetMinExamples(); }} style={{
            padding: '4px 6px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#555' : '#ccc'),
            background: theme === 'dark' ? '#1a1a1a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000',
            fontSize: '12px',
            width: '90px'
        }}/>
              <button onClick={handleSetMinExamples} disabled={settingMin || !minExamplesInput} style={{
            padding: '4px 8px',
            borderRadius: '4px',
            border: 'none',
            background: settingMin || !minExamplesInput ? '#888' : '#1976d2',
            color: '#fff',
            cursor: settingMin || !minExamplesInput ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 600
        }}>
                {settingMin ? '...' : 'Set'}
              </button>
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
        }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Ready</div>
            <div style={{
            fontSize: '24px',
            fontWeight: 700,
            color: readyToTune ? '#28a745' : '#ffa500'
        }}>
              {readyToTune ? 'YES' : 'NO'}
            </div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
        }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Current Version</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{(_e = status === null || status === void 0 ? void 0 : status.currentVersion) !== null && _e !== void 0 ? _e : 'v0'}</div>
          </div>

          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: theme === 'dark' ? '#2a2a2a' : '#f8f9fa',
            minWidth: '160px'
        }}>
            <div style={{ fontSize: '12px', color: '#888' }}>Next Version</div>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{(_f = status === null || status === void 0 ? void 0 : status.nextVersion) !== null && _f !== void 0 ? _f : 'v1'}</div>
          </div>
        </div>

        <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            padding: '12px',
            background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px'
        }}>
          <div><strong>Base Model:</strong> {(_g = status === null || status === void 0 ? void 0 : status.baseModel) !== null && _g !== void 0 ? _g : 'gemini-2.5-flash'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>GCS Configured:</strong> {(status === null || status === void 0 ? void 0 : status.gcsConfigured) ? 'Yes' : 'No'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>Continual Training:</strong> {(status === null || status === void 0 ? void 0 : status.continualTraining) ? 'Enabled' : 'Disabled'}</div>
          <div style={{ color: '#888' }}>|</div>
          <div><strong>Naming:</strong> LLM_Classification_v*</div>
          <div style={{ color: '#888' }}>|</div>
          <div style={{
            color: (status === null || status === void 0 ? void 0 : status.autoTuningEnabled) ? '#2e7d32' : '#c62828',
            fontWeight: 700
        }}>
            <strong>Auto Tuning:</strong> {(status === null || status === void 0 ? void 0 : status.autoTuningEnabled) ? 'ON' : 'OFF'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={handleToggleAutoTuning} disabled={toggling} style={{
            padding: '10px 20px',
            background: toggling ? '#ccc' : ((status === null || status === void 0 ? void 0 : status.autoTuningEnabled) ? '#c62828' : '#2e7d32'),
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: toggling ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600,
        }}>
            {toggling ? '...' : (status === null || status === void 0 ? void 0 : status.autoTuningEnabled) ? 'Disable Auto Tuning' : 'Enable Auto Tuning'}
          </button>
          <button onClick={handleAutoTrigger} disabled={triggering || !(status === null || status === void 0 ? void 0 : status.gcsConfigured)} style={{
            padding: '10px 20px',
            background: triggering ? '#ccc' : (!readyToTune ? '#ffa500' : '#28a745'),
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: triggering ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 600
        }}>
            {triggering ? 'Triggering...' : 'Trigger Auto Tuning Now'}
          </button>
          <button onClick={loadStatus} disabled={triggering} style={{
            padding: '10px 20px',
            background: theme === 'dark' ? '#333' : '#e0e0e0',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
        }}>
            Refresh
          </button>
        </div>

        <h3 style={{ marginBottom: '8px' }}>Last Auto Trigger Result</h3>
        {renderLastResult()}
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Collected Samples</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input ref={fileInputRef} type="file" accept=".jsonl" onChange={handleImportExamples} style={{ display: 'none' }} id="classification-tuning-file"/>
            <label htmlFor="classification-tuning-file" style={{
            padding: '8px 16px',
            background: importing ? '#ccc' : '#1976d2',
            color: '#fff',
            borderRadius: '6px',
            cursor: importing ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            display: 'inline-block'
        }}>
              {importing ? 'Importing...' : 'Import JSONL'}
            </label>
            <button onClick={loadSamples} disabled={samplesLoading || clearing} style={{
            padding: '8px 16px',
            background: theme === 'dark' ? '#333' : '#e0e0e0',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px'
        }}>
              {samplesLoading ? 'Loading...' : 'Refresh'}
            </button>
            <button onClick={handleClearSamples} disabled={clearing || samplesLoading || ((_h = status === null || status === void 0 ? void 0 : status.exampleCount) !== null && _h !== void 0 ? _h : 0) === 0} style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 12px', cursor: (clearing || samplesLoading || ((_j = status === null || status === void 0 ? void 0 : status.exampleCount) !== null && _j !== void 0 ? _j : 0) === 0) ? 'not-allowed' : 'pointer' }}>
              {clearing ? 'Clearing...' : 'Clear Samples'}
            </button>
          </div>
        </div>

        <p style={{ fontSize: '13px', color: '#666', marginTop: 0 }}>
          Import classification tuning examples in Vertex AI JSONL format. Each line should contain system instruction and conversation.
        </p>

        {samplesLoading ? (<div style={{ color: '#888' }}>Loading samples...</div>) : samples.length === 0 ? (<div style={{ color: '#888' }}>No samples collected.</div>) : (<div style={{ overflowX: 'auto', maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead style={{ position: 'sticky', top: 0, background: theme === 'dark' ? '#2a2a2a' : '#f5f5f5' }}>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px' }}>ID</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Document</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Upload Job</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Suggested</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Correct</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
                </tr>
              </thead>
              <tbody>
                {samples.map(function (s) { return (<tr key={s.id} style={{ borderBottom: "1px solid ".concat(theme === 'dark' ? '#333' : '#eee') }}>
                    <td style={{ padding: '8px' }}>{s.id}</td>
                    <td style={{ padding: '8px' }}>{s.documentId}</td>
                    <td style={{ padding: '8px' }}>{s.uploadJobId}</td>
                    <td style={{ padding: '8px' }}>{s.suggestedLevel}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{s.correctLevel}</td>
                    <td style={{ padding: '8px' }}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                  </tr>); })}
              </tbody>
            </table>
          </div>)}
      </div>
    </div>);
}
