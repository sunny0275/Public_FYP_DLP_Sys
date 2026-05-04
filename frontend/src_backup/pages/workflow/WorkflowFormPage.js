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
exports.default = WorkflowFormPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var SimulateFlowDialog_1 = require("../../components/SimulateFlowDialog");
require("../../modal.css");
function WorkflowFormPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)('start'), activeTab = _a[0], setActiveTab = _a[1];
    var _b = (0, react_1.useState)([]), templates = _b[0], setTemplates = _b[1];
    var _c = (0, react_1.useState)([]), myWorkflows = _c[0], setMyWorkflows = _c[1];
    var _d = (0, react_1.useState)(true), loading = _d[0], setLoading = _d[1];
    var _e = (0, react_1.useState)(''), error = _e[0], setError = _e[1];
    // Start workflow form
    var _f = (0, react_1.useState)(null), selectedTemplate = _f[0], setSelectedTemplate = _f[1];
    var _g = (0, react_1.useState)(''), documentId = _g[0], setDocumentId = _g[1];
    var _h = (0, react_1.useState)(''), shareId = _h[0], setShareId = _h[1];
    var _j = (0, react_1.useState)(''), reason = _j[0], setReason = _j[1];
    var _k = (0, react_1.useState)(false), submitting = _k[0], setSubmitting = _k[1];
    var _l = (0, react_1.useState)(false), success = _l[0], setSuccess = _l[1];
    var _m = (0, react_1.useState)(null), createdWorkflowId = _m[0], setCreatedWorkflowId = _m[1];
    // Workflow list pagination
    var _o = (0, react_1.useState)(0), page = _o[0], setPage = _o[1];
    var _p = (0, react_1.useState)(0), totalPages = _p[0], setTotalPages = _p[1];
    // Workflow details modal
    var _q = (0, react_1.useState)(null), selectedWorkflow = _q[0], setSelectedWorkflow = _q[1];
    var _r = (0, react_1.useState)(false), showWorkflowDetails = _r[0], setShowWorkflowDetails = _r[1];
    // Simulate workflow dialog
    var _s = (0, react_1.useState)(false), showSimulateDialog = _s[0], setShowSimulateDialog = _s[1];
    (0, react_1.useEffect)(function () {
        if (activeTab === 'start') {
            loadTemplates();
        }
        else {
            loadMyWorkflows();
        }
    }, [activeTab, page]);
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
                    setTemplates(response.data || []);
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
    var loadMyWorkflows = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_2;
        var _a, _b, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getUserWorkflows(page, 20)];
                case 2:
                    response = _e.sent();
                    setMyWorkflows(((_a = response.data) === null || _a === void 0 ? void 0 : _a.content) || []);
                    setTotalPages(((_b = response.data) === null || _b === void 0 ? void 0 : _b.totalPages) || 1);
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _e.sent();
                    setError(((_d = (_c = err_2.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || 'Failed to load workflows');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleStartWorkflow = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var workflowData, response, err_3;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    e.preventDefault();
                    if (!selectedTemplate) {
                        alert('Please select a workflow template');
                        return [2 /*return*/];
                    }
                    setSubmitting(true);
                    setError('');
                    setSuccess(false);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    workflowData = {
                        templateId: selectedTemplate.id,
                        reason: reason.trim() || undefined
                    };
                    if (documentId.trim()) {
                        workflowData.documentId = Number(documentId);
                    }
                    if (shareId.trim()) {
                        workflowData.shareId = Number(shareId);
                    }
                    return [4 /*yield*/, api_1.apiClient.startWorkflow(workflowData)];
                case 2:
                    response = _d.sent();
                    setSuccess(true);
                    setCreatedWorkflowId(((_a = response.data) === null || _a === void 0 ? void 0 : _a.id) || null);
                    // Reset form
                    setSelectedTemplate(null);
                    setDocumentId('');
                    setShareId('');
                    setReason('');
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _d.sent();
                    setError(((_c = (_b = err_3.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to start workflow');
                    return [3 /*break*/, 5];
                case 4:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleViewWorkflow = function (workflow) { return __awaiter(_this, void 0, void 0, function () {
        var response, err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, api_1.apiClient.getWorkflowInstance(workflow.id)];
                case 1:
                    response = _c.sent();
                    setSelectedWorkflow(response.data);
                    setShowWorkflowDetails(true);
                    return [3 /*break*/, 3];
                case 2:
                    err_4 = _c.sent();
                    alert(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load workflow details');
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleCancelWorkflow = function (workflowId) { return __awaiter(_this, void 0, void 0, function () {
        var reason, err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    reason = prompt('Enter reason for cancellation:');
                    if (!reason)
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.cancelWorkflow(workflowId, reason)];
                case 2:
                    _c.sent();
                    loadMyWorkflows();
                    return [3 /*break*/, 4];
                case 3:
                    err_5 = _c.sent();
                    alert(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to cancel workflow');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var getStatusColor = function (status) {
        switch (status) {
            case 'PENDING': return '#2196f3';
            case 'IN_PROGRESS': return '#ff9800';
            case 'COMPLETED': return '#4caf50';
            case 'CANCELLED': return '#f44336';
            case 'REJECTED': return '#f44336';
            default: return '#888';
        }
    };
    var getDecisionColor = function (decision) {
        if (!decision)
            return '#888';
        switch (decision) {
            case 'APPROVED': return '#4caf50';
            case 'REJECTED': return '#f44336';
            default: return '#888';
        }
    };
    if (loading && (templates.length === 0 && myWorkflows.length === 0)) {
        return (<DashboardLayout_1.default>
        <div className="dashboard">
          <h2>Workflow Management</h2>
          <p>Loading...</p>
        </div>
      </DashboardLayout_1.default>);
    }
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <div style={{ marginBottom: '24px' }}>
          <h1>Workflow Management</h1>
          <p style={{ color: '#666', marginTop: '8px' }}>Start new workflows and track existing ones</p>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '2px solid #e0e0e0' }}>
          <button onClick={function () { return setActiveTab('start'); }} style={{
            padding: '12px 24px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: activeTab === 'start' ? '3px solid #007bff' : 'none',
            fontWeight: activeTab === 'start' ? 'bold' : 'normal',
            fontSize: '1em'
        }}>
            Start Workflow
          </button>
          <button onClick={function () { return setActiveTab('my-workflows'); }} style={{
            padding: '12px 24px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: activeTab === 'my-workflows' ? '3px solid #007bff' : 'none',
            fontWeight: activeTab === 'my-workflows' ? 'bold' : 'normal',
            fontSize: '1em'
        }}>
            My Workflows
          </button>
        </div>

        {error && (<div className="error-message" style={{ marginBottom: '20px' }}>{error}</div>)}

        {success && (<div className="success-message" style={{ marginBottom: '20px' }}>
            Workflow started successfully!
            {createdWorkflowId && (<button onClick={function () {
                    setActiveTab('my-workflows');
                    setSuccess(false);
                }} style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '0.9em' }}>
                View My Workflows
              </button>)}
          </div>)}

        {/* Start Workflow Tab */}
        {activeTab === 'start' && (<div>
            <div className="dashboard-card" style={{ marginBottom: '24px' }}>
              <h3 style={{ marginBottom: '16px' }}>Select a Workflow Template</h3>

              {templates.length === 0 ? (<div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  <p>No workflow templates available</p>
                  <p style={{ fontSize: '0.9em', marginTop: '8px' }}>Contact an administrator to create workflow templates</p>
                </div>) : (<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {templates.map(function (template) { return (<div key={template.id} onClick={function () { return setSelectedTemplate(template); }} style={{
                        padding: '16px',
                        border: (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.id) === template.id ? '2px solid #007bff' : '1px solid #e0e0e0',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        background: (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.id) === template.id ? '#f0f8ff' : undefined
                    }}>
                      <h4 style={{ marginBottom: '8px' }}>{template.name}</h4>
                      <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '12px' }}>
                        {template.description}
                      </p>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.8em' }}>
                        <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        background: '#007bff22',
                        color: '#007bff'
                    }}>
                          {template.workflowType}
                        </span>
                        <span style={{
                        padding: '4px 8px',
                        borderRadius: '12px',
                        background: '#4caf5022',
                        color: '#4caf50'
                    }}>
                          v{template.version}
                        </span>
                      </div>
                    </div>); })}
                </div>)}
            </div>

            {selectedTemplate && (<div className="dashboard-card">
                <h3 style={{ marginBottom: '16px' }}>Start Workflow: {selectedTemplate.name}</h3>

                <form onSubmit={handleStartWorkflow}>
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Workflow Type
                    </label>
                    <input type="text" value={selectedTemplate.workflowType} readOnly style={{ width: '100%', padding: '8px', background: '#f0f0f0' }}/>
                  </div>

                  {selectedTemplate.workflowType === 'DOCUMENT_APPROVAL' && (<div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        Document ID (Optional)
                      </label>
                      <input type="number" value={documentId} onChange={function (e) { return setDocumentId(e.target.value); }} placeholder="Enter document ID if applicable" style={{ width: '100%', padding: '8px' }}/>
                      <small style={{ color: '#666' }}>Leave empty if not related to a specific document</small>
                    </div>)}

                  {selectedTemplate.workflowType === 'SHARE_APPROVAL' && (<div style={{ marginBottom: '20px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                        Share ID (Optional)
                      </label>
                      <input type="number" value={shareId} onChange={function (e) { return setShareId(e.target.value); }} placeholder="Enter share link ID if applicable" style={{ width: '100%', padding: '8px' }}/>
                      <small style={{ color: '#666' }}>Leave empty if not related to a specific share</small>
                    </div>)}

                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                      Reason / Description
                    </label>
                    <textarea value={reason} onChange={function (e) { return setReason(e.target.value); }} placeholder="Explain why you are starting this workflow..." style={{ width: '100%', padding: '10px', minHeight: '100px' }}/>
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button type="button" onClick={function () {
                    setSelectedTemplate(null);
                    setDocumentId('');
                    setShareId('');
                    setReason('');
                }} style={{ padding: '10px 20px', background: '#6c757d' }}>
                      Cancel
                    </button>
                    <button type="button" onClick={function () { return setShowSimulateDialog(true); }} style={{ padding: '10px 20px', background: '#ff9800', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Preview Approval Chain
                    </button>
                    <button type="submit" disabled={submitting} style={{ padding: '10px 20px', background: '#007bff' }}>
                      {submitting ? 'Starting...' : 'Start Workflow'}
                    </button>
                  </div>
                </form>
              </div>)}
          </div>)}

        {/* My Workflows Tab */}
        {activeTab === 'my-workflows' && (<div>
            {myWorkflows.length === 0 ? (<div className="dashboard-card" style={{ textAlign: 'center', padding: '60px 20px', color: '#666' }}>
                <h3>No workflows found</h3>
                <p>You haven't started any workflows yet.</p>
                <button onClick={function () { return setActiveTab('start'); }} style={{ marginTop: '16px', padding: '10px 20px', background: '#007bff' }}>
                  Start a Workflow
                </button>
              </div>) : (<div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myWorkflows.map(function (workflow) { return (<div key={workflow.id} className="dashboard-card" style={{ padding: '20px', cursor: 'pointer' }} onClick={function () { return handleViewWorkflow(workflow); }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ marginBottom: '8px' }}>{workflow.templateName}</h3>
                        <p style={{ color: '#666', fontSize: '0.9em', marginBottom: '12px' }}>
                          {workflow.reason || 'No reason provided'}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                        <span style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '0.8em',
                        fontWeight: '600',
                        background: getStatusColor(workflow.status) + '22',
                        color: getStatusColor(workflow.status)
                    }}>
                          {workflow.status}
                        </span>
                        {workflow.decision && (<span style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8em',
                            fontWeight: '600',
                            background: getDecisionColor(workflow.decision) + '22',
                            color: getDecisionColor(workflow.decision)
                        }}>
                            {workflow.decision}
                          </span>)}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '20px', fontSize: '0.85em', color: '#666', marginBottom: '16px' }}>
                      <div>
                        <strong>Progress:</strong> Step {workflow.currentStep} of {workflow.totalSteps}
                      </div>
                      {workflow.documentName && (<div>
                          <strong>Document:</strong> {workflow.documentName}
                        </div>)}
                      <div>
                        <strong>Started:</strong> {new Date(workflow.startedAt).toLocaleDateString()}
                      </div>
                    </div>

                    {workflow.status === 'PENDING' || workflow.status === 'IN_PROGRESS' && (<div onClick={function (e) { return e.stopPropagation(); }}>
                        <button onClick={function () { return handleCancelWorkflow(workflow.id); }} style={{ padding: '6px 12px', background: '#f44336', fontSize: '0.9em' }}>
                          Cancel Workflow
                        </button>
                      </div>)}
                  </div>); })}
              </div>)}

            {/* Pagination */}
            {totalPages > 1 && (<div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '24px' }}>
                <button onClick={function () { return setPage(function (p) { return Math.max(0, p - 1); }); }} disabled={page === 0} style={{ padding: '8px 16px' }}>
                  Previous
                </button>
                <span style={{ padding: '8px 16px', background: '#f0f0f0', borderRadius: '4px' }}>
                  Page {page + 1} of {totalPages}
                </span>
                <button onClick={function () { return setPage(function (p) { return Math.min(totalPages - 1, p + 1); }); }} disabled={page >= totalPages - 1} style={{ padding: '8px 16px' }}>
                  Next
                </button>
              </div>)}
          </div>)}
      </div>

      {/* Workflow Details Modal */}
      {showWorkflowDetails && selectedWorkflow && (<div className="modal-overlay" onClick={function () { return setShowWorkflowDetails(false); }}>
          <div className="modal-content" onClick={function (e) { return e.stopPropagation(); }}>
            <div className="modal-header">
              <h2>Workflow Details</h2>
              <button className="modal-close" onClick={function () { return setShowWorkflowDetails(false); }}>&times;</button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '8px' }}>{selectedWorkflow.templateName}</h3>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <span style={{
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.85em',
                fontWeight: '600',
                background: getStatusColor(selectedWorkflow.status) + '22',
                color: getStatusColor(selectedWorkflow.status)
            }}>
                    {selectedWorkflow.status}
                  </span>
                  {selectedWorkflow.decision && (<span style={{
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '0.85em',
                    fontWeight: '600',
                    background: getDecisionColor(selectedWorkflow.decision) + '22',
                    color: getDecisionColor(selectedWorkflow.decision)
                }}>
                      {selectedWorkflow.decision}
                    </span>)}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Reason</div>
                  <div>{selectedWorkflow.reason || 'No reason provided'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Progress</div>
                  <div>
                    Step {selectedWorkflow.currentStep} of {selectedWorkflow.totalSteps}
                    <div style={{
                marginTop: '8px',
                height: '8px',
                background: '#e0e0e0',
                borderRadius: '4px',
                overflow: 'hidden'
            }}>
                      <div style={{
                height: '100%',
                width: "".concat((selectedWorkflow.currentStep / selectedWorkflow.totalSteps) * 100, "%"),
                background: '#007bff',
                transition: 'width 0.3s'
            }}/>
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Applicant</div>
                  <div>{selectedWorkflow.applicantName}</div>
                </div>

                {selectedWorkflow.documentName && (<div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Related Document</div>
                    <div>
                      {selectedWorkflow.documentName}
                      {selectedWorkflow.documentId && (<button onClick={function () { return navigate("/documents/".concat(selectedWorkflow.documentId)); }} style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '0.85em' }}>
                          View
                        </button>)}
                    </div>
                  </div>)}

                <div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Started At</div>
                  <div>{new Date(selectedWorkflow.startedAt).toLocaleString()}</div>
                </div>

                {selectedWorkflow.completedAt && (<div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>Completed At</div>
                    <div>{new Date(selectedWorkflow.completedAt).toLocaleString()}</div>
                  </div>)}
              </div>
            </div>

            <div className="modal-footer">
              <button onClick={function () { return setShowWorkflowDetails(false); }} style={{ padding: '10px 20px', background: '#6c757d' }}>
                Close
              </button>
            </div>
          </div>
        </div>)}

      {/* Simulate Workflow Dialog */}
      {selectedTemplate && (<SimulateFlowDialog_1.default isOpen={showSimulateDialog} onClose={function () { return setShowSimulateDialog(false); }} preselectedTemplateId={selectedTemplate.id} documentId={documentId ? parseInt(documentId) : undefined} onWorkflowStarted={function (workflowId) {
                setShowSimulateDialog(false);
                setSuccess(true);
                setCreatedWorkflowId(workflowId);
                setSelectedTemplate(null);
                setDocumentId('');
                setShareId('');
                setReason('');
            }}/>)}
    </DashboardLayout_1.default>);
}
