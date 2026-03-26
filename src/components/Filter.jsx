// components/Filter.jsx
export default function Filter({ setFilter }) {
  return (
    <select
      onChange={(e) => setFilter(e.target.value)}
      className="mb-4 p-2 border rounded"
    >
      <option value="all">All</option>
      <option value="valid">Valid</option>
      <option value="fraud">Fraud</option>
    </select>
  );
}