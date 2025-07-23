import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  BarChart3,
  Users,
  Settings,
  TrendingUp,
  Workflow,
  Menu,
  X,
  Bell,
  LogOut,
  Home
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navigationItems = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Campaigns', href: '/campaigns', icon: BarChart3 },
    { name: 'Leads', href: '/leads', icon: Users },
    { name: 'Drip Campaigns', href: '/drip-campaigns', icon: Workflow },
    { name: 'Analytics', href: '/analytics', icon: TrendingUp },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="app">
      <div className="dashboard-layout">
        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div 
            className="sidebar-overlay"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <nav className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
          {/* Sidebar Header */}
          <div className="sidebar-header">
            <div className="logo">
              <div className="logo-icon">🔥</div>
              <span className="logo-text">LeadFuego</span>
            </div>
            <button
              className="sidebar-close"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <div className="sidebar-nav">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `nav-item ${isActive ? 'nav-item-active' : ''}`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={20} />
                  {item.name}
                </NavLink>
              );
            })}
          </div>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <div className="user-info">
              <div className="user-avatar">
                {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <div className="user-name">{user?.firstName || 'User'}</div>
                <div className="user-tier">{user?.subscriptionTier || 'free'}</div>
              </div>
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </nav>

        {/* Main Content */}
        <div className="main-content">
          {/* Top Header */}
          <header className="top-header">
            <div className="header-left">
              <button
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu size={20} />
              </button>
            </div>

            <div className="header-right">
              {/* Notifications */}
              <button className="notification-btn">
                <Bell size={20} />
                <span className="notification-badge">3</span>
              </button>

              {/* User Menu */}
              <div className="header-user">
                <div className="user-avatar">
                  {user?.firstName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="page-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}