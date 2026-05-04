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
exports.default = UploadResultPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
function UploadResultPage() {
    var _this = this;
    var jobId = (0, react_router_dom_1.useParams)().jobId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _a = (0, react_1.useState)(null), job = _a[0], setJob = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)('INTERNAL'), finalLevel = _d[0], setFinalLevel = _d[1];
    var _e = (0, react_1.useState)(''), comment = _e[0], setComment = _e[1];
    var _f = (0, react_1.useState)(false), resolving = _f[0], setResolving = _f[1];
    var resolveUpdatedTime = function (job) {
        return job.updatedAt || job.completedAt || job.createdAt || null;
    };
    (0, react_1.useEffect)(function () {
        var load = function () { return __awaiter(_this, void 0, void 0, function () {
            var res, err_1;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!jobId)
                            return [2 /*return*/];
                        setLoading(true);
                        setError('');
                        _d.label = 1;
                    case 1:
                        _d.trys.push([1, 3, 4, 5]);
                        return [4 /*yield*/, api_1.apiClient.getUploadJobStatus(Number(jobId))];
                    case 2:
                        res = _d.sent();
                        setJob(res.data);
                        if ((_a = res.data) === null || _a === void 0 ? void 0 : _a.userSelectedClassification) {
                            setFinalLevel(res.data.userSelectedClassification);
                        }
                        return [3 /*break*/, 5];
                    case 3:
                        err_1 = _d.sent();
                        setError(((_c = (_b = err_1.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to load upload job status');
                        return [3 /*break*/, 5];
                    case 4:
                        setLoading(false);
                        return [7 /*endfinally*/];
                    case 5: return [2 /*return*/];
                }
            });
        }); };
        load();
    }, [jobId]);
    var isMismatch = function (job) {
        if (!job.userSelectedClassification || !job.suggestedClassification)
            return false;
        return job.userSelectedClassification !== job.suggestedClassification;
    };
    var canResolveMismatch = function (job) {
        return isMismatch(job) &&
            !job.documentRequiresReview &&
            (job.status === 'COMPLETED' || job.status === 'REVIEW_REQUIRED');
    };
    var handleResolve = function (mode) { return __awaiter(_this, void 0, void 0, function () {
        var payload, res, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!jobId)
                        return [2 /*return*/];
                    setResolving(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    payload = {
                        finalClassificationLevel: mode === 'accept_llm'
                            ? job === null || job === void 0 ? void 0 : job.suggestedClassification
                            : finalLevel,
                        reportLlmMistake: mode === 'keep_user_report',
                        comment: comment || undefined
                    };
                    return [4 /*yield*/, api_1.apiClient.resolveUploadClassification(Number(jobId), payload)];
                case 2:
                    res = _c.sent();
                    setJob(res.data);
                    alert('Your classification decision has been submitted.');
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _c.sent();
                    alert(((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to resolve classification');
                    return [3 /*break*/, 5];
                case 4:
                    setResolving(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var renderStatus = function () {
        var _a;
        if (!job)
            return null;
        var status = job.status;
        if (status === 'COMPLETED') {
            var mismatch = isMismatch(job);
            return (<div style={{ marginBottom: '16px' }}>
          <div className="info-message" style={{ marginBottom: (job.documentRequiresReview || mismatch) ? '12px' : 0 }}>
            Upload completed. Document processing succeeded.
          </div>
          {mismatch && !job.documentRequiresReview && (<div className="info-message" style={{ marginBottom: '12px', padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404' }}>
                Classification differs from your selection
              </div>
              <div style={{ color: '#856404', fontSize: '0.95em', lineHeight: '1.6' }}>
                The document was uploaded, but the automatic classification differs from your selected level.
                <br />
                <br />
                Please choose below: <strong>Accept suggested level</strong> to use the AI suggestion, or <strong>Keep my level and report (send for review)</strong> to keep your selection and send the document for reviewer approval.
              </div>
            </div>)}
          {job.documentRequiresReview && (<div className="info-message" style={{ padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404' }}>
                ⚠️ Pending Review
              </div>
              <div style={{ color: '#856404', fontSize: '0.95em', lineHeight: '1.6' }}>
                The document is now in PENDING status and requires reviewer approval.
                <br />
                <strong>Current Status:</strong>
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Only you (uploader) and reviewers can view this document</li>
                  <li>Other users cannot access it until a reviewer approves the classification level</li>
                  <li>A reviewer will review and confirm the classification level</li>
                </ul>
              </div>
            </div>)}
        </div>);
        }
        if (status === 'FAILED') {
            return (<div className="error-message" style={{ marginBottom: '16px' }}>
          Upload or processing failed: {job.errorMessage || 'Unknown error'}
        </div>);
        }
        if (status === 'REVIEW_REQUIRED') {
            var mismatch = isMismatch(job);
            return (<div style={{ marginBottom: '16px' }}>
          <div className="info-message" style={{ marginBottom: '12px', padding: '16px', background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#856404' }}>
              {mismatch ? 'Classification differs from your selection' : 'Manual review required'}
            </div>
            <div style={{ color: '#856404', fontSize: '0.95em', lineHeight: '1.6' }}>
              {mismatch ? (<>
                  The document was uploaded, but the automatic classification differs from your selected level.
                  <br />
                  <br />
                  Please choose below: <strong>Accept suggested level</strong> to use the AI suggestion, or <strong>Keep my level and report (send for review)</strong> to keep your selection and send the document for reviewer approval.
                </>) : (<>
                  Automatic classification is currently unavailable. The document is routed to manual review for reviewer decision.
                </>)}
            </div>
          </div>
        </div>);
        }
        return (<div className="info-message" style={{ marginBottom: '16px' }}>
        Processing upload… Current status: {status}, progress {(_a = job.progress) !== null && _a !== void 0 ? _a : 0}%.
      </div>);
    };
    return (<DashboardLayout_1.default>
      <div className="dashboard">
        <h1>Upload Result</h1>

        {loading && <div>Loading upload status...</div>}
        {error && !loading && <div className="error-message">{error}</div>}

        {!loading && !error && job && (<div className="dashboard-card">
            {renderStatus()}

            <div style={{ marginBottom: '12px' }}>
              <strong>Job ID:</strong> {job.id}
            </div>
            {resolveUpdatedTime(job) && (<div style={{ marginBottom: '12px' }}>
                <strong>Updated time:</strong> {new Date(resolveUpdatedTime(job)).toLocaleString()}
              </div>)}
            {job.documentId && (<div style={{ marginBottom: '12px' }}>
                <strong>Document ID:</strong> {job.documentId}
              </div>)}

            {(job.userSelectedClassification || job.suggestedClassification) && (<div style={{ marginTop: '12px', padding: '12px', border: '1px solid #eee', borderRadius: '8px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Your selection:</strong> {job.userSelectedClassification || '—'}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Suggested level:</strong> {job.suggestedClassification || '—'}
                  {job.classificationConfidence !== null && job.classificationConfidence !== undefined ? (<>（confidence: {job.classificationConfidence}）</>) : null}
                </div>
                {job.classificationReason && (<div style={{ fontSize: '13px', color: '#555' }}>
                    <strong>Reason:</strong> {job.classificationReason}
                  </div>)}
              </div>)}

            {canResolveMismatch(job) && (<div style={{ marginTop: '16px', padding: '14px', border: '1px solid #ffc107', borderRadius: '8px', background: '#fff8e1' }}>
                <div style={{ fontWeight: 700, marginBottom: '10px' }}>
                  Please choose the final label (required)
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px' }}>
                  <select value={finalLevel} onChange={function (e) { return setFinalLevel(e.target.value); }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
                    <option value="PUBLIC">PUBLIC</option>
                    <option value="INTERNAL">INTERNAL</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                    <option value="STRICTLY_CONFIDENTIAL">STRICTLY_CONFIDENTIAL</option>
                  </select>
                  <textarea value={comment} onChange={function (e) { return setComment(e.target.value); }} placeholder="Optional: add a reason / report (e.g., why the suggested level is incorrect)" style={{ padding: '10px', borderRadius: '6px', border: '1px solid #ddd', minHeight: '80px' }}/>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button className="primary" disabled={resolving || !job.suggestedClassification} onClick={function () { return handleResolve('accept_llm'); }} type="button">
                      {resolving ? 'Submitting...' : 'Accept suggested level'}
                    </button>
                    <button disabled={resolving} onClick={function () { return handleResolve('keep_user_report'); }} type="button">
                      {resolving ? 'Submitting...' : 'Keep my level and report (send for review)'}
                    </button>
                  </div>
                </div>
              </div>)}

            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              {job.documentId && job.status === 'COMPLETED' && (<button className="primary" onClick={function () { return navigate("/documents/".concat(job.documentId)); }}>
                  View document details
                </button>)}
              <button onClick={function () { return navigate('/documents'); }}>
                Back to documents
              </button>
            </div>
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
