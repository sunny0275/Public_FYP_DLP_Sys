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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SharedDocumentPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var fileType_1 = require("../../utils/fileType");
var DRMViewer_1 = require("../../components/DRMViewer");
require("../../modal.css");
function SharedDocumentPage() {
    var _this = this;
    var token = (0, react_router_dom_1.useParams)().token;
    var _a = (0, react_1.useState)('loading'), accessState = _a[0], setAccessState = _a[1];
    var _b = (0, react_1.useState)('unknown'), errorType = _b[0], setErrorType = _b[1];
    var _c = (0, react_1.useState)(''), errorMessage = _c[0], setErrorMessage = _c[1];
    var _d = (0, react_1.useState)(null), shareData = _d[0], setShareData = _d[1];
    var _e = (0, react_1.useState)(''), password = _e[0], setPassword = _e[1];
    var _f = (0, react_1.useState)(0), passwordAttempts = _f[0], setPasswordAttempts = _f[1];
    var _g = (0, react_1.useState)(false), submitting = _g[0], setSubmitting = _g[1];
    // Document preview state
    var _h = (0, react_1.useState)(null), documentPreviewUrl = _h[0], setDocumentPreviewUrl = _h[1];
    var _j = (0, react_1.useState)(false), previewLoading = _j[0], setPreviewLoading = _j[1];
    var _k = (0, react_1.useState)(null), viewStartTime = _k[0], setViewStartTime = _k[1];
    var _l = (0, react_1.useState)([]), pageViews = _l[0], setPageViews = _l[1];
    (0, react_1.useEffect)(function () {
        if (token) {
            validateShareLink();
        }
    }, [token]);
    // Load preview when access is granted
    (0, react_1.useEffect)(function () {
        if (accessState === 'access_granted' && shareData && token) {
            loadDocumentPreview();
            setViewStartTime(Date.now());
        }
    }, [accessState, shareData, token]);
    // Track view duration for access logging
    (0, react_1.useEffect)(function () {
        if (accessState === 'access_granted' && viewStartTime) {
            return function () {
                // Log access when component unmounts or access ends
                if (token) {
                    var viewDuration = Math.floor((Date.now() - viewStartTime) / 1000); // seconds
                    logAccess(viewDuration);
                }
            };
        }
    }, [accessState, viewStartTime, token]);
    // Cleanup: revoke object URL when component unmounts
    (0, react_1.useEffect)(function () {
        return function () {
            if (documentPreviewUrl) {
                URL.revokeObjectURL(documentPreviewUrl);
            }
        };
    }, [documentPreviewUrl]);
    var validateShareLink = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, data, err_1, message;
        var _a, _b, _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    setAccessState('loading');
                    setErrorMessage('');
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.getShareLink(token)];
                case 2:
                    response = _g.sent();
                    data = response.data;
                    // Check link status
                    if (data.status === 'EXPIRED') {
                        setAccessState('error');
                        setErrorType('expired');
                        setErrorMessage('This share link has expired');
                        return [2 /*return*/];
                    }
                    if (data.status === 'REVOKED') {
                        setAccessState('error');
                        setErrorType('revoked');
                        setErrorMessage('This share link has been revoked by the owner');
                        return [2 /*return*/];
                    }
                    // Check access limit
                    if (data.accessLimit !== null && data.accessCount >= data.accessLimit) {
                        setAccessState('error');
                        setErrorType('access_limit');
                        setErrorMessage("This link has reached its access limit (".concat(data.accessLimit, " views)"));
                        return [2 /*return*/];
                    }
                    setShareData(data);
                    // Check if password is required
                    if (data.requiresPassword) {
                        setAccessState('password_required');
                    }
                    else {
                        setAccessState('access_granted');
                        loadDocumentPreview();
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _g.sent();
                    console.error('Share link validation error:', err_1);
                    setAccessState('error');
                    if (((_a = err_1.response) === null || _a === void 0 ? void 0 : _a.status) === 404) {
                        setErrorType('not_found');
                        setErrorMessage('Share link not found');
                    }
                    else if (((_b = err_1.response) === null || _b === void 0 ? void 0 : _b.status) === 403) {
                        message = ((_d = (_c = err_1.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.message) || '';
                        if (message.includes('IP')) {
                            setErrorType('ip_blocked');
                            setErrorMessage('Your IP address is not authorized to access this link');
                        }
                        else {
                            setErrorType('unknown');
                            setErrorMessage(message || 'Access denied');
                        }
                    }
                    else {
                        setErrorType('unknown');
                        setErrorMessage(((_f = (_e = err_1.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.message) || 'Failed to load share link');
                    }
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handlePasswordSubmit = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var response, data, err_2, attemptsLeft;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    e.preventDefault();
                    if (!password.trim()) {
                        alert('Please enter the password');
                        return [2 /*return*/];
                    }
                    if (passwordAttempts >= 5) {
                        setAccessState('error');
                        setErrorType('invalid_password');
                        setErrorMessage('Too many failed password attempts. Access denied.');
                        return [2 /*return*/];
                    }
                    setSubmitting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getShareLink(token, password)];
                case 2:
                    response = _a.sent();
                    data = response.data;
                    setShareData(data);
                    setAccessState('access_granted');
                    return [3 /*break*/, 5];
                case 3:
                    err_2 = _a.sent();
                    setPasswordAttempts(function (prev) { return prev + 1; });
                    attemptsLeft = 5 - (passwordAttempts + 1);
                    if (attemptsLeft > 0) {
                        alert("Incorrect password. ".concat(attemptsLeft, " attempt(s) remaining."));
                    }
                    else {
                        setAccessState('error');
                        setErrorType('invalid_password');
                        setErrorMessage('Too many failed password attempts. Access denied.');
                    }
                    return [3 /*break*/, 5];
                case 4:
                    setSubmitting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var loadDocumentPreview = function () { return __awaiter(_this, void 0, void 0, function () {
        var blob, previewUrl, err_3;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!token || !shareData)
                        return [2 /*return*/];
                    setPreviewLoading(true);
                    setViewStartTime(Date.now());
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getShareLinkPreview(token, password || undefined)
                        // Create object URL for the blob
                    ];
                case 2:
                    blob = _c.sent();
                    previewUrl = URL.createObjectURL(blob);
                    // Revoke old URL if exists
                    if (documentPreviewUrl) {
                        URL.revokeObjectURL(documentPreviewUrl);
                    }
                    setDocumentPreviewUrl(previewUrl);
                    setPageViews(function (prev) { return __spreadArray(__spreadArray([], prev, true), [Date.now()], false); });
                    return [3 /*break*/, 5];
                case 3:
                    err_3 = _c.sent();
                    console.error('Failed to load preview:', err_3);
                    alert(((_b = (_a = err_3.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load document preview');
                    return [3 /*break*/, 5];
                case 4:
                    setPreviewLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    // Log access when component unmounts
    (0, react_1.useEffect)(function () {
        return function () {
            if (viewStartTime && token) {
                var viewDuration = Math.floor((Date.now() - viewStartTime) / 1000); // seconds
                logAccess(viewDuration);
            }
        };
    }, [viewStartTime, token]);
    var logAccess = function (viewDuration) { return __awaiter(_this, void 0, void 0, function () {
        var err_4;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!token)
                        return [2 /*return*/];
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.logShareAccess(token, {
                            viewDuration: viewDuration,
                            pageViews: pageViews.length > 0 ? pageViews : undefined,
                            timestamp: new Date().toISOString()
                        })];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    err_4 = _a.sent();
                    console.error('Failed to log access:', err_4);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handleDownload = function () { return __awaiter(_this, void 0, void 0, function () {
        var blob, url, a, err_5;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!shareData || !shareData.allowDownload || !token) {
                        alert('Download is not permitted for this share link');
                        return [2 /*return*/];
                    }
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, api_1.apiClient.getShareLinkDownload(token, password || undefined)];
                case 2:
                    blob = _d.sent();
                    url = window.URL.createObjectURL(blob);
                    a = document.createElement('a');
                    a.href = url;
                    a.download = (0, fileType_1.ensureDownloadFilename)(shareData.documentName, (_a = shareData.fileType) !== null && _a !== void 0 ? _a : undefined);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    return [3 /*break*/, 4];
                case 3:
                    err_5 = _d.sent();
                    alert(((_c = (_b = err_5.response) === null || _b === void 0 ? void 0 : _b.data) === null || _c === void 0 ? void 0 : _c.message) || 'Failed to download document');
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var renderErrorPage = function () {
        var errorIcons = {
            expired: '⏰',
            revoked: '🚫',
            ip_blocked: '🔒',
            access_limit: '📊',
            not_found: '❓',
            invalid_password: '🔑',
            unknown: '⚠️'
        };
        var errorTitles = {
            expired: 'Link Expired',
            revoked: 'Link Revoked',
            ip_blocked: 'Access Denied',
            access_limit: 'Access Limit Reached',
            not_found: 'Link Not Found',
            invalid_password: 'Access Denied',
            unknown: 'Access Error'
        };
        return (<div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px'
            }}>
        <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '48px',
                maxWidth: '500px',
                textAlign: 'center',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
          <div style={{ fontSize: '72px', marginBottom: '24px' }}>
            {errorIcons[errorType]}
          </div>
          <h1 style={{ fontSize: '28px', marginBottom: '16px', color: '#333' }}>
            {errorTitles[errorType]}
          </h1>
          <p style={{ fontSize: '16px', color: '#666', marginBottom: '32px', lineHeight: '1.6' }}>
            {errorMessage}
          </p>
          <p style={{ fontSize: '14px', color: '#999' }}>
            If you believe this is an error, please contact the person who shared this link.
          </p>
        </div>
      </div>);
    };
    var renderPasswordPrompt = function () {
        return (<div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                padding: '20px'
            }}>
        <div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '48px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔐</div>
            <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#333' }}>
              Password Required
            </h1>
            <p style={{ fontSize: '14px', color: '#666' }}>
              This document is password protected
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#333' }}>
                Enter Password
              </label>
              <input type="password" value={password} onChange={function (e) { return setPassword(e.target.value); }} placeholder="Enter the access password" style={{
                width: '100%',
                padding: '12px',
                fontSize: '16px',
                border: '2px solid #e0e0e0',
                borderRadius: '8px',
                transition: 'border-color 0.2s'
            }} disabled={submitting} autoFocus/>
              {passwordAttempts > 0 && (<p style={{ marginTop: '8px', fontSize: '14px', color: '#f44336' }}>
                  {5 - passwordAttempts} attempt(s) remaining
                </p>)}
            </div>

            <button type="submit" disabled={submitting || !password.trim()} style={{
                width: '100%',
                padding: '14px',
                fontSize: '16px',
                fontWeight: 'bold',
                background: submitting ? '#ccc' : '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
            }}>
              {submitting ? 'Verifying...' : 'Access Document'}
            </button>
          </form>
        </div>
      </div>);
    };
    var renderDocumentView = function () {
        if (!shareData)
            return null;
        return (<div style={{
                minHeight: '100vh',
                background: '#f5f5f5',
                padding: '20px'
            }}>
        {/* Header */}
        <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                marginBottom: '20px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h1 style={{ fontSize: '24px', marginBottom: '8px', color: '#333' }}>
                {shareData.documentName}
              </h1>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>
                Shared by {shareData.createdByName} on {new Date(shareData.createdAt).toLocaleDateString()}
              </p>
              {shareData.description && (<p style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
                  {shareData.description}
                </p>)}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              {shareData.allowDownload && (<button onClick={handleDownload} style={{
                    padding: '10px 20px',
                    background: '#4caf50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}>
                  📥 Download
                </button>)}
            </div>
          </div>

          {/* Share info */}
          <div style={{
                marginTop: '20px',
                padding: '16px',
                background: '#f8f9fa',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#666'
            }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <strong>Permission:</strong> {shareData.permission}
              </div>
              {shareData.accessLimit && (<div>
                  <strong>Views:</strong> {shareData.accessCount} / {shareData.accessLimit}
                </div>)}
              {shareData.expiresAt && (<div>
                  <strong>Expires:</strong> {new Date(shareData.expiresAt).toLocaleString()}
                </div>)}
              {shareData.requiresWatermark && (<div style={{ color: '#ff9800' }}>
                  ⚠️ Watermarked document
                </div>)}
            </div>
          </div>

          {/* Security notices */}
          <div style={{ marginTop: '16px', padding: '12px', background: '#fff3cd', borderRadius: '6px', fontSize: '13px' }}>
            <strong>🔒 Security Notice:</strong>
            <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0 }}>
              {!shareData.allowCopy && <li>Copy/paste is disabled</li>}
              {!shareData.allowPrint && <li>Printing is disabled</li>}
              {!shareData.allowDownload && <li>Download is disabled</li>}
              {shareData.requiresWatermark && <li>All views are watermarked with your access information</li>}
            </ul>
          </div>
        </div>

        {/* Preview */}
        <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                minHeight: '600px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                position: 'relative'
            }}>
          {previewLoading ? (<div style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ fontSize: '18px', color: '#666' }}>Loading preview...</p>
            </div>) : documentPreviewUrl ? (<DRMViewer_1.default documentUrl={documentPreviewUrl} documentName={shareData.documentName} allowCopy={shareData.allowCopy} allowPrint={shareData.allowPrint} allowDownload={shareData.allowDownload} requiresWatermark={shareData.requiresWatermark} watermarkText={"Shared via DLP System | ".concat(new Date().toISOString())}/>) : (<div style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ fontSize: '18px', color: '#666' }}>Document preview unavailable</p>
              <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
                The document could not be loaded. Please contact the person who shared this link.
              </p>
            </div>)}
        </div>

        {/* Footer */}
        <div style={{
                marginTop: '20px',
                textAlign: 'center',
                fontSize: '13px',
                color: '#999'
            }}>
          <p>This document is shared via Enterprise DLP System</p>
          <p style={{ marginTop: '4px' }}>All access is monitored and logged for security purposes</p>
        </div>
      </div>);
    };
    if (accessState === 'loading') {
        return (<div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
            }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
          <h2>Validating share link...</h2>
        </div>
      </div>);
    }
    if (accessState === 'error') {
        return renderErrorPage();
    }
    if (accessState === 'password_required') {
        return renderPasswordPrompt();
    }
    return renderDocumentView();
}
