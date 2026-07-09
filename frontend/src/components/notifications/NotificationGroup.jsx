function NotificationGroup({ title, children, count }) {
  if (!children || (Array.isArray(children) && children.length === 0)) {
    return null;
  }

  return (
    <div className="notification-group">
      <div className="notification-group-header">
        <h5 className="notification-group-title">{title}</h5>
        {count !== undefined && (
          <span className="notification-group-count">{count}</span>
        )}
      </div>
      <div className="notification-group-list">
        {children}
      </div>
    </div>
  );
}

export default NotificationGroup;
