// src/components/VehicleNumberEntry.jsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function VehicleNumberEntry({ user, onVehicleVerified }) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const cleanedNumber = vehicleNumber.toUpperCase().trim();

    // Check if vehicle exists in database
    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('registration_number, is_active')
      .eq('registration_number', cleanedNumber)
      .single();

    if (vehicleError || !vehicle) {
      setError('❌ This vehicle number is not registered. Please contact admin.');
      setLoading(false);
      return;
    }

    if (!vehicle.is_active) {
      setError('❌ This vehicle is inactive. Please contact admin.');
      setLoading(false);
      return;
    }

    // Save vehicle number to driver's profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ vehicle_number: cleanedNumber })
      .eq('id', user.id);

    if (updateError) {
      console.error('Update error:', updateError);
      setError('Error saving vehicle info. Please try again.');
      setLoading(false);
      return;
    }

    // Fetch assigned spots for this vehicle
    const { data: assignedSpots, error: spotsError } = await supabase
      .from('vehicle_routes')
      .select(`
        pickup_points (
          id, 
          name, 
          latitude, 
          longitude
        )
      `)
      .eq('vehicle_number', cleanedNumber)
      .order('stop_order', { ascending: true });

    if (spotsError) {
      console.error('Error fetching spots:', spotsError);
    }

    onVehicleVerified({
      vehicleNumber: cleanedNumber,
      assignedSpots: assignedSpots?.map(item => item.pickup_points) || []
    });
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
        width: '90%',
        maxWidth: '450px',
        textAlign: 'center'
      }}>
        <h2 style={{ marginBottom: '10px', color: '#333' }}>🚛 Vehicle Verification</h2>
        <p style={{ color: '#666', marginBottom: '25px' }}>Please enter your vehicle number to continue</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="e.g., MH12AB1234"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '18px',
              border: '2px solid #ddd',
              borderRadius: '8px',
              marginBottom: '15px',
              textTransform: 'uppercase',
              textAlign: 'center',
              letterSpacing: '2px'
            }}
            autoFocus
            required
          />
          
          {error && (
            <div style={{
              background: '#fee',
              color: '#c33',
              padding: '10px',
              borderRadius: '6px',
              marginBottom: '15px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'transform 0.2s'
            }}
          >
            {loading ? 'Verifying...' : 'Continue to Scanner'}
          </button>
        </form>
        
        <p style={{ fontSize: '12px', color: '#999', marginTop: '20px' }}>
          ⚠️ Contact admin if your vehicle number is not recognized
        </p>
      </div>
    </div>
  );
}