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
exports.default = SignatureChainPage;
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
var BLOCKCHAIN_EXPLORER_TX_BASE = import.meta.env.VITE_BLOCKCHAIN_EXPLORER_TX_BASE ||
    'https://sepolia.etherscan.io/tx/';
function SignatureChainPage() {
    var _this = this;
    var _a;
    var documentId = (0, react_router_dom_1.useParams)().documentId;
    var navigate = (0, react_router_dom_1.useNavigate)();
    var _b = (0, react_1.useState)([]), signatures = _b[0], setSignatures = _b[1];
    var _c = (0, react_1.useState)(true), loading = _c[0], setLoading = _c[1];
    var _d = (0, react_1.useState)(''), error = _d[0], setError = _d[1];
    var _e = (0, react_1.useState)(null), verifying = _e[0], setVerifying = _e[1];
    (0, react_1.useEffect)(function () {
        if (documentId) {
            loadSignatureChain();
        }
    }, [documentId]);
    var loadSignatureChain = function () { return __awaiter(_this, void 0, void 0, function () {
        var response, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!documentId)
                        return [2 /*return*/];
                    setLoading(true);
                    setError('');
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, api_1.apiClient.getSignatureChain(parseInt(documentId))];
                case 2:
                    response = _c.sent();
                    setSignatures(response.data || []);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load signature chain');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var handleVerify = function (signatureId) { return __awaiter(_this, void 0, void 0, function () {
        var result, err_2;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    setVerifying(signatureId);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, api_1.apiClient.verifySignature(signatureId)];
                case 2:
                    result = _c.sent();
                    if (result.data.valid) {
                        alert('✓ Signature verified successfully!\n\nThis signature is cryptographically valid.');
                    }
                    else {
                        alert('✗ Signature verification failed!\n\nThis signature may have been tampered with.');
                    }
                    // Reload signature chain to get updated status
                    return [4 /*yield*/, loadSignatureChain()];
                case 3:
                    // Reload signature chain to get updated status
                    _c.sent();
                    return [3 /*break*/, 6];
                case 4:
                    err_2 = _c.sent();
                    alert('Verification error: ' + (((_b = (_a = err_2.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Unknown error'));
                    return [3 /*break*/, 6];
                case 5:
                    setVerifying(null);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var getStatusBadge = function (status) {
        var styles = {
            VALID: { bg: '#4caf50', color: 'white' },
            PENDING: { bg: '#ff9800', color: 'white' },
            INVALID: { bg: '#f44336', color: 'white' },
            REVOKED: { bg: '#9e9e9e', color: 'white' }
        };
        var style = styles[status] || styles.PENDING;
        return (<span style={{
                padding: '4px 12px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 'bold',
                background: style.bg,
                color: style.color
            }}>
        {status}
      </span>);
    };
    var formatTimestamp = function (timestamp) {
        return new Date(timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
        }}>
          <div>
            <button onClick={function () { return navigate(-1); }} style={{
            padding: '8px 16px',
            background: '#9e9e9e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '12px'
        }}>
              ← Back
            </button>
            <h1 style={{ fontSize: '28px', margin: 0 }}>Document Signature Chain</h1>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
              Document ID: {documentId} | {signatures.length} signature{signatures.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Loading State */}
        {loading && (<div style={{ textAlign: 'center', padding: '60px' }}>
            <p>Loading signature chain...</p>
          </div>)}

        {/* Error State */}
        {error && (<div style={{
                background: '#ffebee',
                padding: '20px',
                borderRadius: '8px',
                color: '#c62828',
                marginBottom: '20px'
            }}>
            {error}
          </div>)}

        {/* Empty State */}
        {!loading && !error && signatures.length === 0 && (<div style={{
                background: 'white',
                padding: '60px',
                borderRadius: '8px',
                textAlign: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
            <p style={{ fontSize: '18px', color: '#666' }}>No signatures found for this document</p>
            <p style={{ fontSize: '14px', color: '#999', marginTop: '8px' }}>
              This document has not been electronically signed yet
            </p>
          </div>)}

        {/* Signature Chain */}
        {!loading && !error && signatures.length > 0 && (<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Uploader Info Banner */}
            {((_a = signatures[0]) === null || _a === void 0 ? void 0 : _a.uploader) && (<div style={{
                    background: '#e3f2fd',
                    border: '2px solid #2196f3',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                <div style={{
                    background: '#2196f3',
                    color: 'white',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px'
                }}>
                  📤
                </div>
                <div>
                  <div style={{ fontSize: '14px', color: '#1565c0', fontWeight: 'bold' }}>
                    {signatures[0].signatureTypeLabel || 'Document Uploader'}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: '600', color: '#1976d2' }}>
                    {signatures[0].uploader.fullName}
                    <span style={{ marginLeft: '8px', color: '#666', fontWeight: 'normal' }}>
                      ({signatures[0].uploader.accountId})
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    {signatures[0].uploader.department}
                  </div>
                </div>
              </div>)}

            {signatures.map(function (signature, index) {
                var _a, _b;
                // Determine signature type
                var sigType = signature.signatureType || 'UPLOAD';
                // Determine badge color based on signature type
                var getTypeBadgeColor = function (type) {
                    switch (type) {
                        case 'CLASSIFICATION_APPROVE': return '#ff9800';
                        case 'APPROVE_SHARE': return '#9c27b0';
                        case 'MANUAL_SIGN': return '#00bcd4';
                        case 'UPLOAD_CREATE':
                        case 'UPLOAD_JOB':
                        case 'UPLOAD_RESOLVE':
                        case 'UPLOAD': return '#2196f3';
                        default: return '#2196f3';
                    }
                };
                // Determine label based on type (if no label provided)
                var getTypeLabel = function (type) {
                    switch (type) {
                        case 'CLASSIFICATION_APPROVE': return 'Classification Approval';
                        case 'APPROVE_SHARE': return 'Share Approval';
                        case 'MANUAL_SIGN': return 'Manual Signature';
                        case 'UPLOAD_CREATE':
                        case 'UPLOAD_JOB':
                        case 'UPLOAD_RESOLVE':
                        case 'UPLOAD': return 'Document Upload';
                        default: return type || 'Signature';
                    }
                };
                return (<div key={signature.id} style={{
                        background: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        border: signature.status === 'VALID' ? '2px solid #4caf50' : '1px solid #e0e0e0'
                    }}>
                {/* Signature Header */}
                <div style={{
                        background: signature.status === 'VALID' ? '#e8f5e9' : '#f5f5f5',
                        padding: '16px 20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        background: signature.status === 'VALID' ? '#4caf50' : '#666',
                        color: 'white',
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 'bold'
                    }}>
                        {index + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                          {signature.user.fullName}
                          <span style={{
                        marginLeft: '8px',
                        padding: '2px 8px',
                        background: getTypeBadgeColor(sigType),
                        color: 'white',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'normal'
                    }}>
                          {signature.signatureTypeLabel || getTypeLabel(sigType)}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          ID: {signature.user.accountId || signature.user.id} | {((_a = signature.user.roles) === null || _a === void 0 ? void 0 : _a[0]) || 'EMPLOYEE'} | {signature.user.department}
                        </div>
                        {signature.user.position && (<div style={{ fontSize: '12px', color: '#888' }}>
                            Position: {signature.user.position}
                          </div>)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {getStatusBadge(signature.status)}
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                      {formatTimestamp(signature.signedAt)}
                    </div>
                  </div>
                </div>

                {/* Signature Details */}
                <div style={{ padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    {/* Left Column */}
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          Email
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500' }}>
                          {signature.user.email}
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          IP Address
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'monospace' }}>
                          {signature.ipAddress}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          Document Hash
                        </div>
                        <div style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        background: '#f5f5f5',
                        padding: '8px',
                        borderRadius: '4px',
                        wordBreak: 'break-all'
                    }}>
                          {signature.documentHash.substring(0, 32)}...
                        </div>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          ECDSA Signature
                        </div>
                        <div style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        background: '#f5f5f5',
                        padding: '8px',
                        borderRadius: '4px',
                        wordBreak: 'break-all',
                        maxHeight: '60px',
                        overflow: 'auto'
                    }}>
                          {signature.signatureHex.substring(0, 64)}...
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                          RFC 3161 Timestamp
                        </div>
                        <div style={{
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        background: '#f5f5f5',
                        padding: '8px',
                        borderRadius: '4px',
                        wordBreak: 'break-all'
                    }}>
                          {signature.timestampToken.substring(0, 32)}...
                        </div>
                      </div>

                      {(signature.certificateSerialHex || signature.certificatePem) && (<div style={{ marginBottom: '16px' }}>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            X.509 Certificate Chain (PKI)
                          </div>
                          {((_b = signature.pki) === null || _b === void 0 ? void 0 : _b.error) && (<div style={{ fontSize: '12px', color: '#c62828', marginBottom: '8px' }}>
                              {signature.pki.error}
                            </div>)}
                          {signature.pki && !signature.pki.error && (<div style={{
                                border: '1px solid #e0e0e0',
                                borderRadius: '8px',
                                padding: '10px',
                                background: '#fff'
                            }}>
                              <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                                <strong>Subject:</strong> <span style={{ fontFamily: 'monospace' }}>{signature.pki.subject}</span>
                              </div>
                              <div style={{ fontSize: '12px', color: '#333', marginBottom: '6px' }}>
                                <strong>Issuer:</strong> <span style={{ fontFamily: 'monospace' }}>{signature.pki.issuer}</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <div style={{ fontSize: '12px' }}>
                                  <strong>Not Before:</strong> {signature.pki.notBefore}
                                </div>
                                <div style={{ fontSize: '12px' }}>
                                  <strong>Not After:</strong> {signature.pki.notAfter}
                                </div>
                              </div>
                              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                                <strong>Key Usage:</strong> {(signature.pki.keyUsage || []).join(', ') || '—'}
                              </div>
                              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                                <strong>OCSP URL:</strong> {(signature.pki.ocspUrls || []).join(', ') || '—'}
                              </div>
                              <div style={{ marginTop: '6px', fontSize: '12px' }}>
                                <strong>CRL DP:</strong> {(signature.pki.crlDistributionPoints || []).join(', ') || '—'}
                              </div>
                            </div>)}
                          {signature.certificateSerialHex && (<div style={{ fontSize: '12px', color: '#444', marginBottom: '6px' }}>
                              Serial: <span style={{ fontFamily: 'monospace' }}>{signature.certificateSerialHex}</span>
                            </div>)}
                          {signature.certificatePem && (<details style={{ background: '#f5f5f5', padding: '10px', borderRadius: '6px' }}>
                              <summary style={{ cursor: 'pointer', fontSize: '12px' }}>Signer Certificate (PEM)</summary>
                              <pre style={{ margin: '10px 0 0 0', fontSize: '11px', overflowX: 'auto' }}>
                                {signature.certificatePem}
                              </pre>
                            </details>)}
                          {signature.issuerCertificatePem && (<details style={{ background: '#f5f5f5', padding: '10px', borderRadius: '6px', marginTop: '8px' }}>
                              <summary style={{ cursor: 'pointer', fontSize: '12px' }}>Issuer (CA) Certificate (PEM)</summary>
                              <pre style={{ margin: '10px 0 0 0', fontSize: '11px', overflowX: 'auto' }}>
                                {signature.issuerCertificatePem}
                              </pre>
                            </details>)}
                        </div>)}

                      {signature.blockchainTxHash && (<div>
                          <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                            Blockchain Anchor
                          </div>
                          <a href={"".concat(BLOCKCHAIN_EXPLORER_TX_BASE).concat(signature.blockchainTxHash)} target="_blank" rel="noopener noreferrer" style={{
                            fontSize: '11px',
                            fontFamily: 'monospace',
                            color: '#2196f3',
                            textDecoration: 'none'
                        }}>
                            {signature.blockchainTxHash.substring(0, 20)}... ↗
                          </a>
                        </div>)}
                    </div>
                  </div>

                  {/* Revocation Reason */}
                  {signature.status === 'REVOKED' && signature.revocationReason && (<div style={{
                            marginTop: '16px',
                            background: '#ffebee',
                            padding: '12px',
                            borderRadius: '6px'
                        }}>
                      <div style={{ fontSize: '12px', color: '#c62828', fontWeight: 'bold', marginBottom: '4px' }}>
                        Revocation Reason:
                      </div>
                      <div style={{ fontSize: '13px', color: '#c62828' }}>
                        {signature.revocationReason}
                      </div>
                    </div>)}

                  {/* Action Buttons */}
                  <div style={{ marginTop: '20px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    {signature.status !== 'REVOKED' && (<button onClick={function () { return handleVerify(signature.id); }} disabled={verifying === signature.id} style={{
                            padding: '8px 16px',
                            background: verifying === signature.id ? '#ccc' : '#2196f3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: verifying === signature.id ? 'not-allowed' : 'pointer',
                            fontSize: '13px'
                        }}>
                        {verifying === signature.id ? 'Verifying...' : '🔍 Verify Signature'}
                      </button>)}
                  </div>
                </div>
              </div>);
            })}
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
