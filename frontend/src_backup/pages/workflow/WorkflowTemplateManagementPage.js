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
exports.default = WorkflowTemplateManagementPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var WorkflowBuilder_1 = require("../../components/WorkflowBuilder");
require("../../modal.css");
function WorkflowTemplateManagementPage() {
    var _this = this;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)([]), templates = _a[0], setTemplates = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    // Filters
    var _d = (0, react_1.useState)('ALL'), statusFilter = _d[0], setStatusFilter = _d[1];
    var _e = (0, react_1.useState)(''), searchQuery = _e[0], setSearchQuery = _e[1];
    // Edit/Create modal
    var _f = (0, react_1.useState)(false), showEditor = _f[0], setShowEditor = _f[1];
    var _g = (0, react_1.useState)(null), editingTemplate = _g[0], setEditingTemplate = _g[1];
    var _h = (0, react_1.useState)(false), isCreating = _h[0], setIsCreating = _h[1];
    // Form state
    var _j = (0, react_1.useState)(''), formName = _j[0], setFormName = _j[1];
    var _k = (0, react_1.useState)(''), formDescription = _k[0], setFormDescription = _k[1];
    var _l = (0, react_1.useState)('APPROVAL'), formWorkflowType = _l[0], setFormWorkflowType = _l[1];
    var _m = (0, react_1.useState)(''), formStepsJson = _m[0], setFormStepsJson = _m[1];
    var _o = (0, react_1.useState)(false), submitting = _o[0], setSubmitting = _o[1];
    // Validation modal
    var _p = (0, react_1.useState)(false), showValidation = _p[0], setShowValidation = _p[1];
    var _q = (0, react_1.useState)(null), validationResult = _q[0], setValidationResult = _q[1];
    // Editor mode (visual vs JSON)
    var _r = (0, react_1.useState)('visual'), editorMode = _r[0], setEditorMode = _r[1];
    var _s = (0, react_1.useState)([]), parsedSteps = _s[0], setParsedSteps = _s[1];
    (0, react_1.useEffect)(function () {
        loadTemplates();
    }, []);
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
                    return [4 /*yield*/, api_1.apiClient.getAllWorkflowTemplates()];
                case 2:
                    response = _c.sent();
                    setTemplates(response.data || []);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load templates');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleCreate = function () {
        setIsCreating(true);
        setEditingTemplate(null);
        setFormName('');
        setFormDescription('');
        setFormWorkflowType('APPROVAL');
        setFormStepsJson('[]');
        setParsedSteps([]);
        setEditorMode('visual');
        setShowEditor(true);
    };
    var handleEdit = function (template) {
        if (template.status !== 'DRAFT') {
            alert('Can only edit draft templates. Create a new version instead.');
            return;
        }
        setIsCreating(false);
        setEditingTemplate(template);
        setFormName(template.name);
        setFormDescription(template.description);
        setFormWorkflowType(template.workflowType);
        setFormStepsJson(template.stepsJson);
        // Try to parse existing steps for visual editor
        try {
            var steps = JSON.parse(template.stepsJson);
            setParsedSteps(Array.isArray(steps) ? steps : []);
        }
        catch (e) {
            setParsedSteps([]);
        }
        setEditorMode('visual');
        setShowEditor(true);
    };
    var handleSave = function () { return __awaiter(_this, void 0, void 0, function () {
        var data, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!formName.trim()) {
                        alert('Template name is required');
                        return [2 /*return*/];
                    }
                    if (!formStepsJson.trim()) {
                        alert('Workflow steps are required');
                        return [2 /*return*/];
                    }
                    setSubmitting(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, 7, 8]);
                    data = {
                        name: formName,
                        description: formDescription,
                        workflowType: formWorkflowType,
                        stepsJson: formStepsJson
                    };
                    if (!isCreating) return [3 /*break*/, 3];
                    return [4 /*yield*/, api_1.apiClient.createWorkflowTemplate(data)];
                case 2:
                    _c.sent();
                    alert('Template created successfully!');
                    return [3 /*break*/, 5];
                case 3:
                    if (!editingTemplate) return [3 /*break*/, 5];
                    return [4 /*yield*/, api_1.apiClient.updateWorkflowTemplate(editingTemplate.id, data)];
                case 4:
                    _c.sent();
                    alert('Template updated successfully!');
                    _c.label = 5;
                case 5:
                    setShowEditor(false);
                    loadTemplates();
                    return [3 /*break*/, 8];
                case 6:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to save template');
                    return [3 /*break*/, 8];
                case 7:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var handlePublish = function (templateId) { return __awaiter(_this, void 0, void 0, function () {
        var err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Publish this template? It cannot be modified after publishing.'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.publishWorkflowTemplate(templateId)];
                case 2:
                    _c.sent();
                    alert('Template published successfully!');
                    loadTemplates();
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _c.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to publish template');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleArchive = function (templateId) { return __awaiter(_this, void 0, void 0, function () {
        var err_4;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Archive this template? It will no longer be available for new workflows.'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.archiveWorkflowTemplate(templateId)];
                case 2:
                    _c.sent();
                    alert('Template archived successfully!');
                    loadTemplates();
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _c.sent();
                    alert(((_b = (_a = err_4.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to archive template');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleDelete = function (templateId) { return __awaiter(_this, void 0, void 0, function () {
        var err_5;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!confirm('Delete this template? This action cannot be undone.'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.deleteWorkflowTemplate(templateId)];
                case 2:
                    _c.sent();
                    alert('Template deleted successfully!');
                    loadTemplates();
                    return [3 /*break*/, 4];
                case 3:
                    err_5 = _c.sent();
                    alert(((_b = (_a = err_5.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to delete template');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleValidate = function () { return __awaiter(_this, void 0, void 0, function () {
        var data, response, err_6;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    // Sync visual editor to JSON before validation
                    if (editorMode === 'visual') {
                        setFormStepsJson(JSON.stringify(parsedSteps, null, 2));
                    }
                    data = {
                        name: formName,
                        description: formDescription,
                        workflowType: formWorkflowType,
                        stepsJson: editorMode === 'visual' ? JSON.stringify(parsedSteps) : formStepsJson
                    };
                    return [4 /*yield*/, api_1.apiClient.validateWorkflowTemplate(data)];
                case 1:
                    response = _c.sent();
                    setValidationResult(response.data);
                    setShowValidation(true);
                    return [3 /*break*/, 3];
                case 2:
                    err_6 = _c.sent();
                    alert('Validation failed: ' + (((_b = (_a = err_6.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Unknown error'));
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    }); };
    var handleStepsChange = function (steps) {
        setParsedSteps(steps);
        setFormStepsJson(JSON.stringify(steps, null, 2));
    };
    var handleEditorModeChange = function (mode) {
        if (mode === 'json' && editorMode === 'visual') {
            // Switching from visual to JSON: update JSON from visual
            setFormStepsJson(JSON.stringify(parsedSteps, null, 2));
        }
        else if (mode === 'visual' && editorMode === 'json') {
            // Switching from JSON to visual: parse JSON
            try {
                var steps = JSON.parse(formStepsJson);
                setParsedSteps(Array.isArray(steps) ? steps : []);
            }
            catch (e) {
                alert('Invalid JSON format. Please fix JSON syntax before switching to visual editor.');
                return;
            }
        }
        setEditorMode(mode);
    };
    var filteredTemplates = templates.filter(function (template) {
        var _a;
        // Status filter
        if (statusFilter !== 'ALL' && template.status !== statusFilter) {
            return false;
        }
        // Search filter
        if (searchQuery.trim()) {
            var query = searchQuery.toLowerCase();
            return template.name.toLowerCase().includes(query) ||
                ((_a = template.description) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(query)) ||
                template.workflowType.toLowerCase().includes(query);
        }
        return true;
    });
    var getStatusColor = function (status) {
        switch (status) {
            case 'DRAFT': return '#ff9800';
            case 'PUBLISHED': return '#4caf50';
            case 'ARCHIVED': return '#9e9e9e';
            default: return '#666';
        }
    };
    var getStatusBadge = function (status) { return (<span style={{
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
            background: getStatusColor(status),
            color: 'white'
        }}>
      {status}
    </span>); };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
        }}>
          <h1 style={{ fontSize: '28px', margin: 0 }}>Workflow Template Management</h1>
          <button onClick={handleCreate} style={{
            padding: '12px 24px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
        }}>
            + Create New Template
          </button>
        </div>

        {/* Filters */}
        <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
        }}>
          <input type="text" placeholder="Search templates..." value={searchQuery} onChange={function (e) { return setSearchQuery(e.target.value); }} style={{
            flex: 1,
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
        }}/>

          <select value={statusFilter} onChange={function (e) { return setStatusFilter(e.target.value); }} style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
        }}>
            <option value="ALL">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>

          <button onClick={loadTemplates} style={{
            padding: '10px 20px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
        }}>
            Refresh
          </button>
        </div>

        {/* Templates Table */}
        {loading ? (<div style={{ textAlign: 'center', padding: '60px' }}>
            <p>Loading templates...</p>
          </div>) : error ? (<div style={{
                background: '#ffebee',
                padding: '20px',
                borderRadius: '8px',
                color: '#c62828'
            }}>
            {error}
          </div>) : filteredTemplates.length === 0 ? (<div style={{
                background: 'white',
                padding: '60px',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No templates found</p>
            <button onClick={handleCreate} style={{
                marginTop: '16px',
                padding: '10px 20px',
                background: '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
            }}>
              Create Your First Template
            </button>
          </div>) : (<div style={{
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f5f5f5' }}>
                <tr>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Status</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Version</th>
                  <th style={{ padding: '16px', textAlign: 'left', fontWeight: '600' }}>Created</th>
                  <th style={{ padding: '16px', textAlign: 'center', fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map(function (template) { return (<tr key={template.id} style={{ borderTop: '1px solid #eee' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: '500' }}>{template.name}</div>
                      {template.description && (<div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                          {template.description.length > 80
                        ? template.description.substring(0, 80) + '...'
                        : template.description}
                        </div>)}
                    </td>
                    <td style={{ padding: '16px' }}>{template.workflowType}</td>
                    <td style={{ padding: '16px' }}>{getStatusBadge(template.status)}</td>
                    <td style={{ padding: '16px' }}>v{template.version || 1}.0</td>
                    <td style={{ padding: '16px', fontSize: '13px' }}>
                      {new Date(template.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        {template.status === 'DRAFT' && (<>
                            <button onClick={function () { return handleEdit(template); }} style={{
                        padding: '6px 12px',
                        background: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}>
                              Edit
                            </button>
                            <button onClick={function () { return handlePublish(template.id); }} style={{
                        padding: '6px 12px',
                        background: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}>
                              Publish
                            </button>
                            <button onClick={function () { return handleDelete(template.id); }} style={{
                        padding: '6px 12px',
                        background: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}>
                              Delete
                            </button>
                          </>)}
                        {template.status === 'PUBLISHED' && (<button onClick={function () { return handleArchive(template.id); }} style={{
                        padding: '6px 12px',
                        background: '#ff9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}>
                            Archive
                          </button>)}
                        <button onClick={function () { return navigate("/admin/workflows/".concat(template.id)); }} style={{
                    padding: '6px 12px',
                    background: '#9e9e9e',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                }}>
                          View
                        </button>
                      </div>
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>)}

        {/* Editor Modal */}
        {showEditor && (<div className="modal-overlay" onClick={function () { return setShowEditor(false); }}>
            <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflow: 'auto' }} onClick={function (e) { return e.stopPropagation(); }}>
              <h2>{isCreating ? 'Create New Template' : 'Edit Template'}</h2>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Template Name *
                </label>
                <input type="text" value={formName} onChange={function (e) { return setFormName(e.target.value); }} placeholder="e.g., Document Approval Workflow" style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px'
            }}/>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Description
                </label>
                <textarea value={formDescription} onChange={function (e) { return setFormDescription(e.target.value); }} placeholder="Describe the purpose of this workflow template..." rows={3} style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px',
                resize: 'vertical'
            }}/>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Workflow Type *
                </label>
                <select value={formWorkflowType} onChange={function (e) { return setFormWorkflowType(e.target.value); }} style={{
                width: '100%',
                padding: '10px',
                border: '1px solid #ddd',
                borderRadius: '6px'
            }}>
                  <option value="APPROVAL">Approval</option>
                  <option value="REVIEW">Review</option>
                  <option value="SIGNATURE">Signature</option>
                  <option value="CONDITIONAL">Conditional</option>
                  <option value="PARALLEL">Parallel</option>
                </select>
              </div>

              {/* Editor Mode Toggle */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Workflow Steps *
                </label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <button type="button" onClick={function () { return handleEditorModeChange('visual'); }} style={{
                padding: '8px 16px',
                background: editorMode === 'visual' ? '#2196f3' : '#e0e0e0',
                color: editorMode === 'visual' ? 'white' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: editorMode === 'visual' ? 'bold' : 'normal'
            }}>
                    Visual Builder
                  </button>
                  <button type="button" onClick={function () { return handleEditorModeChange('json'); }} style={{
                padding: '8px 16px',
                background: editorMode === 'json' ? '#2196f3' : '#e0e0e0',
                color: editorMode === 'json' ? 'white' : '#666',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: editorMode === 'json' ? 'bold' : 'normal'
            }}>
                    JSON Editor
                  </button>
                </div>

                {/* Visual Builder */}
                {editorMode === 'visual' ? (<div style={{
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    padding: '16px',
                    background: '#fafafa',
                    minHeight: '300px'
                }}>
                    <WorkflowBuilder_1.default steps={parsedSteps} onStepsChange={handleStepsChange} onValidate={handleValidate}/>
                  </div>) : (<textarea value={formStepsJson} onChange={function (e) { return setFormStepsJson(e.target.value); }} placeholder='[{"id":"step-1","type":"APPROVAL","name":"Supervisor Approval","approverRule":{"type":"ROLE","value":"ROLE_SUPERVISOR"},"timeoutDays":3,"required":true}]' rows={10} style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    resize: 'vertical',
                    fontFamily: 'monospace',
                    fontSize: '12px'
                }}/>)}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button onClick={handleValidate} style={{
                padding: '10px 20px',
                background: '#ff9800',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
            }}>
                  Validate
                </button>
                <button onClick={function () { return setShowEditor(false); }} style={{
                padding: '10px 20px',
                background: '#9e9e9e',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
            }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={submitting} style={{
                padding: '10px 20px',
                background: submitting ? '#ccc' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: submitting ? 'not-allowed' : 'pointer'
            }}>
                  {submitting ? 'Saving...' : isCreating ? 'Create' : 'Update'}
                </button>
              </div>
            </div>
          </div>)}

        {/* Validation Modal */}
        {showValidation && validationResult && (<div className="modal-overlay" onClick={function () { return setShowValidation(false); }}>
            <div className="modal-content" style={{ maxWidth: '600px' }} onClick={function (e) { return e.stopPropagation(); }}>
              <h2>Template Validation Result</h2>

              {validationResult.valid ? (<div style={{
                    background: '#e8f5e9',
                    padding: '16px',
                    borderRadius: '6px',
                    marginBottom: '16px'
                }}>
                  <p style={{ color: '#2e7d32', fontWeight: 'bold', margin: 0 }}>
                    ✓ Template is valid!
                  </p>
                </div>) : (<div style={{
                    background: '#ffebee',
                    padding: '16px',
                    borderRadius: '6px',
                    marginBottom: '16px'
                }}>
                  <p style={{ color: '#c62828', fontWeight: 'bold', margin: 0 }}>
                    ✗ Template has errors
                  </p>
                </div>)}

              {validationResult.errors && validationResult.errors.length > 0 && (<div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', color: '#c62828' }}>Errors:</h3>
                  <ul style={{ color: '#c62828' }}>
                    {validationResult.errors.map(function (error, index) { return (<li key={index}>{error}</li>); })}
                  </ul>
                </div>)}

              {validationResult.warnings && validationResult.warnings.length > 0 && (<div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', color: '#ff9800' }}>Warnings:</h3>
                  <ul style={{ color: '#ff9800' }}>
                    {validationResult.warnings.map(function (warning, index) { return (<li key={index}>{warning}</li>); })}
                  </ul>
                </div>)}

              <div style={{ textAlign: 'right', marginTop: '24px' }}>
                <button onClick={function () { return setShowValidation(false); }} style={{
                padding: '10px 20px',
                background: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer'
            }}>
                  Close
                </button>
              </div>
            </div>
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
