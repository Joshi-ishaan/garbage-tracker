import { useState, useEffect } from "react";
import QRScanner from "./components/QRScanner";
import AdminDashboard from "./components/AdminDashboard";
import Login from "./components/Login";
import VehicleNumberEntry from "./components/VehicleNumberEntry";
import { supabase } from "./lib/supabase";

function App() {
  const [view, setView] = useState("scanner");

  // 🔐 Auth
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  // 🚛 Vehicle tracking states
  const [needsVehicleEntry, setNeedsVehicleEntry] = useState(false);
  const [vehicleNumber, setVehicleNumber] = useState(null);
  const [assignedSpots, setAssignedSpots] = useState([]);

  // 📊 Scanner states
  const [status, setStatus] = useState("");
  const [timer, setTimer] = useState(0);
  const [isInside, setIsInside] = useState(true);
  const [watchId, setWatchId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [coords, setCoords] = useState(null);

  // 🔐 Check logged-in user
  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data } = await supabase.auth.getUser();

    if (data?.user) {
      setUser(data.user);
      await fetchRoleAndVehicle(data.user.id);
    }
  }

  async function fetchRoleAndVehicle(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("role, vehicle_number")
      .eq("id", userId)
      .single();

    setRole(data?.role);

    // If driver and no vehicle number, show vehicle entry
    if (data?.role === "driver" && !data?.vehicle_number) {
      setNeedsVehicleEntry(true);
      setView("vehicleEntry");
    } 
    // If driver has vehicle number, load assigned spots
    else if (data?.role === "driver" && data?.vehicle_number) {
      setVehicleNumber(data.vehicle_number);
      await loadAssignedSpots(data.vehicle_number);
      setNeedsVehicleEntry(false);
    }
  }

  async function loadAssignedSpots(vehicleNum) {
    const { data } = await supabase
      .from("vehicle_routes")
      .select(`
        pickup_points (
          id, 
          name, 
          latitude, 
          longitude
        )
      `)
      .eq("vehicle_number", vehicleNum)
      .order("stop_order", { ascending: true });
    
    const spots = data?.map(item => item.pickup_points) || [];
    setAssignedSpots(spots);
    
    // Optional: Show assigned spots count in console
    console.log(`✅ Loaded ${spots.length} assigned spots for vehicle ${vehicleNum}`);
  }

  const handleVehicleVerified = async (info) => {
    setVehicleNumber(info.vehicleNumber);
    setAssignedSpots(info.assignedSpots);
    setNeedsVehicleEntry(false);
    setView("scanner");
    
    // Refresh the page state
    alert(`✅ Vehicle ${info.vehicleNumber} verified! You can now scan assigned pickup points.`);
  };

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    fetchRoleAndVehicle(loggedUser.id);
  };

  // 📏 Distance function
  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // 📸 Handle QR scan (MODIFIED to check assigned spots)
  const handleScan = async (qrValue) => {
    setStatus("Processing...");

    // 🔥 NEW: Check if scanned point is assigned to this vehicle
    const isAssigned = assignedSpots.some(spot => spot.id === qrValue.trim());
    
    if (!isAssigned && assignedSpots.length > 0) {
      setStatus(`❌ This pickup point is not assigned to vehicle ${vehicleNumber}`);
      setTimeout(() => setStatus(""), 3000);
      return;
    }

    const { data: point, error } = await supabase
      .from("pickup_points")
      .select("*")
      .eq("id", qrValue.trim())
      .single();
      
    console.log("Scanned QR:", qrValue, "Matched Point:", point, "Error:", error);

    if (error || !point) {
      setStatus("❌ Invalid QR");
      return;
    }

    setCurrentPoint(point);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setCoords({ lat, lng });

        const distance = getDistance(
          lat,
          lng,
          Number(point.latitude),
          Number(point.longitude)
        );

        // 🚨 Too far → fraud (with vehicle number)
        if (distance > 30) {
          setStatus("❌ Too far from location");

          await supabase.from("scan_logs").insert([
            {
              user_id: user.id,
              pickup_point_id: point.id,
              scanned_lat: lat,
              scanned_lng: lng,
              start_time: new Date().toISOString(),
              end_time: new Date().toISOString(),
              is_valid: false,
              reason: "too_far",
              vehicle_number: vehicleNumber, // NEW: Store vehicle number
            },
          ]);

          return;
        }

        // ✅ Start timer
        setStartTime(new Date());
        setTimer(60);
        setIsInside(true);
        setStatus("Stay here... ⏳");

        const id = navigator.geolocation.watchPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;

            setCoords({ lat, lng });

            const distance = getDistance(
              lat,
              lng,
              Number(point.latitude),
              Number(point.longitude)
            );

            if (distance > 30) {
              setIsInside(false);
              setStatus("❌ Left location!");
            }
          },
          (err) => console.error(err),
          { enableHighAccuracy: true }
        );

        setWatchId(id);
      },
      (err) => {
        console.error(err);
        setStatus("❌ GPS Error");
      },
      { enableHighAccuracy: true }
    );
  };

  // ⏱️ Timer
  useEffect(() => {
    if (timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // ⏱️ Timer end
  useEffect(() => {
    if (timer === 0 && startTime) {
      navigator.geolocation.clearWatch(watchId);

      const endTime = new Date();

      if (isInside) {
        setStatus("✅ Clear to go");
      } else {
        setStatus("❌ Invalid (left early)");
      }

      saveLog(endTime);
    }
  }, [timer]);

  // 💾 Save log (MODIFIED to include vehicle_number)
  const saveLog = async (endTime) => {
    if (!currentPoint || !coords) return;

    await supabase.from("scan_logs").insert([
      {
        user_id: user.id,
        pickup_point_id: currentPoint.id,
        scanned_lat: coords.lat,
        scanned_lng: coords.lng,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        is_valid: isInside,
        reason: isInside ? "valid" : "left_early",
        vehicle_number: vehicleNumber, // NEW: Store vehicle number
      },
    ]);
  };

  // 🔐 Login screen
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // 🚛 Vehicle Entry Screen (NEW)
  if (needsVehicleEntry && role === "driver") {
    return <VehicleNumberEntry user={user} onVehicleVerified={handleVehicleVerified} />;
  }

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
      <h1>Garbage Van Tracker MVP</h1>

      {/* 🔘 Navigation */}
      <div>
        {role === "driver" && (
          <button onClick={() => setView("scanner")}>Scanner</button>
        )}

        {role === "admin" && (
          <button onClick={() => setView("admin")}>Admin</button>
        )}

        <button
          onClick={async () => {
            await supabase.auth.signOut();
            setUser(null);
            setRole(null);
            setVehicleNumber(null);
            setNeedsVehicleEntry(false);
          }}
        >
          Logout
        </button>
      </div>

      {/* 👷 Driver */}
      {view === "scanner" && role === "driver" && (
        <>
          {/* Show assigned spots info */}
          {assignedSpots.length > 0 && (
            <div style={{ 
              backgroundColor: "#1e293b", 
              padding: "10px", 
              borderRadius: "8px",
              marginBottom: "10px"
            }}>
              <strong>🚛 Vehicle: {vehicleNumber}</strong>
              <div style={{ fontSize: "14px", marginTop: "5px" }}>
                📍 Assigned Pickup Points: {assignedSpots.length}
                <details>
                  <summary style={{fontSize:'18px', marginTop:'15px'}}>View list</summary>
                  <ul style={{ marginTop: "5px", paddingLeft: "20px" }}>
                    {assignedSpots.map((spot, idx) => (
                      <li key={spot.id}>{idx + 1}. {spot.name}</li>
                    ))}
                  </ul>
                </details>
              </div>
            </div>
          )}
          
          {!status && <QRScanner onScanSuccess={handleScan} />}

          {status && (
            <div>
              <h2>{status}</h2>
              {timer > 0 && <h3>{timer}s</h3>}
              <button onClick={() => window.location.reload()}>
                Scan Again
              </button>
            </div>
          )}
        </>
      )}

      {/* 👨‍💼 Admin */}
      {view === "admin" && role === "admin" && <AdminDashboard />}
    </div>
  );
}

export default App;