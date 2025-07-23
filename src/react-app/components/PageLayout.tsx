import React from 'react';
import { useAuth } from '../contexts/AuthContext';

interface PageLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageLayout({ 
  children, 
  title, 
  subtitle, 
  actions, 
  className = "" 
}: PageLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-primary">LeadFuego</h1>
              <nav className="hidden md:flex space-x-6">
                <NavLink href="/">Dashboard</NavLink>
                <NavLink href="/campaigns">Campaigns</NavLink>
                <NavLink href="/drip-campaigns">Drip Campaigns</NavLink>
                <NavLink href="/leads">Leads</NavLink>
                <NavLink href="/analytics">Analytics</NavLink>
                <NavLink href="/settings">Settings</NavLink>
              </nav>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-foreground text-sm">
                {user?.firstName || user?.email}
              </span>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main className={`max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 ${className}`}>
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-foreground">{title}</h2>
              {subtitle && (
                <p className="mt-2 text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center space-x-3">
                {actions}
              </div>
            )}
          </div>
        </div>

        {/* Page Body */}
        {children}
      </main>
    </div>
  );
}

// Navigation link component
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const isActive = window.location.pathname === href;
  
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState(null, '', href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
  
  return (
    <a
      href={href}
      onClick={handleClick}
      className={`text-sm font-medium transition-colors hover:text-primary cursor-pointer ${
        isActive 
          ? 'text-primary border-b-2 border-primary pb-4' 
          : 'text-muted-foreground'
      }`}
    >
      {children}
    </a>
  );
}

// Card wrapper for consistent styling
export function Card({ 
  children, 
  className = "",
  title,
  description 
}: { 
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      {(title || description) && (
        <div className="px-6 py-4 border-b border-border">
          {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}

// Empty state component
export function EmptyState({ 
  title, 
  description, 
  action,
  icon 
}: { 
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      {icon && (
        <div className="mx-auto w-12 h-12 text-muted-foreground mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-muted-foreground mt-2 max-w-sm mx-auto">{description}</p>
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}