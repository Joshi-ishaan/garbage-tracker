import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [points, setPoints] = useState([]);
  const [filter, setFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: pointsData } = await supabase
      .from("pickup_points")
      .select("*");

    const { data: logsData } = await supabase
      .from("scan_logs")
      .select(`
        *,
        pickup_points(name)
      `)
      .order("start_time", { ascending: false });

    setPoints(pointsData || []);
    setLogs(logsData || []);
  }

  // 🔍 Filter
  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.start_time)
      .toISOString()
      .split("T")[0];

    if (selectedDate && logDate !== selectedDate) return false;

    if (filter === "valid") return log.reason === "valid";
    if (filter === "fraud") return log.reason !== "valid";

    return true;
  });

  // 📊 Stats
  const totalPoints = points.length;

  const visitedIds = new Set(
    filteredLogs
      .filter((l) => l.reason === "valid")
      .map((l) => l.pickup_point_id)
  );

  const visited = visitedIds.size;
  const missed = totalPoints - visited;

  const fraudCount = filteredLogs.filter((l) => l.reason !== "valid").length;

  // 📍 Lists
  const visitedLocations = points.filter((p) =>
    visitedIds.has(p.id)
  );

  const missedLocations = points.filter((p) =>
    !visitedIds.has(p.id)
  );

  // 👷 Driver Analytics
  const driverStats = {};

  logs.forEach((log) => {
    const userId = log.user_id || "unknown";

    if (!driverStats[userId]) {
      driverStats[userId] = {
        total: 0,
        valid: 0,
        fraud: 0,
      };
    }

    driverStats[userId].total++;

    if (log.reason === "valid") {
      driverStats[userId].valid++;
    } else {
      driverStats[userId].fraud++;
    }
  });

  const driverList = Object.entries(driverStats);

  return (
    <div className="container">
      <h2>📊 Admin Dashboard</h2>

      {/* 📅 Date Filter */}
      <div style={{ marginBottom: "10px" }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <button onClick={() => setSelectedDate("")}>
          Clear Date
        </button>
      </div>

      {/* 🔘 Filters */}
      <div style={{ marginBottom: "15px" }}>
        <button onClick={() => setFilter("all")}>All</button>
        <button onClick={() => setFilter("valid")}>Valid</button>
        <button onClick={() => setFilter("fraud")}>Fraud</button>
      </div>

      {/* 📊 Stats */}
      <div className="stats">
        <div className="card">Total Locations: {totalPoints}</div>
        <div className="card">Visited Locations: {visited}</div>
        <div className="card">Missed Locations: {missed}</div>
        <div className="card">Fraudulent Scans: {fraudCount}</div>
      </div>

      
      {/* 📋 Logs */}
      <h3>📋 Scan Logs</h3>

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Location</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>

        <tbody>
          {filteredLogs.map((log) => (
            <tr key={log.id}>
              <td>{log.user_id}</td>
              <td>{log.pickup_points?.name || "Unknown"}</td>
              <td>
                {log.reason === "valid"
                  ? "🟢 Valid"
                  : log.reason === "too_far"
                  ? "🔴 Too Far"
                  : "⚠️ Left Early"}
              </td>
              <td>
                {new Date(log.start_time).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 👷 Driver Analytics */}
      <h3 style={{ marginTop: "30px" }}>👷 Driver Performance</h3>

      <table>
        <thead>
          <tr>
            <th>Driver</th>
            <th>Total</th>
            <th>Valid</th>
            <th>Fraud</th>
          </tr>
        </thead>

        <tbody>
          {driverList.map(([id, stats]) => (
            <tr key={id}>
              <td>{id}</td>
              <td>{stats.total}</td>
              <td>{stats.valid}</td>
              <td style={{ color: stats.fraud > 3 ? "red" : "white" }}>
                {stats.fraud}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* 📍 Total Locations */}
      <h3>📍 Total Locations</h3>
      <ul>
        {points.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

      {/* 🟢 Visited */}
      <h3>🟢 Visited Locations</h3>
      <ul>
        {visitedLocations.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

      {/* 🔴 Missed */}
      <h3>🔴 Missed Locations</h3>
      <ul>
        {missedLocations.map((p) => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>

    </div>
  );
}