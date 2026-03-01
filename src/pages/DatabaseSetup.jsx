export default function DatabaseSetup() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
      <div className="card" style={{ maxWidth: '600px' }}>
        <h2>Database Setup Required</h2>
        <p>Please run the SQL scripts in Supabase SQL Editor to create tables.</p>
        <div style={{ marginTop: '20px' }}>
          <h4>Required SQL Files:</h4>
          <ul>
            <li>database-setup.sql</li>
            <li>database-tables.sql</li>
            <li>database-auth.sql (NEW - for auth & organisations)</li>
          </ul>
        </div>
        <div style={{ marginTop: '20px' }}>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Refresh After Setup
          </button>
        </div>
      </div>
    </div>
  );
}
