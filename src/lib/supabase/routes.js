// src/lib/supabase/routes.js
import supabase from '../supabase';

export const routeService = {
  // Create new route for vehicle
  async createRoute(vehicleId, routeName, stops = []) {
    // Step 1: Create route
    const { data: route, error: routeError } = await supabase
      .from('vehicle_routes')
      .insert([{ 
        vehicle_id: vehicleId, 
        route_name: routeName 
      }])
      .select()
      .single();
    
    if (routeError) throw routeError;

    // Step 2: Add stops if any
    if (stops.length > 0) {
      const routeStops = stops.map((stop, index) => ({
        route_id: route.id,
        pickup_point_id: stop.id,
        stop_order: index + 1,
        scheduled_dwell_time: stop.dwellTime || 60
      }));

      const { error: stopsError } = await supabase
        .from('route_stops')
        .insert(routeStops);
      
      if (stopsError) throw stopsError;
    }
    
    return route;
  },

  // Get all routes for a vehicle
  async getVehicleRoutes(vehicleId) {
    const { data, error } = await supabase
      .from('vehicle_routes')
      .select(`
        *,
        route_stops (
          *,
          pickup_points (*)
        )
      `)
      .eq('vehicle_id', vehicleId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Add stop to existing route
  async addStopToRoute(routeId, pickupPointId, stopOrder, dwellTime = 60) {
    const { data, error } = await supabase
      .from('route_stops')
      .insert([{
        route_id: routeId,
        pickup_point_id: pickupPointId,
        stop_order: stopOrder,
        scheduled_dwell_time: dwellTime
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Remove stop from route
  async removeStopFromRoute(routeStopId) {
    const { error } = await supabase
      .from('route_stops')
      .delete()
      .eq('id', routeStopId);
    
    if (error) throw error;
    return true;
  },

  // Reorder stops in route
  async reorderStops(routeId, stopsWithNewOrder) {
    // Update each stop's order
    const updates = stopsWithNewOrder.map(stop => 
      supabase
        .from('route_stops')
        .update({ stop_order: stop.order })
        .eq('id', stop.id)
    );
    
    await Promise.all(updates);
    return true;
  }
};