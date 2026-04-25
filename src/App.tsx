import React, { useState, useEffect } from 'react';
import { SubmitComplaint } from './components/SubmitComplaint';
import { ComplaintTracker } from './components/ComplaintTracker';
import { Dashboard } from './components/Dashboard';
import { MapDashboard } from './components/MapDashboard';
import { Activity, Edit3, LayoutDashboard, ListTodo, LogOut, Menu, Bell, X, Map } from 'lucide-react';
import { seedDataIfEmpty, getNotifications, UserNotification, markNotificationsAsRead } from './lib/db';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Tab = 'submit' | 'tracker' | 'dashboard' | 'map';
type Role = 'user' | 'admin' | null;

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('submit');
  const [role, setRole] = useState<Role>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState<'English' | 'Amharic'>('English');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    seedDataIfEmpty();
    
    const loadNotifications = () => {
      setNotifications(getNotifications());
    };
    
    loadNotifications();
    window.addEventListener('notifications_updated', loadNotifications);
    return () => window.removeEventListener('notifications_updated', loadNotifications);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleOpenNotifications = () => {
    setShowNotifications(true);
    markNotificationsAsRead();
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin123') {
      setRole('admin');
      setActiveTab('tracker');
    } else if (username === 'user' && password === 'user123') {
      setRole('user');
      setActiveTab('submit');
    } else {
      alert("Invalid credentials. Try user/user123 or admin/admin123");
    }
  };

  const handleLogout = () => {
    setRole(null);
    setUsername('');
    setPassword('');
  };

  if (!role) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full">
          <div className="flex items-center gap-3 justify-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Login</h1>
          </div>
          
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 text-sm">
            <strong>Demo Accounts:</strong><br />
            User: <code>user</code> / <code>user123</code><br />
            Admin: <code>admin</code> / <code>admin123</code>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Log In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Locales
  const tTitle = language === 'English' ? "Utility Complaint Agent" : "የአገልግሎት ቅሬታ አቅራቢ";
  const tEthiopia = language === 'English' ? "Ethiopia" : "ኢትዮጵያ";
  const tSubmit = language === 'English' ? "Submit Complaint" : "ቅሬታ ያስገቡ";
  const tTracker = language === 'English' ? "Tracker" : "የቅሬታ መከታተያ";
  const tDashboard = language === 'English' ? "Dashboard" : "ዳሽቦርድ";
  const tLiveMap = language === 'English' ? "Live Map" : "የቀጥታ ካርታ";

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-gray-900">
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-gray-900 truncate">{tTitle} <span className="font-normal text-gray-500 hidden sm:inline">{tEthiopia}</span></h1>
              </div>
              
              <div className="hidden md:flex space-x-1 items-center">
                {role === 'user' && (
                  <TabButton active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} icon={<Edit3 className="w-4 h-4" />} label={tSubmit} />
                )}
                {role === 'admin' && (
                  <>
                    <TabButton active={activeTab === 'tracker'} onClick={() => setActiveTab('tracker')} icon={<ListTodo className="w-4 h-4" />} label={tTracker} />
                    <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />} label={tDashboard} />
                    <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<Map className="w-4 h-4" />} label={tLiveMap} />
                  </>
                )}
                
                <div className="w-px h-6 bg-gray-200 mx-2" />
                
                {role === 'user' && (
                  <div className="relative mr-2">
                    <button 
                      onClick={handleOpenNotifications}
                      className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors relative"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                      )}
                    </button>
                    
                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                          <h3 className="font-bold text-gray-900 text-sm">
                            {language === 'English' ? 'Notifications' : 'ማሳወቂያዎች'}
                          </h3>
                          <button onClick={() => setShowNotifications(false)} className="text-gray-500 hover:text-gray-700">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-500">
                              {language === 'English' ? 'No notifications yet.' : 'ምንም ማሳወቂያ የለም::'}
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {notifications.map(n => (
                                <div key={n.id} className="p-4 hover:bg-gray-50 transition-colors">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                      <Activity className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-800 font-serif whitespace-pre-wrap">{n.message}</p>
                                      <p className="text-xs text-gray-400 mt-2 font-medium">
                                        {format(new Date(n.timestamp), 'MMM d, h:mm a')}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Language Toggle in Header */}
                <div className="flex bg-gray-100 rounded-lg p-1 mr-2">
                  <button
                    className={cn("px-3 py-1 text-sm rounded-md font-medium transition-colors cursor-pointer", language === 'English' ? "bg-white shadow text-gray-900" : "text-gray-500")}
                    onClick={() => setLanguage('English')}
                  >
                    EN
                  </button>
                  <button
                    className={cn("px-3 py-1 text-sm rounded-md font-medium transition-colors cursor-pointer", language === 'Amharic' ? "bg-white shadow text-gray-900" : "text-gray-500")}
                    onClick={() => setLanguage('Amharic')}
                  >
                    አማ
                  </button>
                </div>

                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>
        
        {/* Mobile Tabs & Controls */}
        <div className="md:hidden bg-white border-b border-gray-200 flex flex-col px-2 pb-2">
          <div className="flex overflow-x-auto">
            {role === 'user' && (
              <TabButton active={activeTab === 'submit'} onClick={() => setActiveTab('submit')} icon={<Edit3 className="w-4 h-4" />} label={tSubmit} />
            )}
            {role === 'admin' && (
              <>
                <TabButton active={activeTab === 'tracker'} onClick={() => setActiveTab('tracker')} icon={<ListTodo className="w-4 h-4" />} label={tTracker} />
                <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-4 h-4" />} label={tDashboard} />
                <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={<Map className="w-4 h-4" />} label={tLiveMap} />
              </>
            )}
          </div>
          <div className="flex justify-between items-center px-4 mt-2 mb-2">
             <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
              <button
                className={cn("px-4 py-1.5 text-sm rounded-md font-medium transition-colors", language === 'English' ? "bg-white shadow text-gray-900" : "text-gray-500")}
                onClick={() => setLanguage('English')}
              >
                English
              </button>
              <button
                className={cn("px-4 py-1.5 text-sm rounded-md font-medium transition-colors", language === 'Amharic' ? "bg-white shadow text-gray-900" : "text-gray-500")}
                onClick={() => setLanguage('Amharic')}
              >
                አማርኛ
              </button>
            </div>
            <div className="flex items-center gap-2">
              {role === 'user' && (
                <div className="relative">
                  <button 
                    onClick={handleOpenNotifications}
                    className="p-2 text-gray-500 hover:text-gray-900 rounded-full hover:bg-gray-100 transition-colors relative"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    )}
                  </button>
                </div>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {role === 'user' && activeTab === 'submit' && <SubmitComplaint language={language} onSubmitted={() => {}} />}
          {role === 'admin' && activeTab === 'tracker' && <ComplaintTracker language={language} />}
          {role === 'admin' && activeTab === 'dashboard' && <Dashboard language={language} />}
          {role === 'admin' && activeTab === 'map' && <MapDashboard language={language} />}
        </main>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-3 text-sm font-semibold transition-colors relative whitespace-nowrap",
        active ? "text-blue-600" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-lg"
      )}
    >
      {icon}
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
      )}
    </button>
  );
}
