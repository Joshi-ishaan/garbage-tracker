import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import QRCodeCard from "./QRCodeCard";
import html2canvas from "html2canvas";
import DriverPerformanceReport from "./DriverPerformanceReport";
import "../App.css";

export default function AdminDashboard() {
  const [logs, setLogs] = useState([]);
  const [points, setPoints] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [filter, setFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDriverForReport, setSelectedDriverForReport] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [driverName, setDriverName] = useState("");

  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [selectedPoint, setSelectedPoint] = useState(null);

  // Vehicle states
  const [vehicles, setVehicles] = useState([]);
  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    registration_number: '',
    make_model: ''
  });
  const [loading, setLoading] = useState(false);

  // Driver states
  const [drivers, setDrivers] = useState([]);
  
  // Spot Assignment states
  const [selectedVehicleForSpots, setSelectedVehicleForSpots] = useState("");
  const [selectedSpotsForRoute, setSelectedSpotsForRoute] = useState([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [existingAssignments, setExistingAssignments] = useState([]);
  const [allAssignments, setAllAssignments] = useState([]); // Add this state

  useEffect(() => {
    fetchData();
    loadVehicles();
    loadDrivers();
    loadAllAssignments(); // Add this
  }, []);

  useEffect(() => {
    if (selectedVehicleForSpots) {
      loadExistingAssignments();
    }
  }, [selectedVehicleForSpots]);

  async function fetchData() {
    const { data: pointsData } = await supabase
      .from("pickup_points")
      .select("*");

    const { data: logsData } = await supabase
      .from("scan_logs")
      .select(`*, pickup_points(name)`)
      .order("start_time", { ascending: false });

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, name, vehicle_number");

    const profileMap = {};
    profileData?.forEach((p) => {
      profileMap[p.id] = p.name;
    });

    setProfiles(profileMap);
    setPoints(pointsData || []);
    setLogs(logsData || []);
  }

  async function loadVehicles() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('registration_number');
      
      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error loading vehicles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDrivers() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, vehicle_number')
        .eq('role', 'driver');
      
      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  }

  async function loadAllAssignments() {
    const { data, error } = await supabase
      .from('vehicle_routes')
      .select(`
        id,
        vehicle_number,
        pickup_point_id,
        pickup_points (id, name)
      `);
    
    if (!error && data) {
      setAllAssignments(data);
    }
  }

  async function loadExistingAssignments() {
    if (!selectedVehicleForSpots) {
      setExistingAssignments([]);
      return;
    }
    
    const { data, error } = await supabase
      .from('vehicle_routes')
      .select(`
        id,
        stop_order,
        pickup_points (id, name)
      `)
      .eq('vehicle_number', selectedVehicleForSpots)
      .order('stop_order', { ascending: true });
    
    if (!error && data) {
      setExistingAssignments(data);
    } else {
      setExistingAssignments([]);
    }
  }

  async function assignSpotsToVehicle() {
    if (!selectedVehicleForSpots || selectedSpotsForRoute.length === 0) {
      alert("Please select a vehicle and at least one pickup point");
      return;
    }
    
    setRouteLoading(true);
    
    // Check if any selected spot is already assigned to another vehicle
    for (const spotId of selectedSpotsForRoute) {
      const { data: existingAssignment, error: checkError } = await supabase
        .from('vehicle_routes')
        .select('vehicle_number')
        .eq('pickup_point_id', spotId)
        .neq('vehicle_number', selectedVehicleForSpots)
        .single();
      
      if (existingAssignment) {
        alert(`❌ Spot is already assigned to vehicle ${existingAssignment.vehicle_number}. Cannot assign to ${selectedVehicleForSpots}`);
        setRouteLoading(false);
        return;
      }
    }
    
    // Get current max stop_order for this vehicle
    const { data: currentAssignments } = await supabase
      .from('vehicle_routes')
      .select('stop_order')
      .eq('vehicle_number', selectedVehicleForSpots)
      .order('stop_order', { ascending: false })
      .limit(1);
    
    let nextOrder = (currentAssignments && currentAssignments[0]) ? currentAssignments[0].stop_order + 1 : 1;
    
    // Insert new assignments (without deleting existing ones)
    const assignments = selectedSpotsForRoute.map((spotId) => ({
      vehicle_number: selectedVehicleForSpots,
      pickup_point_id: spotId,
      stop_order: nextOrder++
    }));
    
    const { error: insertError } = await supabase
      .from('vehicle_routes')
      .insert(assignments);
    
    if (insertError) {
      alert("Error assigning spots: " + insertError.message);
    } else {
      alert(`✅ Successfully assigned ${assignments.length} new spot(s) to ${selectedVehicleForSpots}`);
      setSelectedSpotsForRoute([]);
      await loadExistingAssignments();
      await loadAllAssignments();
      fetchData();
    }
    
    setRouteLoading(false);
  }

  async function removeSingleAssignment(routeId, spotName) {
    if (!confirm(`Remove "${spotName}" from ${selectedVehicleForSpots}?`)) {
      return;
    }
    
    const { error } = await supabase
      .from('vehicle_routes')
      .delete()
      .eq('id', routeId);
    
    if (error) {
      alert("Error removing assignment: " + error.message);
    } else {
      alert(`✅ Removed "${spotName}" from vehicle`);
      await loadExistingAssignments();
      await loadAllAssignments();
      fetchData();
    }
  }

  async function handleAddVehicle(e) {
    e.preventDefault();
    if (!newVehicle.registration_number) {
      alert("Registration number is required!");
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('vehicles')
        .insert([{ 
          registration_number: newVehicle.registration_number.toUpperCase(),
          make_model: newVehicle.make_model || null
        }]);
      
      if (error) throw error;
      
      setNewVehicle({
        registration_number: '',
        make_model: ''
      });
      setShowAddVehicle(false);
      await loadVehicles();
      alert('Vehicle added successfully!');
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert(error.message || 'Failed to add vehicle');
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteVehicle(id, registrationNumber) {
    if (!confirm(`Are you sure you want to delete vehicle ${registrationNumber}?`)) {
      return;
    }
    
    try {
      setLoading(true);
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      await loadVehicles();
      alert('Vehicle deleted successfully!');
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Failed to delete vehicle. Make sure it has no associated logs.');
    } finally {
      setLoading(false);
    }
  }

  // FILTER
  const filteredLogs = logs.filter((log) => {
    const logDate = new Date(log.start_time)
      .toISOString()
      .split("T")[0];

    if (selectedDate && logDate !== selectedDate) return false;
    if (filter === "valid") return log.reason === "valid";
    if (filter === "fraud") return log.reason !== "valid";

    return true;
  });

  // STATS
  const totalPoints = points.length;

  const visitedIds = new Set(
    filteredLogs
      .filter((l) => l.reason === "valid")
      .map((l) => l.pickup_point_id)
  );

  const visited = visitedIds.size;
  const missed = totalPoints - visited;
  const fraudCount = filteredLogs.filter((l) => l.reason !== "valid").length;

  const visitedLocations = points.filter((p) =>
    visitedIds.has(p.id)
  );

  const missedLocations = points.filter((p) =>
    !visitedIds.has(p.id)
  );

  // ADD DRIVER
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
    loadDrivers();
  }

  // ADD LOCATION
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

  // GET QR BY NAME
  const getQRByName = () => {
    if (!name) {
      alert("Enter location name");
      return;
    }

    const found = points.find((p) =>
      p.name.toLowerCase().includes(name.toLowerCase())
    );

    if (found) setSelectedPoint(found);
    else alert("Location not found");
  };

  // DOWNLOAD
  const downloadQR = async (id) => {
    const element = document.getElementById(`qr-${id}`);
    if (!element) return;

    const canvas = await html2canvas(element);
    const link = document.createElement("a");
    link.download = `qr-${id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  return (
    <div className="container">
      <h2>📊 Admin Dashboard</h2>

      <div className="vehicles-section">
        <div className="section-header">
          <h3 style={{ color: '#ffffff' }}>🚛 Vehicles Management</h3>
          <button 
            onClick={() => setShowAddVehicle(!showAddVehicle)}
            className="btn-primary"
            disabled={loading}
          >
            {showAddVehicle ? 'Cancel' : '+ Add Vehicle'}
          </button>
        </div>

        {showAddVehicle && (
          <form onSubmit={handleAddVehicle} className="add-vehicle-form">
            <input
              type="text"
              placeholder="Registration Number * (e.g., MH12AB1234)"
              value={newVehicle.registration_number}
              onChange={(e) => setNewVehicle({
                ...newVehicle,
                registration_number: e.target.value.toUpperCase()
              })}
              required
            />
            <input
              type="text"
              placeholder="Make/Model (e.g., Tata Ace)"
              value={newVehicle.make_model}
              onChange={(e) => setNewVehicle({
                ...newVehicle,
                make_model: e.target.value
              })}
            />
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Vehicle'}
            </button>
          </form>
        )}

        <div>
          {loading && !vehicles.length ? (
            <p>Loading vehicles...</p>
          ) : vehicles.length === 0 ? (
            <p>No vehicles added yet. Click "Add Vehicle" to get started.</p>
          ) : (
            <table className="vehicles-table">
              <thead>
                <tr>
                  <th>Registration Number</th>
                  <th>Make/Model</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(vehicle => (
                  <tr key={vehicle.id}>
                    <td><strong>{vehicle.registration_number}</strong></td>
                    <td>{vehicle.make_model || '-'}</td>
                    <td>
                      <span className={`status ${vehicle.is_active ? 'active' : 'inactive'}`}>
                        {vehicle.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button 
                        onClick={() => handleDeleteVehicle(vehicle.id, vehicle.registration_number)}
                        className="btn-danger"
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Assign Pickup Points to Vehicle Section */}
      <div className="vehicles-section" style={{ backgroundColor: '#1e293b' }}>
        <h3>🗺️ Assign Pickup Points to Vehicle</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#e2e8f0' }}>
            Select Vehicle:
          </label>
          <select 
            value={selectedVehicleForSpots}
            onChange={(e) => {
              setSelectedVehicleForSpots(e.target.value);
              setSelectedSpotsForRoute([]);
            }}
            style={{ 
              width: '100%', 
              padding: '10px', 
              borderRadius: '4px',
              border: '1px solid #334155',
              fontSize: '14px',
              backgroundColor: '#0f172a',
              color: '#e2e8f0'
            }}
          >
            <option value="">-- Select Vehicle Number --</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.registration_number}>
                {v.registration_number} - {v.make_model || 'No model'} 
                ({v.is_active ? 'Active' : 'Inactive'})
              </option>
            ))}
          </select>
        </div>
        
        {selectedVehicleForSpots && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: '#e2e8f0' }}>📋 Current Assignments for {selectedVehicleForSpots}:</h4>
              {existingAssignments.length === 0 ? (
                <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No spots assigned yet</p>
              ) : (
                <div className="tableContainer">
                  {existingAssignments.map((item, idx) => (
                    <div key={item.id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '8px',
                      borderBottom: '1px solid #334155',
                      color: '#e2e8f0'
                    }}>
                      <span>
                        <strong>{idx + 1}.</strong> {item.pickup_points?.name || 'Unknown'}
                      </span>
                      <button
                        onClick={() => removeSingleAssignment(item.id, item.pickup_points?.name)}
                        className="btn-danger"
                        style={{ padding: '4px 12px', fontSize: '12px' }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div>
              <h4 style={{ color: '#e2e8f0' }}>📌 Available Pickup Points:</h4>
              <div className="tableContainer">
                {points.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>No pickup points available. Add some first!</p>
                ) : (
                  points.map(spot => {
                    const assignment = allAssignments.find(a => a.pickup_point_id === spot.id);
                    const isAssignedToCurrent = assignment?.vehicle_number === selectedVehicleForSpots;
                    const isAssignedToOther = assignment && !isAssignedToCurrent;
                    const isSelected = selectedSpotsForRoute.includes(spot.id);
                    
                    return (
                      <label 
                        key={spot.id} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          padding: '8px',
                          marginBottom: '5px',
                          backgroundColor: isAssignedToCurrent ? '#1e3a5f' : (isAssignedToOther ? '#3d1e1e' : 'transparent'),
                          borderRadius: '4px',
                          cursor: (isAssignedToOther && !isSelected) ? 'not-allowed' : 'pointer',
                          opacity: (isAssignedToOther && !isSelected) ? 0.5 : 1,
                          color: '#e2e8f0'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected || isAssignedToCurrent}
                          onChange={async (e) => {
                            if (e.target.checked) {
                              if (isAssignedToOther) {
                                alert(`❌ "${spot.name}" is already assigned to vehicle ${assignment.vehicle_number}`);
                                return;
                              }
                              setSelectedSpotsForRoute([...selectedSpotsForRoute, spot.id]);
                            } else {
                              if (!isAssignedToCurrent) {
                                setSelectedSpotsForRoute(selectedSpotsForRoute.filter(id => id !== spot.id));
                              } else {
                                alert(`ℹ️ "${spot.name}" is already assigned to this vehicle. Use "Remove" button to unassign.`);
                              }
                            }
                          }}
                          disabled={isAssignedToOther && !isSelected}
                          style={{ marginRight: '10px' }}
                        />
                        <span style={{ flex: 1 }}>
                          {spot.name}
                          {isAssignedToCurrent && (
                            <span style={{ color: '#60a5fa', marginLeft: '10px', fontSize: '12px' }}>
                              ✓ Already assigned to this vehicle
                            </span>
                          )}
                          {isAssignedToOther && (
                            <span style={{ color: '#f87171', marginLeft: '10px', fontSize: '12px' }}>
                              ⚠️ Assigned to {assignment.vehicle_number}
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
            
            {selectedSpotsForRoute.length > 0 && (
              <div style={{ 
                marginTop: '15px', 
                padding: '10px', 
                backgroundColor: '#1e3a5f', 
                borderRadius: '4px' 
              }}>
                <strong style={{ color: '#e2e8f0' }}>Selected ({selectedSpotsForRoute.length}):</strong>
                <ul style={{ marginTop: '5px', marginBottom: '0', color: '#94a3b8' }}>
                  {selectedSpotsForRoute.map((spotId, idx) => {
                    const spot = points.find(p => p.id === spotId);
                    return <li key={spotId}>{idx + 1}. {spot?.name}</li>;
                  })}
                </ul>
              </div>
            )}
            
            <button 
              onClick={assignSpotsToVehicle}
              disabled={routeLoading || selectedSpotsForRoute.length === 0}
              className="btn-primary"
              style={{ 
                marginTop: '15px', 
                width: '100%',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#28a745'
              }}
            >
              {routeLoading ? 'Assigning...' : `Assign ${selectedSpotsForRoute.length} Spot(s) to ${selectedVehicleForSpots}`}
            </button>
          </>
        )}
      </div>

      {/* Driver Performance Section */}
      <div className="vehicles-section">
        <h3>👨‍✈️ Driver Performance Report</h3>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#e2e8f0' }}>
            Select Driver:
          </label>
          <select 
            value={selectedDriverForReport}
            onChange={(e) => setSelectedDriverForReport(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              borderRadius: '4px',
              border: '1px solid #334155',
              fontSize: '14px',
              backgroundColor: '#0f172a',
              color: '#e2e8f0'
            }}
          >
            <option value="">-- Select Driver --</option>
            {drivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.name} {driver.vehicle_number ? `(${driver.vehicle_number})` : '(No vehicle assigned)'}
              </option>
            ))}
          </select>
        </div>

        {selectedDriverForReport && (
          <DriverPerformanceReport 
            driver={drivers.find(d => d.id === selectedDriverForReport)} 
          />
        )}
      </div>

      <hr className="divider" />

      {/* ADD DRIVER */}
      <h3 style={{ color: '#e2e8f0' }}>➕ Add Driver</h3>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input 
          placeholder="Name" 
          value={driverName} 
          onChange={(e) => setDriverName(e.target.value)}
          style={{ padding: '8px', flex: 1, minWidth: '150px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
        />
        <input 
          placeholder="Email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '8px', flex: 1, minWidth: '150px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
        />
        <input 
          placeholder="Password" 
          type="password"
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px', flex: 1, minWidth: '150px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
        />
        <button onClick={addDriver} className="btn-primary">Create Driver</button>
      </div>

      {/* QR */}
      <h3 style={{ color: '#e2e8f0' }}>📍 Add / Get QR</h3>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
        <input 
          placeholder="Enter Location Name" 
          value={name} 
          onChange={(e) => setName(e.target.value)}
          style={{ padding: '8px', flex: 2, minWidth: '200px', backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
        />
        <input 
          placeholder="Latitude" 
          value={lat} 
          onChange={(e) => setLat(e.target.value)}
          style={{ padding: '8px', flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
        />
        <input 
          placeholder="Longitude" 
          value={lng} 
          onChange={(e) => setLng(e.target.value)}
          style={{ padding: '8px', flex: 1, backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0', borderRadius: '4px' }}
        />
        <button onClick={addPoint} className="btn-primary">Add + QR</button>
        <button onClick={getQRByName} className="btn-primary" style={{ backgroundColor: '#6c757d' }}>Get QR (Name)</button>
      </div>

      {selectedPoint && (
        <div>
          <QRCodeCard point={selectedPoint} />
          <button onClick={() => downloadQR(selectedPoint.id)} className="btn-primary" style={{ marginTop: '10px' }}>
            Download QR
          </button>
        </div>
      )}
    </div>
  );
}