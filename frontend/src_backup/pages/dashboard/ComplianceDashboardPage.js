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
exports.default = ComplianceDashboardPage;
var react_1 = require("react");
var authStore_1 = require("../../store/authStore");
var api_1 = require("../../api");
var DashboardSkeleton_1 = require("../../components/DashboardSkeleton");
function ComplianceDashboardPage() {
    var _this = this;
    var _a = (0, authStore_1.useAuthStore)(), _user = _a.user, theme = _a.theme;
    var _b = (0, react_1.useState)([]), violations = _b[0], setViolations = _b[1];
    var _c = (0, react_1.useState)([]), drifts = _c[0], setDrifts = _c[1];
    var _d = (0, react_1.useState)([]), expirations = _d[0], setExpirations = _d[1];
    var _e = (0, react_1.useState)(true), loading = _e[0], setLoading = _e[1];
    var _f = (0, react_1.useState)(''), error = _f[0], setError = _f[1];
    // Filters
    var _g = (0, react_1.useState)('all'), violationFilter = _g[0], setViolationFilter = _g[1];
    var _h = (0, react_1.useState)('all'), driftFilter = _h[0], setDriftFilter = _h[1];
    (0, react_1.useEffect)(function () {
        loadComplianceData();
    }, []);
    var loadComplianceData = function () { return __awaiter(_this, void 0, void 0, function () {
        var _a, violationsRes, driftsRes, expirationsRes, err_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    setLoading(true);
                    setError('');
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, Promise.all([
                            api_1.apiClient.getPolicyViolations(),
                            api_1.apiClient.getClassificationDrift(),
                            api_1.apiClient.getSignatureExpirations()
                        ])];
                case 2:
                    _a = _d.sent(), violationsRes = _a[0], driftsRes = _a[1], expirationsRes = _a[2];
                    setViolations(violationsRes.data || []);
                    setDrifts(driftsRes.data || []);
                    setExpirations(expirationsRes.data || []);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _d.sent();
                    setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load compliance dashboard data');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleResolveViolation = function (violationId) { return __awaiter(_this, void 0, void 0, function () {
        var resolution, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    resolution = prompt('Enter resolution notes (max 500 chars, optional):');
                    if (resolution !== null && resolution.length > 500) {
                        alert('Resolution notes too long. Maximum 500 characters.');
                        return [2 /*return*/];
                    }
                    if (!confirm('Mark this violation as resolved?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.resolveViolation(violationId)];
                case 2:
                    _c.sent();
                    setViolations(function (prev) { return prev.filter(function (v) { return v.id !== violationId; }); });
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to resolve violation');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleApproveDrift = function (driftId) { return __awaiter(_this, void 0, void 0, function () {
        var notes, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    notes = prompt('Enter approval notes (max 500 chars, optional):');
                    if (notes !== null && notes.length > 500) {
                        alert('Approval notes too long. Maximum 500 characters.');
                        return [2 /*return*/];
                    }
                    if (!confirm('Approve this classification change?'))
                        return [2 /*return*/];
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.approveDrift(driftId)];
                case 2:
                    _c.sent();
                    setDrifts(function (prev) { return prev.filter(function (d) { return d.id !== driftId; }); });
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _c.sent();
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to approve drift');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var getSeverityColor = function (severity) {
        switch (severity) {
            case 'CRITICAL': return '#ff0000';
            case 'HIGH': return '#ff6b6b';
            case 'MEDIUM': return '#ffa500';
            case 'LOW': return '#4caf50';
            default: return '#888';
        }
    };
    var getClassificationColor = function (classification) {
        switch (classification) {
            case 'STRICTLY_CONFIDENTIAL': return '#ff0000';
            case 'CONFIDENTIAL': return '#ff6b6b';
            case 'INTERNAL': return '#ffa500';
            case 'PUBLIC': return '#4caf50';
            default: return '#888';
        }
    };
    var getExpiryColor = function (days) {
        if (days < 0)
            return '#ff0000'; // Expired
        if (days <= 7)
            return '#ff6b6b'; // Critical
        if (days <= 30)
            return '#ffa500'; // Warning
        return '#4caf50'; // OK
    };
    // Filter violations
    var filteredViolations = violationFilter === 'all'
        ? violations
        : violations.filter(function (v) { return v.resolved === (violationFilter === 'resolved'); });
    // Filter drifts
    var filteredDrifts = driftFilter === 'all'
        ? drifts
        : drifts.filter(function (d) { return d.reviewRequired === (driftFilter === 'review'); });
    if (loading) {
        return <DashboardSkeleton_1.default variant="compliance"/>;
    }
    if (error) {
        return (<div className="dashboard">
        <div className="error-message">{error}</div>
        <button onClick={loadComplianceData} className="primary" style={{ marginTop: '20px' }}>
          Retry
        </button>
      </div>);
    }
    return (<div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Compliance Dashboard</h1>
          <p style={{ color: '#888', marginTop: '8px' }}>
            Policy Enforcement & Data Governance
          </p>
        </div>
      </div>

      {/* Policy Violations */}
      <div className="dashboard-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3>Policy Violations ({filteredViolations.length})</h3>
          <select value={violationFilter} onChange={function (e) { return setViolationFilter(e.target.value); }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
            <option value="all">All Violations</option>
            <option value="unresolved">Unresolved</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {filteredViolations.length > 0 ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredViolations.slice(0, 15).map(function (violation) { return (<div key={violation.id} style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: "4px solid ".concat(getSeverityColor(violation.severity)),
                    opacity: violation.resolved ? 0.6 : 1
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: '600', color: getSeverityColor(violation.severity) }}>
                        {violation.policyName}
                      </span>
                      {violation.resolved && (<span style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.7em',
                        background: '#4caf50',
                        color: 'white',
                        fontWeight: '600'
                    }}>
                          RESOLVED
                        </span>)}
                    </div>
                    <div style={{ fontSize: '0.9em', marginTop: '6px' }}>
                      Type: {violation.violationType}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginTop: '4px' }}>
                      {violation.details}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginTop: '6px' }}>
                      {violation.violator} ({violation.department}) • {new Date(violation.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '12px' }}>
                    <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600',
                    background: getSeverityColor(violation.severity),
                    color: 'white'
                }}>
                      {violation.severity}
                    </span>
                    {!violation.resolved && (<button onClick={function () { return handleResolveViolation(violation.id); }} style={{
                        padding: '6px 12px',
                        background: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85em'
                    }} title="Mark as resolved">
                        ✓ Resolve
                      </button>)}
                  </div>
                </div>
              </div>); })}
          </div>) : (<div className="empty-state" style={{ color: '#4caf50' }}>
            No policy violations - excellent compliance!
          </div>)}
      </div>

      <div className="dashboard-grid">
        {/* Classification Drift */}
        <div className="dashboard-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3>Classification Drift ({filteredDrifts.length})</h3>
            <select value={driftFilter} onChange={function (e) { return setDriftFilter(e.target.value); }} style={{
            padding: '6px 10px',
            borderRadius: '4px',
            border: "1px solid ".concat(theme === 'dark' ? '#444' : '#ddd'),
            background: theme === 'dark' ? '#2a2a2a' : '#fff',
            color: theme === 'dark' ? '#fff' : '#000'
        }}>
              <option value="all">All Drifts</option>
              <option value="review">Requires Review</option>
            </select>
          </div>

          {filteredDrifts.length > 0 ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredDrifts.slice(0, 10).map(function (drift) { return (<div key={drift.id} style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '8px' }}>
                    {drift.documentName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600',
                    background: getClassificationColor(drift.originalClassification) + '33',
                    color: getClassificationColor(drift.originalClassification)
                }}>
                      {drift.originalClassification.replace('_', ' ')}
                    </span>
                    <span style={{ color: '#888' }}>→</span>
                    <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75em',
                    fontWeight: '600',
                    background: getClassificationColor(drift.detectedClassification) + '33',
                    color: getClassificationColor(drift.detectedClassification)
                }}>
                      {drift.detectedClassification.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '8px' }}>
                    Reason: {drift.driftReason}
                  </div>
                  <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '10px' }}>
                    Detected: {new Date(drift.driftDetectedAt).toLocaleString()}
                  </div>
                  {drift.reviewRequired && (<button onClick={function () { return handleApproveDrift(drift.id); }} style={{
                        padding: '6px 12px',
                        background: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85em'
                    }} title="Approve classification change">
                      ✓ Approve Change
                    </button>)}
                </div>); })}
            </div>) : (<div className="empty-state">No classification drift detected</div>)}
        </div>

        {/* Signature Expirations */}
        <div className="dashboard-card">
          <h3>Signature Expirations ({expirations.length})</h3>
          {expirations.length > 0 ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {expirations
                .sort(function (a, b) { return a.daysUntilExpiry - b.daysUntilExpiry; })
                .slice(0, 10)
                .map(function (sig) { return (<div key={sig.id} style={{
                    padding: '12px',
                    background: theme === 'dark' ? '#2a2a2a' : '#f9f9f9',
                    borderRadius: '6px',
                    borderLeft: "4px solid ".concat(getExpiryColor(sig.daysUntilExpiry))
                }}>
                    <div style={{ fontWeight: '500', marginBottom: '6px' }}>
                      {sig.documentName}
                    </div>
                    <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>
                      Signed by: {sig.signedBy} • CA: {sig.certificateAuthority}
                    </div>
                    <div style={{ fontSize: '0.8em', color: '#888', marginBottom: '8px' }}>
                      Signature Date: {new Date(sig.signatureDate).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.8em',
                    fontWeight: '600',
                    background: getExpiryColor(sig.daysUntilExpiry),
                    color: 'white'
                }}>
                        {sig.daysUntilExpiry < 0
                    ? "Expired ".concat(Math.abs(sig.daysUntilExpiry), " days ago")
                    : sig.daysUntilExpiry === 0
                        ? 'Expires today'
                        : "".concat(sig.daysUntilExpiry, " days remaining")}
                      </span>
                      <span style={{ fontSize: '0.75em', color: '#888' }}>
                        Exp: {new Date(sig.expirationDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>); })}
            </div>) : (<div className="empty-state">No signature expirations</div>)}
        </div>
      </div>

      {/* Compliance Summary Stats */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: violations.filter(function (v) { return !v.resolved; }).length > 0 ? '#ff6b6b' : '#4caf50' }}>
            {violations.filter(function (v) { return !v.resolved; }).length}
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Unresolved Violations
          </div>
        </div>

        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: drifts.filter(function (d) { return d.reviewRequired; }).length > 0 ? '#ffa500' : '#4caf50' }}>
            {drifts.filter(function (d) { return d.reviewRequired; }).length}
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Drifts Requiring Review
          </div>
        </div>

        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: expirations.filter(function (e) { return e.daysUntilExpiry <= 7; }).length > 0 ? '#ff6b6b' : '#4caf50' }}>
            {expirations.filter(function (e) { return e.daysUntilExpiry <= 7; }).length}
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Signatures Expiring Soon
          </div>
        </div>

        <div className="dashboard-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2em', fontWeight: '700', color: '#007bff' }}>
            {((violations.filter(function (v) { return v.resolved; }).length / Math.max(violations.length, 1)) * 100).toFixed(0)}%
          </div>
          <div style={{ fontSize: '0.9em', color: '#888', marginTop: '8px' }}>
            Compliance Rate
          </div>
        </div>
      </div>
    </div>);
}
