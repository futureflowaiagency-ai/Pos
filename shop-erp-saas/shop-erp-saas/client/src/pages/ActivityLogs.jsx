import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import api from '../api/axios.js';
import DataTable from '../components/ui/DataTable.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { fmtDateTime } from '../utils/format.js';

export default function ActivityLogs() {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/activity-logs');
      setLogs(data.data.logs);
    })();
  }, []);

  if (!logs) return <Spinner />;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2"><Activity size={24} /> Activity Logs</h1>
      <DataTable
        columns={[
          { key: 'createdAt', label: 'Time', render: (r) => fmtDateTime(r.createdAt) },
          { key: 'user', label: 'User', render: (r) => r.user?.name || '—' },
          { key: 'action', label: 'Action', render: (r) => <span className="badge bg-brand-50 text-brand-600 dark:bg-brand-600/20 dark:text-brand-100">{r.action}</span> },
          { key: 'entity', label: 'Entity' },
        ]}
        rows={logs}
        empty="No activity recorded yet"
      />
    </div>
  );
}
