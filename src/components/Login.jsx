import { useState } from "react";
import { supabase } from "../lib/supabase";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    // Check if profile exists with a valid role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (!profile || !profile.role) {
      await supabase.auth.signOut();
      alert("Access denied. Your account is not registered in the system. Contact admin.");
      return;
    }

    // Save email to profiles table so it's visible in the database
    await supabase
      .from("profiles")
      .update({ email: data.user.email })
      .eq("id", data.user.id);

    onLogin(data.user);
  }

  return (
    <div className="login-container">
      <div className="login-box">

        <div className="login-title">Vehicle Tracker v1.0</div>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button onClick={handleLogin}>Login</button>

      </div>
    </div>
  );
}