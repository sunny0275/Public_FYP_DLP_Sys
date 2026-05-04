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
exports.default = FlowStatisticsPage;
var react_1 = require("react");
var api_1 = require("../../api");
var DashboardLayout_1 = require("../../components/DashboardLayout");
function FlowStatisticsPage() {
    var _this = this;
    var _a = (0, react_1.useState)(null), stats = _a[0], setStats = _a[1];
    var _b = (0, react_1.useState)(true), loading = _b[0], setLoading = _b[1];
    var _c = (0, react_1.useState)(''), error = _c[0], setError = _c[1];
    var _d = (0, react_1.useState)(30), periodFilter = _d[0], setPeriodFilter = _d[1];
    (0, react_1.useEffect)(function () {
        loadStatistics();
    }, [periodFilter]);
    var loadStatistics = function () { return __awaiter(_this, void 0, void 0, function () {
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
                    return [4 /*yield*/, api_1.apiClient.getWorkflowStatistics(null, periodFilter)];
                case 2:
                    response = _c.sent();
                    setStats(response.data);
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _c.sent();
                    setError(((_b = (_a = err_1.response) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.message) || 'Failed to load statistics');
                    return [3 /*break*/, 5];
                case 4:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    if (loading) {
        return (<DashboardLayout_1.default>
        <div style={{ padding: '60px', textAlign: 'center' }}>
          <p>Loading statistics...</p>
        </div>
      </DashboardLayout_1.default>);
    }
    if (error) {
        return (<DashboardLayout_1.default>
        <div style={{ padding: '24px' }}>
          <div style={{
                background: '#ffebee',
                padding: '20px',
                borderRadius: '8px',
                color: '#c62828'
            }}>
            {error}
          </div>
        </div>
      </DashboardLayout_1.default>);
    }
    if (!stats)
        return null;
    return (<DashboardLayout_1.default>
      <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px'
        }}>
          <div>
            <h1 style={{ fontSize: '28px', margin: 0 }}>Workflow Statistics</h1>
            <p style={{ fontSize: '14px', color: '#666', marginTop: '4px' }}>
              Period: {stats.period}
            </p>
          </div>

          {/* Period Filter */}
          <select value={periodFilter || 'all'} onChange={function (e) { return setPeriodFilter(e.target.value === 'all' ? null : parseInt(e.target.value)); }} style={{
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '14px'
        }}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </div>

        {/* Summary Cards */}
        <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginBottom: '30px'
        }}>
          <StatCard title="Total Workflows" value={stats.totalWorkflows.toString()} icon="📊" color="#2196f3"/>
          <StatCard title="Average Duration" value={"".concat(stats.averageDurationDays, " days")} icon="⏱️" color="#ff9800"/>
          <StatCard title="Approval Rate" value={"".concat(stats.approvalRate, "%")} icon="✓" color="#4caf50"/>
          <StatCard title="Completion Rate" value={"".concat(stats.completionRate, "%")} icon="🎯" color="#9c27b0"/>
        </div>

        {/* Status Breakdown */}
        <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            marginBottom: '30px'
        }}>
          <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Workflow Status Breakdown</h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px'
        }}>
            <StatusCard label="Completed" count={stats.completedWorkflows} total={stats.totalWorkflows} color="#4caf50"/>
            <StatusCard label="Running" count={stats.runningWorkflows} total={stats.totalWorkflows} color="#2196f3"/>
            <StatusCard label="Cancelled" count={stats.cancelledWorkflows} total={stats.totalWorkflows} color="#f44336"/>
          </div>
        </div>

        {/* Template Performance */}
        {stats.byTemplate.length > 0 && (<div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '30px'
            }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Performance by Template</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600' }}>Template</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Total</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Avg Duration</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Approval Rate</th>
                  <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {stats.byTemplate.map(function (template) { return (<tr key={template.templateId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{template.templateName}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{template.totalWorkflows}</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>{template.avgDurationDays} days</td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    background: template.approvalRate >= 80 ? '#e8f5e9' : template.approvalRate >= 60 ? '#fff3cd' : '#ffebee',
                    color: template.approvalRate >= 80 ? '#2e7d32' : template.approvalRate >= 60 ? '#856404' : '#c62828',
                    fontWeight: 'bold',
                    fontSize: '12px'
                }}>
                        {template.approvalRate}%
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '12px' }}>
                      <span style={{ color: '#4caf50' }}>✓ {template.completedCount}</span>
                      {' | '}
                      <span style={{ color: '#2196f3' }}>● {template.runningCount}</span>
                      {' | '}
                      <span style={{ color: '#f44336' }}>✗ {template.cancelledCount}</span>
                    </td>
                  </tr>); })}
              </tbody>
            </table>
          </div>)}

        {/* Department Performance */}
        {stats.byDepartment.length > 0 && (<div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                marginBottom: '30px'
            }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Performance by Department</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {stats.byDepartment.map(function (dept) { return (<div key={dept.department} style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid #e0e0e0'
                }}>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                    {dept.department}
                  </div>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    <div style={{ marginBottom: '4px' }}>Total: <strong>{dept.totalWorkflows}</strong></div>
                    <div style={{ marginBottom: '4px' }}>Avg Duration: <strong>{dept.avgDurationDays} days</strong></div>
                    <div>Approval Rate: <strong>{dept.approvalRate}%</strong></div>
                  </div>
                </div>); })}
            </div>
          </div>)}

        {/* Trends Chart (Simple Bar Chart) */}
        {stats.trends.length > 0 && (<div style={{
                background: 'white',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}>
            <h2 style={{ fontSize: '20px', marginBottom: '20px' }}>Workflow Trends (Last 30 Days)</h2>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', gap: '4px', minWidth: '600px', alignItems: 'flex-end', height: '200px' }}>
                {stats.trends.slice(-14).map(function (trend, index) {
                var maxValue = Math.max.apply(Math, __spreadArray(__spreadArray([], stats.trends.map(function (t) { return t.started + t.completed + t.cancelled; }), false), [1], false));
                var totalHeight = ((trend.started + trend.completed + trend.cancelled) / maxValue) * 180;
                return (<div key={index} style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                      <div style={{
                        width: '100%',
                        height: "".concat(totalHeight, "px"),
                        background: "linear-gradient(to top, #4caf50 0%, #4caf50 ".concat((trend.completed / (trend.started + trend.completed + trend.cancelled)) * 100, "%, #2196f3 ").concat((trend.completed / (trend.started + trend.completed + trend.cancelled)) * 100, "%, #2196f3 100%)"),
                        borderRadius: '4px 4px 0 0',
                        position: 'relative',
                        minHeight: '2px'
                    }} title={"Started: ".concat(trend.started, ", Completed: ").concat(trend.completed, ", Cancelled: ").concat(trend.cancelled)}/>
                      <div style={{ fontSize: '10px', color: '#666', transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>
                        {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>);
            })}
              </div>
              <div style={{ display: 'flex', gap: '16px', marginTop: '30px', justifyContent: 'center', fontSize: '13px' }}>
                <div><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#4caf50', marginRight: '4px' }}></span> Completed</div>
                <div><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#2196f3', marginRight: '4px' }}></span> Started</div>
                <div><span style={{ display: 'inline-block', width: '12px', height: '12px', background: '#f44336', marginRight: '4px' }}></span> Cancelled</div>
              </div>
            </div>
          </div>)}
      </div>
    </DashboardLayout_1.default>);
}
// Helper Components
function StatCard(_a) {
    var title = _a.title, value = _a.value, icon = _a.icon, color = _a.color;
    return (<div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            borderLeft: "4px solid ".concat(color)
        }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: '#666', fontWeight: '500' }}>{title}</div>
        <div style={{ fontSize: '24px' }}>{icon}</div>
      </div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: color }}>{value}</div>
    </div>);
}
function StatusCard(_a) {
    var label = _a.label, count = _a.count, total = _a.total, color = _a.color;
    var percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return (<div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '36px', fontWeight: 'bold', color: color, marginBottom: '8px' }}>
        {count}
      </div>
      <div style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>{label}</div>
      <div style={{ background: '#f0f0f0', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: "".concat(percentage, "%"), transition: 'width 0.3s ease' }}/>
      </div>
      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>{percentage}%</div>
    </div>);
}
