type AppIconProps = {
  name:
    | 'logo'
    | 'calendar'
    | 'room'
    | 'external'
    | 'huddle'
    | 'user'
    | 'settings'
    | 'users'
    | 'arrow-left';
  className?: string;
};

function AppIcon({ name, className }: AppIconProps) {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  };

  if (name === 'logo') {
    return (
      <svg {...commonProps}>
        <path d="M5 7.5c0-1.4 1.1-2.5 2.5-2.5H17" />
        <path d="M7 12h10" />
        <path d="M7 16.5H14" />
        <path d="M17 4v16" />
      </svg>
    );
  }

  if (name === 'calendar') {
    return (
      <svg {...commonProps}>
        <rect x="3.5" y="5.5" width="17" height="15" rx="3" />
        <path d="M7.5 3.5v4" />
        <path d="M16.5 3.5v4" />
        <path d="M3.5 9.5h17" />
      </svg>
    );
  }

  if (name === 'room') {
    return (
      <svg {...commonProps}>
        <rect x="4.5" y="5.5" width="15" height="13" rx="3" />
        <path d="M8 18.5v2" />
        <path d="M16 18.5v2" />
      </svg>
    );
  }

  if (name === 'external') {
    return (
      <svg {...commonProps}>
        <path d="M10.5 6.5H7a2.5 2.5 0 0 0-2.5 2.5V17A2.5 2.5 0 0 0 7 19.5h8A2.5 2.5 0 0 0 17.5 17v-3.5" />
        <path d="M13 4.5h6.5V11" />
        <path d="M19 5l-8.5 8.5" />
      </svg>
    );
  }

  if (name === 'huddle') {
    return (
      <svg {...commonProps}>
        <path d="M8.5 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M15.5 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M4.5 18c.8-2 2.3-3 4-3s3.2 1 4 3" />
        <path d="M12.5 18c.5-1.4 1.6-2.2 3-2.2 1.2 0 2.2.6 3 2.2" />
      </svg>
    );
  }

  if (name === 'user') {
    return (
      <svg {...commonProps}>
        <path d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
        <path d="M5 19c1.4-2.7 3.8-4 7-4s5.6 1.3 7 4" />
      </svg>
    );
  }

  if (name === 'settings') {
    return (
      <svg {...commonProps}>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7.7 7.7 0 0 0-1.7-1l-.3-2.6h-4l-.3 2.6c-.6.2-1.2.5-1.7 1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.3 2.6h4l.3-2.6c.6-.2 1.2-.5 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z" />
      </svg>
    );
  }

  if (name === 'users') {
    return (
      <svg {...commonProps}>
        <path d="M9 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
        <path d="M16.5 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path d="M4.5 18c.9-2.2 2.5-3.3 4.5-3.3s3.6 1.1 4.5 3.3" />
        <path d="M13.5 18c.6-1.5 1.8-2.4 3.4-2.4 1.2 0 2.2.5 3.1 1.7" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <path d="M6 12h12" />
      <path d="M12 6l-6 6 6 6" />
    </svg>
  );
}

export default AppIcon;
