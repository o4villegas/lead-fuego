
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

export function LoadingSpinner({ size = 'md', className = '', text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="text-center">
        <div 
          className={`${sizeClasses[size]} border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto`}
          role="status"
          aria-label="Loading"
        />
        {text && (
          <p className="mt-2 text-sm text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
}

// Full page loading component
export function PageLoader({ text = "Loading..." }: { text?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

// Inline loading for buttons
export function ButtonSpinner({ className = "" }: { className?: string }) {
  return (
    <div className={`w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

// Loading overlay for sections
export function LoadingOverlay({ text, className = "" }: { text?: string; className?: string }) {
  return (
    <div className={`absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-10 rounded-lg ${className}`}>
      <LoadingSpinner text={text} />
    </div>
  );
}