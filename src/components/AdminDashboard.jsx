import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import QRCodeCard from "./QRCodeCard";
import html2canvas from "html2canvas";
import "../App.css";

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [points, setPoints] = useState([]);
  const [profiles, setProfiles] = useState({}); // ✅ name map
  const [filter, setFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");

  // 🔹 driver form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [driverName, setDriverName] = useState("");

  // 🔹 location form
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [selectedPoint, setSelectedPoint] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // ✅ pickup points
    const { data: pointsData } = await supabase
      .from("pickup_points")
      .select("*");

    // ✅ logs (UNCHANGED — safe)
    const { data: logsData } = await supabase
      .from("scan_logs")
      .select(`
        *,
        pickup_points(name)
      `)
      .order("start_time", { ascending: false });

    // ✅ profiles separately (SAFE)
    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, name");

    const profileMap = {};
    profileData?.forEach((p) => {
      profileMap[p.id] = p.name;
    });

    setProfiles(profileMap);
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

  // 👷 Driver Analytics (SAFE)
  const driverStats = {};

  logs.forEach((log) => {
    const driver = profiles[log.user_id] || log.user_id;

    if (!driverStats[driver]) {
      driverStats[driver] = {
        total: 0,
        valid: 0,
        fraud: 0,
      };
    }

    driverStats[driver].total++;

    if (log.reason === "valid") {
      driverStats[driver].valid++;
    } else {
      driverStats[driver].fraud++;
    }
  });

  const driverList = Object.entries(driverStats);

  // ✅ QR DOWNLOAD
  const downloadQR = async (id) => {
  const element = document.getElementById(`qr-${id}`);

  if (!element) {
    alert("QR not found");
    return;
  }

  const canvas = await html2canvas(element);

  const link = document.createElement("a");
  link.download = `qr-${id}.png`;
  link.href = canvas.toDataURL();
  link.click();
};

 

  // ✅ ADD DRIVER (FIXED)
  async function addDriver() {
    if (!email || !password || !driverName) {
      alert("Fill all fields");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    await supabase.from("profiles").insert([
      {
        id: data.user.id,
        role: "driver",
        name: driverName,
      },
    ]);

    alert("Driver created!");
    setEmail("");
    setPassword("");
    setDriverName("");
  }

  // ✅ ADD LOCATION
  async function addPoint() {
    if (!name || !lat || !lng) {
      alert("Fill all fields");
      return;
    }

    const { data, error } = await supabase
      .from("pickup_points")
      .insert([
        {
          name,
          latitude: parseFloat(lat),
          longitude: parseFloat(lng),
        },
      ])
      .select()
      .single();

    if (!error) {
      setSelectedPoint(data);
      setName("");
      setLat("");
      setLng("");
      fetchData();
    }
  }

  // ✅ FIND QR
  const findQR = () => {
    const found = points.find(
      (p) =>
        Number(p.latitude) === Number(lat) &&
        Number(p.longitude) === Number(lng)
    );

    if (found) setSelectedPoint(found);
    else alert("Location not found");
  };

  return (
    <div className="container">
      <h2>📊 Admin Dashboard</h2>

      {/* 📅 Date Filter */}
      <h3>Filter by Date</h3>
      <input
        type="date"
        value={selectedDate}
        onChange={(e) => setSelectedDate(e.target.value)}
      />

      {/* 🔘 Filters */}
      <div className="filterButtons">
  <button className ={`filterBtn ${filter === "all" ? "activeFilter" : ""}`}
  onClick={() => setFilter("all")}>
    Display All
  </button>

  <button className ={`filterBtn ${filter === "valid" ? "activeFilter" : ""}`}
  onClick={() => setFilter("valid")}>
    Valid Scans
  </button>

  <button className ={`filterBtn ${filter === "fraud" ? "activeFilter" : ""}`}
  onClick={() => setFilter("fraud")}>
    Fraud Scans
  </button>
</div>

      {/* 📊 Stats */}
      <div className = "statsBox">
        <h3>Statistics:</h3>
        <div>Total Locations: {totalPoints}</div>
        <div>Visited: {visited}</div>
        <div>Missed: {missed}</div>
        <div>Fraud: {fraudCount}</div>
      </div>

      {/* 📋 Logs */}
      <h3>📋 Scan Logs</h3>
      <table>
        <tbody>
          {filteredLogs.map((log) => (
            <tr key={log.id}>
              <td>{profiles[log.user_id] || log.user_id}</td>
              <td>{log.pickup_points?.name}</td>
              <td>{log.reason}</td>
              <td>{new Date(log.start_time).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 📍 Location Lists */}
      <h3>📍 Total Locations</h3>
      <ul>{points.map((p) => <li key={p.id}>{p.name}</li>)}</ul>

      <h3>🟢 Visited Locations</h3>
      <ul>{visitedLocations.map((p) => <li key={p.id}>{p.name}</li>)}</ul>

      <h3>🔴 Missed Locations</h3>
      <ul>{missedLocations.map((p) => <li key={p.id}>{p.name}</li>)}</ul>

      {/* ➕ ADD DRIVER */}
      <h3>➕ Add Driver</h3>
      <input placeholder="Name" value={driverName} onChange={(e) => setDriverName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={addDriver}>Create Driver</button>

      {/* 📍 QR */}
      <h3>📍 Add / Get QR</h3>
      <input
        placeholder="Enter Location Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        placeholder="Enter Latitude (e.g. 28.6139)"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
      />

      <input
        placeholder="Enter Longitude (e.g. 77.2090)"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
      />

      <button onClick={addPoint}>Add + QR</button>
      <button onClick={findQR}>Get QR</button>

      {selectedPoint && (
        <div>
          <QRCodeCard point={selectedPoint} />
          <button onClick={() => downloadQR(selectedPoint.id)}>Download</button>
          {/* <button onClick={() => printQR(selectedPoint.id)}>Print</button> */}
        </div>
      )}
    </div>
  );
}