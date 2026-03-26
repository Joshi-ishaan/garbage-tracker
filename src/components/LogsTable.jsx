// components/LogsTable.jsx
export default function LogsTable({ logs }) {
  return (
    <div className="bg-white p-4 shadow rounded">
      <table className="w-full text-sm">

        <thead>
          <tr className="text-left border-b">
            <th>Driver</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b">

              <td>{log.user_id}</td>

              <td>
                {log.is_valid ? "Valid" : log.reason}
              </td>

              <td>{log.start_time}</td>

            </tr>
          ))}
        </tbody>

      </table>
    </div>
  );
}