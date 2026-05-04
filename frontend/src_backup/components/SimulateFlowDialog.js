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
exports.default = SimulateFlowDialog;
var react_1 = require("react");
var api_1 = require("../api");
var authStore_1 = require("../store/authStore");
function SimulateFlowDialog(_a) {
    var _this = this;
    var isOpen = _a.isOpen, onClose = _a.onClose, documentId = _a.documentId, classificationLevel = _a.classificationLevel, preselectedTemplateId = _a.preselectedTemplateId, onWorkflowStarted = _a.onWorkflowStarted;
    var user = (0, authStore_1.useAuthStore)(function (state) { return state.user; });
    var _b = (0, react_1.useState)([]), templates = _b[0], setTemplates = _b[1];
    var _c = (0, react_1.useState)(preselectedTemplateId || null), selectedTemplateId = _c[0], setSelectedTemplateId = _c[1];
    var _d = (0, react_1.useState)(null), simulation = _d[0], setSimulation = _d[1];
    var _e = (0, react_1.useState)(false), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(false), simulating = _f[0], setSimulating = _f[1];
    var _g = (0, react_1.useState)(false), starting = _g[0], setStarting = _g[1];
    var _h = (0, react_1.useState)(''), error = _h[0], setError = _h[1];
    var _j = (0, react_1.useState)(''), contextJson = _j[0], setContextJson = _j[1];
    (0, react_1.useEffect)(function () {
        if (isOpen) {
            loadTemplates();
            if (preselectedTemplateId) {
                setSelectedTemplateId(preselectedTemplateId);
                runSimulation(preselectedTemplateId);
            }
        }
    }, [isOpen, preselectedTemplateId]);
    var loadTemplates = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getWorkflowTemplates()];
                case 2:
                    response = _c.sent();
                    setTemplates(response.data);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load workflow templates');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var runSimulation = function (templateId) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!user)
                        return [2 /*return*/];
                    setSimulating(true);
                    setError('');
                    setSimulation(null);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.simulateWorkflow({
                            templateId: templateId,
                            userId: user.userId,
                            documentId: documentId,
                            classificationLevel: classificationLevel
                        })];
                case 2:
                    response = _c.sent();
                    setSimulation(response.data);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    setError(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to simulate workflow');
                    return [3 /*break*/, 5];
                case 4:
                    setSimulating(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleTemplateSelect = function (templateId) {
        setSelectedTemplateId(templateId);
        runSimulation(templateId);
    };
    var handleStartWorkflow = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!selectedTemplateId)
                        return [2 /*return*/];
                    setStarting(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.startWorkflow({
                            templateId: selectedTemplateId,
                            documentId: documentId,
                            contextJson: contextJson || undefined
                        })];
                case 2:
                    response = _c.sent();
                    if (onWorkflowStarted) {
                        onWorkflowStarted(response.data.id);
                    }
                    onClose();
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    setError(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to start workflow');
                    return [3 /*break*/, 5];
                case 4:
                    setStarting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (!isOpen)
        return null;
    return (<div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
      <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
        {/* Header */}
        <div style={{
            padding: '24px',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '24px', margin: 0 }}>Preview Workflow Approval Chain</h2>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            fontSize: '28px',
            cursor: 'pointer',
            color: '#666',
            padding: 0,
            width: '32px',
            height: '32px'
        }}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {error && (<div style={{
                background: '#ffebee',
                padding: '16px',
                borderRadius: '8px',
                color: '#c62828',
                marginBottom: '20px'
            }}>
              {error}
            </div>)}

          {/* Template Selection */}
          {!preselectedTemplateId && (<div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Select Workflow Template
              </label>
              <select value={selectedTemplateId || ''} onChange={function (e) { return handleTemplateSelect(parseInt(e.target.value)); }} disabled={loading || simulating} style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '14px'
            }}>
                <option value="">-- Select a template --</option>
                {templates.map(function (template) { return (<option key={template.id} value={template.id}>
                    {template.name} ({template.workflowType})
                  </option>); })}
              </select>
            </div>)}

          {/* Context JSON (Optional) */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              Additional Context (Optional JSON)
            </label>
            <textarea value={contextJson} onChange={function (e) { return setContextJson(e.target.value); }} placeholder='{"reason": "Urgent approval needed", "priority": "HIGH"}' style={{
            width: '100%',
            padding: '12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px',
            fontFamily: 'monospace',
            minHeight: '60px'
        }}/>
          </div>

          {/* Loading State */}
          {simulating && (<div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <div style={{ fontSize: '18px', marginBottom: '12px' }}>Simulating workflow...</div>
              <div style={{ fontSize: '14px' }}>Resolving approvers and calculating timeline</div>
            </div>)}

          {/* Simulation Results */}
          {simulation && !simulating && (<div>
              {/* Summary */}
              <div style={{
                background: '#f5f5f5',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px'
            }}>
                <h3 style={{ fontSize: '18px', marginTop: 0, marginBottom: '12px' }}>
                  {simulation.templateName}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Workflow Type</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{simulation.workflowType}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Total Steps</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>{simulation.totalSteps}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Estimated Duration</div>
                    <div style={{ fontSize: '16px', fontWeight: '600' }}>
                      {simulation.estimatedDurationDays} days
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {simulation.errors.length > 0 && (<div style={{
                    background: '#ffebee',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: '600', color: '#c62828', marginBottom: '8px' }}>
                    ⚠️ Validation Errors
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#c62828' }}>
                    {simulation.errors.map(function (err, idx) { return (<li key={idx} style={{ marginBottom: '4px' }}>{err}</li>); })}
                  </ul>
                </div>)}

              {/* Warnings */}
              {simulation.warnings.length > 0 && (<div style={{
                    background: '#fff3cd',
                    padding: '16px',
                    borderRadius: '8px',
                    marginBottom: '20px'
                }}>
                  <div style={{ fontWeight: '600', color: '#856404', marginBottom: '8px' }}>
                    ⚠️ Warnings
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#856404' }}>
                    {simulation.warnings.map(function (warn, idx) { return (<li key={idx} style={{ marginBottom: '4px' }}>{warn}</li>); })}
                  </ul>
                </div>)}

              {/* Approval Chain Steps */}
              {simulation.steps.length > 0 && (<div>
                  <h4 style={{ fontSize: '16px', marginBottom: '16px' }}>Approval Chain Preview</h4>

                  {simulation.steps.map(function (step, idx) { return (<div key={idx} style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '12px',
                        position: 'relative'
                    }}>
                      {/* Step Number Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        left: '16px',
                        background: '#2196f3',
                        color: 'white',
                        borderRadius: '12px',
                        padding: '4px 12px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                    }}>
                        Step {step.stepNumber}
                      </div>

                      {/* Step Header */}
                      <div style={{ marginTop: '8px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '16px', fontWeight: '600' }}>{step.stepName}</span>
                          {step.required && (<span style={{
                            background: '#f44336',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}>
                              REQUIRED
                            </span>)}
                          {step.parallel && (<span style={{
                            background: '#ff9800',
                            color: 'white',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                        }}>
                              PARALLEL
                            </span>)}
                        </div>
                        <div style={{ fontSize: '14px', color: '#666' }}>{step.description}</div>
                      </div>

                      {/* Approver Info */}
                      <div style={{
                        background: '#f9f9f9',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '12px'
                    }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                          Approver Rule: <strong>{step.approverType}</strong> ({step.approverValue})
                        </div>

                        {step.approverNames.length > 0 ? (<div>
                            <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                              Resolved Approvers:
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {step.approverNames.map(function (name, nameIdx) { return (<span key={nameIdx} style={{
                                background: '#4caf50',
                                color: 'white',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '12px'
                            }}>
                                  {name}
                                </span>); })}
                            </div>
                          </div>) : (<div style={{ color: '#f44336', fontSize: '13px' }}>
                            ⚠️ No approvers found for this rule
                          </div>)}
                      </div>

                      {/* Timeout */}
                      <div style={{ fontSize: '13px', color: '#666' }}>
                        ⏱️ Timeout: <strong>{step.timeoutDays} days</strong>
                      </div>

                      {/* Step Warnings */}
                      {step.stepWarnings.length > 0 && (<div style={{
                            marginTop: '12px',
                            padding: '10px',
                            background: '#fff3cd',
                            borderRadius: '6px'
                        }}>
                          <div style={{ fontSize: '12px', color: '#856404', marginBottom: '4px' }}>
                            Step Warnings:
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#856404' }}>
                            {step.stepWarnings.map(function (warn, warnIdx) { return (<li key={warnIdx}>{warn}</li>); })}
                          </ul>
                        </div>)}

                      {/* Connector Arrow */}
                      {idx < simulation.steps.length - 1 && (<div style={{
                            textAlign: 'center',
                            color: '#2196f3',
                            fontSize: '24px',
                            margin: '8px 0 -20px 0'
                        }}>
                          {step.parallel ? '⇊' : '↓'}
                        </div>)}
                    </div>); })}
                </div>)}

              {/* Empty State */}
              {simulation.steps.length === 0 && simulation.errors.length === 0 && (<div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#666',
                    background: '#f5f5f5',
                    borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '18px', marginBottom: '8px' }}>No workflow steps configured</div>
                  <div style={{ fontSize: '14px' }}>This template needs to be configured before use.</div>
                </div>)}
            </div>)}
        </div>

        {/* Footer Actions */}
        <div style={{
            padding: '20px 24px',
            borderTop: '1px solid #e0e0e0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
        }}>
          <button onClick={onClose} disabled={starting} style={{
            padding: '10px 24px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            background: 'white',
            cursor: starting ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500'
        }}>
            Cancel
          </button>

          {simulation && (<button onClick={handleStartWorkflow} disabled={!simulation.valid || simulation.errors.length > 0 || starting || !selectedTemplateId} style={{
                padding: '10px 24px',
                border: 'none',
                borderRadius: '6px',
                background: simulation.valid && simulation.errors.length === 0 && !starting
                    ? '#4caf50'
                    : '#ccc',
                color: 'white',
                cursor: simulation.valid && simulation.errors.length === 0 && !starting
                    ? 'pointer'
                    : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500'
            }}>
              {starting ? 'Starting Workflow...' : 'Start Workflow'}
            </button>)}
        </div>
      </div>
    </div>);
}
