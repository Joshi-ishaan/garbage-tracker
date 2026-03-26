import { useState, useEffect } from "react";
import QRScanner from "./components/QRScanner";
import AdminDashboard from "./components/AdminDashboard";
import Login from "./components/Login";
import { supabase } from "./lib/supabase";

function App() {
  const [view, setView] = useState("scanner");

  // 🔐 Auth
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

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
      fetchRole(data.user.id);
    }
  }

  async function fetchRole(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    setRole(data?.role);
  }

  const handleLogin = (loggedUser) => {
    setUser(loggedUser);
    fetchRole(loggedUser.id);
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

  // 📸 Handle QR scan (🔥 FIXED HERE)
  const handleScan = async (qrValue) => {
    setStatus("Processing...");

    const { data: point, error } = await supabase
      .from("pickup_points")
      .select("*")
      .eq("id", qrValue)   // ✅ FIX: ID based match
      .single();

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

        // 🚨 Too far → fraud
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

  // 💾 Save log
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
      },
    ]);
  };

  // 🔐 Login screen
  if (!user) {
    return <Login onLogin={handleLogin} />;
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
          }}
        >
          Logout
        </button>
      </div>

      {/* 👷 Driver */}
      {view === "scanner" && role === "driver" && (
        <>
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