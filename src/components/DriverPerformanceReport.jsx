// src/components/DriverPerformanceReport.jsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../App.css";

export default function DriverPerformanceReport({ driver }) {
  const [assignments, setAssignments] = useState([]);
  const [stats, setStats] = useState({ total: 0, visited: 0, fraud: 0, missed: 0 });
  const [loading, setLoading] = useState(true);
  const [dailyReport, setDailyReport] = useState({});

  useEffect(() => {
    async function loadDriverData() {
      setLoading(true);
      
      if (!driver?.vehicle_number) {
        setLoading(false);
        return;
      }
      
      // Get all pickup points for reference
      const { data: allPickupPoints } = await supabase
        .from('pickup_points')
        .select('id, name');
      
      const pickupPointMap = {};
      allPickupPoints?.forEach(p => {
        pickupPointMap[p.id] = p.name;
      });
      
      // Get assigned spots for this vehicle
      const { data: assignmentsData, error: assignError } = await supabase
        .from('vehicle_routes')
        .select(`
          id,
          stop_order,
          pickup_point_id
        `)
        .eq('vehicle_number', driver.vehicle_number)
        .order('stop_order', { ascending: true });
      
      if (assignError) {
        console.error('Error loading assignments:', assignError);
        setLoading(false);
        return;
      }
      
      // Enrich assignments with pickup point names
      const enrichedAssignments = (assignmentsData || []).map(assignment => ({
        id: assignment.id,
        stop_order: assignment.stop_order,
        pickup_point_id: assignment.pickup_point_id,
        name: pickupPointMap[assignment.pickup_point_id] || 'Unknown Location'
      }));
      
      setAssignments(enrichedAssignments);
      
      // Get driver's scan logs
      const { data: logs, error: logsError } = await supabase
        .from('scan_logs')
        .select(`
          *,
          pickup_points (id, name)
        `)
        .eq('user_id', driver.id)
        .order('start_time', { ascending: false });
      
      if (logsError) {
        console.error('Error loading logs:', logsError);
        setLoading(false);
        return;
      }
      
      // Calculate stats
      const validScans = logs?.filter(l => l.reason === "valid") || [];
      const fraudScans = logs?.filter(l => l.reason !== "valid") || [];
      
      const visitedSpotIds = new Set(validScans.map(l => l.pickup_point_id));
      const fraudSpotIds = new Set(fraudScans.map(l => l.pickup_point_id));
      
      const visited = enrichedAssignments.filter(a => visitedSpotIds.has(a.pickup_point_id)).length;
      const fraud = enrichedAssignments.filter(a => fraudSpotIds.has(a.pickup_point_id)).length;
      const missed = enrichedAssignments.length - visited;
      
      setStats({
        total: enrichedAssignments.length,
        visited: visited,
        fraud: fraud,
        missed: missed
      });
      
      // Create daily report
      const uniqueDates = new Set();
      logs?.forEach(log => {
        const date = new Date(log.start_time).toLocaleDateString('en-IN');
        uniqueDates.add(date);
      });
      
      if (uniqueDates.size === 0 && enrichedAssignments.length > 0) {
        const today = new Date().toLocaleDateString('en-IN');
        uniqueDates.add(today);
      }
      
      const dailyData = {};
      
      for (const date of uniqueDates) {
        const scansOnDate = logs?.filter(log => {
          const logDate = new Date(log.start_time).toLocaleDateString('en-IN');
          return logDate === date;
        }) || [];
        
        const scanMap = {};
        scansOnDate.forEach(scan => {
          scanMap[scan.pickup_point_id] = {
            status: scan.reason === 'valid' ? '✅ Valid' : (scan.reason === 'too_far' ? '⚠️ Too Far' : '⚠️ Left Early'),
            time: new Date(scan.start_time).toLocaleTimeString(),
            rawReason: scan.reason
          };
        });
        
        const spotsWithStatus = enrichedAssignments.map(spot => {
          const scan = scanMap[spot.pickup_point_id];
          let status = '❌ Not Visited';
          let statusClass = 'status-missed';
          let scanTime = null;
          
          if (scan) {
            status = scan.status;
            scanTime = scan.time;
            if (scan.rawReason === 'valid') {
              statusClass = 'status-valid';
            } else {
              statusClass = 'status-fraud';
            }
          }
          
          return {
            id: spot.pickup_point_id,
            name: spot.name,
            stop_order: spot.stop_order,
            status: status,
            statusClass: statusClass,
            time: scanTime
          };
        }).sort((a, b) => a.stop_order - b.stop_order);
        
        const extraScans = scansOnDate.filter(scan => 
          !enrichedAssignments.some(a => a.pickup_point_id === scan.pickup_point_id)
        ).map(scan => ({
          id: scan.pickup_point_id,
          name: scan.pickup_points?.name || 'Unknown Location',
          stop_order: 999,
          status: scan.reason === 'valid' ? '✅ Valid' : (scan.reason === 'too_far' ? '⚠️ Too Far' : '⚠️ Left Early'),
          statusClass: scan.reason === 'valid' ? 'status-valid' : 'status-fraud',
          time: new Date(scan.start_time).toLocaleTimeString(),
          isExtra: true
        }));
        
        let allSpots = [...spotsWithStatus, ...extraScans];
        allSpots = allSpots.sort((a, b) => {
          if (a.isExtra && !b.isExtra) return 1;
          if (!a.isExtra && b.isExtra) return -1;
          return a.stop_order - b.stop_order;
        });
        
        dailyData[date] = {
          spots: allSpots,
          summary: {
            total: enrichedAssignments.length,
            visited: spotsWithStatus.filter(s => s.status === '✅ Valid').length,
            fraud: spotsWithStatus.filter(s => s.status.includes('⚠️')).length,
            missed: spotsWithStatus.filter(s => s.status === '❌ Not Visited').length,
            extra: extraScans.length
          }
        };
      }
      
      const sortedDailyData = {};
      Object.keys(dailyData)
        .sort((a, b) => {
          const dateA = new Date(a.split('/').reverse().join('-'));
          const dateB = new Date(b.split('/').reverse().join('-'));
          return dateB - dateA;
        })
        .forEach(key => {
          sortedDailyData[key] = dailyData[key];
        });
      
      setDailyReport(sortedDailyData);
      setLoading(false);
    }
    
    loadDriverData();
  }, [driver?.id, driver?.vehicle_number]);

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading driver data...</div>;
  }

  return (
    <>
      {/* Driver Summary Card */}
      <div className="statsBox" style={{ marginBottom: '20px' }}>
        <h3>{driver.name}</h3>
        <div className="statItem"><strong>🚛 Vehicle Number:</strong> {driver.vehicle_number || 'Not assigned'}</div>
        {driver.vehicle_number && (
          <>
            <div className="statItem"><strong>📊 Overall Performance Summary:</strong></div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
              <div style={{ backgroundColor: '#059669', color: 'white', padding: '10px', borderRadius: '8px', minWidth: '100px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.visited}</div>
                <div>Total Visited</div>
              </div>
              <div style={{ backgroundColor: '#d97706', color: 'white', padding: '10px', borderRadius: '8px', minWidth: '100px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.fraud}</div>
                <div>Total Fraud</div>
              </div>
              <div style={{ backgroundColor: '#dc2626', color: 'white', padding: '10px', borderRadius: '8px', minWidth: '100px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.missed}</div>
                <div>Total Missed</div>
              </div>
              <div style={{ backgroundColor: '#475569', color: 'white', padding: '10px', borderRadius: '8px', minWidth: '100px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{stats.total}</div>
                <div>Total Assigned</div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Date-wise Daily Reports */}
      {driver.vehicle_number && Object.keys(dailyReport).length > 0 && (
        <>
          <h3>📅 Daily Performance Report</h3>
          {Object.entries(dailyReport).map(([date, data]) => (
            <div key={date} className="statsBox" style={{ marginBottom: '20px' }}>
              {/* Date Header with Summary */}
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '10px',
                marginBottom: '15px',
                paddingBottom: '10px',
                borderBottom: '1px solid #334155'
              }}>
                <h3 style={{ margin: 0 }}>📆 {date}</h3>
                <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
                  <span className="statItem" style={{ color: '#34d399' }}>✅ Visited: {data.summary.visited}</span>
                  <span className="statItem" style={{ color: '#fbbf24' }}>⚠️ Fraud: {data.summary.fraud}</span>
                  <span className="statItem" style={{ color: '#f87171' }}>❌ Missed: {data.summary.missed}</span>
                  <span className="statItem">📌 Total: {data.summary.total}</span>
                  {data.summary.extra > 0 && <span className="statItem" style={{ color: '#fb923c' }}>➕ Extra: {data.summary.extra}</span>}
                </div>
              </div>
              
              {/* Spots Table for this date */}
              <div className="tableContainer">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px', textAlign: 'left', width: '50px' }}>#</th>
                      <th style={{ padding: '10px', textAlign: 'left' }}>Pickup Point</th>
                      <th style={{ padding: '10px', textAlign: 'center', width: '120px' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'center', width: '100px' }}>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.spots.map((spot, idx) => (
                      <tr key={spot.id} style={{ 
                        borderBottom: '1px solid #334155',
                        backgroundColor: spot.isExtra ? '#1e293b' : 'transparent'
                      }}>
                        <td style={{ padding: '10px' }}>{spot.isExtra ? '🔗' : (idx + 1)}</td>
                        <td style={{ padding: '10px' }}>
                          {spot.name}
                          {spot.isExtra && <span style={{ fontSize: '11px', color: '#fb923c', marginLeft: '8px' }}>(Unauthorized)</span>}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center' }}>
                          <span className={spot.statusClass}>
                            {spot.status}
                          </span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'center', fontSize: '12px' }}>
                          {spot.time || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
      
      {/* No data messages */}
      {!driver.vehicle_number && (
        <div className="statsBox" style={{ backgroundColor: '#7f1d1d', color: '#fca5a5' }}>
          ⚠️ This driver has not entered their vehicle number yet. Ask them to login and enter vehicle number.
        </div>
      )}
      
      {driver.vehicle_number && assignments.length === 0 && (
        <div className="statsBox" style={{ backgroundColor: '#78350f', color: '#fcd34d' }}>
          ⚠️ No pickup points assigned to vehicle {driver.vehicle_number}. Please assign spots first.
        </div>
      )}

      {driver.vehicle_number && assignments.length > 0 && Object.keys(dailyReport).length === 0 && (
        <div className="statsBox" style={{ backgroundColor: '#1e3a5f', color: '#93c5fd' }}>
          ℹ️ No scans recorded yet for this driver. Daily report will appear after first scan.
        </div>
      )}
    </>
  );
}