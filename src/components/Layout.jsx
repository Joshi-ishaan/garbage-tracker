// components/Layout.jsx
export default function Layout({ children }) {
  return (
    <div className="flex h-screen">
      
      {/* Sidebar */}
      <div className="w-56 bg-gray-900 text-white p-4">
        <h1 className="text-lg font-semibold mb-6">WasteTrack</h1>

        <nav className="space-y-3 text-sm">
          <a href="/dashboard">Dashboard</a>
          <a href="/scanner">Scanner</a>
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 bg-gray-50 overflow-y-auto">
        {children}
      </div>

    </div>
  );
}