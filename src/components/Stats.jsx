// components/Stats.jsx
export default function Stats({ stats }) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">

      <div className="bg-white p-4 shadow rounded">
        <p>Total</p>
        <h2>{stats.total}</h2>
      </div>

      <div className="bg-white p-4 shadow rounded">
        <p>Visited</p>
        <h2>{stats.visited}</h2>
      </div>

      <div className="bg-white p-4 shadow rounded">
        <p>Missed</p>
        <h2>{stats.missed}</h2>
      </div>

      <div className="bg-white p-4 shadow rounded">
        <p>Fraud</p>
        <h2>{stats.fraud}</h2>
      </div>

      

    </div>
  );
}