"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DashboardSkeleton;
require("../skeleton.css");
function DashboardSkeleton(_a) {
    var _b = _a.variant, variant = _b === void 0 ? 'default' : _b;
    return (<div className="dashboard">
      {/* Title skeleton */}
      <div className="skeleton skeleton-title" style={{ width: '300px', height: '32px', marginBottom: '24px' }}></div>

      {/* User info card skeleton */}
      <div className="dashboard-card" style={{ marginBottom: '24px' }}>
        <div className="skeleton skeleton-text" style={{ width: '150px', height: '24px', marginBottom: '16px' }}></div>
        <div style={{ textAlign: 'left' }}>
          <div className="skeleton skeleton-text" style={{ width: '70%', height: '16px', marginBottom: '12px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '60%', height: '16px', marginBottom: '12px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '50%', height: '16px', marginBottom: '12px' }}></div>
          <div className="skeleton skeleton-text" style={{ width: '55%', height: '16px' }}></div>
        </div>
      </div>

      {/* Dashboard grid skeleton */}
      <div className="dashboard-grid">
        {/* Card 1 */}
        <div className="dashboard-card">
          <div className="skeleton skeleton-text" style={{ width: '150px', height: '24px', marginBottom: '16px' }}></div>
          <ul className="card-list">
            {[1, 2, 3, 4, 5].map(function (i) { return (<li key={i} style={{ padding: '12px 0' }}>
                <div className="skeleton skeleton-text" style={{ width: '80%', height: '16px', marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '60%', height: '14px' }}></div>
              </li>); })}
          </ul>
        </div>

        {/* Card 2 */}
        <div className="dashboard-card">
          <div className="skeleton skeleton-text" style={{ width: '170px', height: '24px', marginBottom: '16px' }}></div>
          <ul className="card-list">
            {[1, 2, 3, 4, 5].map(function (i) { return (<li key={i} style={{ padding: '12px 0' }}>
                <div className="skeleton skeleton-text" style={{ width: '75%', height: '16px', marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '55%', height: '14px' }}></div>
              </li>); })}
          </ul>
        </div>

        {/* Card 3 */}
        <div className="dashboard-card">
          <div className="skeleton skeleton-text" style={{ width: '140px', height: '24px', marginBottom: '16px' }}></div>
          <ul className="card-list">
            {[1, 2, 3, 4, 5].map(function (i) { return (<li key={i} style={{ padding: '12px 0' }}>
                <div className="skeleton skeleton-text" style={{ width: '70%', height: '16px', marginBottom: '8px' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '65%', height: '14px' }}></div>
              </li>); })}
          </ul>
        </div>

        {/* Additional card for admin/manager/security variants */}
        {(variant === 'admin' || variant === 'manager' || variant === 'security' || variant === 'compliance') && (<div className="dashboard-card">
            <div className="skeleton skeleton-text" style={{ width: '160px', height: '24px', marginBottom: '16px' }}></div>
            <ul className="card-list">
              {[1, 2, 3].map(function (i) { return (<li key={i} style={{ padding: '12px 0' }}>
                  <div className="skeleton skeleton-text" style={{ width: '65%', height: '16px', marginBottom: '8px' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '50%', height: '14px' }}></div>
                </li>); })}
            </ul>
          </div>)}
      </div>
    </div>);
}
