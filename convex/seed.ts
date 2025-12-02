import { mutation } from "./_generated/server";

// Seed initial data if database is empty
export const seedInitialData = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if we already have data
    const existingTokens = await ctx.db.query("tokens").first();
    if (existingTokens) {
      return { message: "Database already seeded" };
    }
    
    // Seed tokens
    const tokens = [
      { name: "primary", value: "#3b82f6", type: "color" as const },
      { name: "surface", value: "#18181b", type: "color" as const },
      { name: "background", value: "#ffffff", type: "color" as const },
      { name: "text-primary", value: "#09090b", type: "color" as const },
      { name: "text-muted", value: "#71717a", type: "color" as const },
      { name: "accent", value: "#8b5cf6", type: "color" as const },
      { name: "border", value: "#e4e4e7", type: "color" as const },
      { name: "text-base", value: "16px", type: "typography" as const },
      { name: "text-sm", value: "14px", type: "typography" as const },
      { name: "text-lg", value: "18px", type: "typography" as const },
      { name: "text-xl", value: "20px", type: "typography" as const },
      { name: "spacing-1", value: "0.25rem", type: "spacing" as const },
      { name: "spacing-2", value: "0.5rem", type: "spacing" as const },
      { name: "spacing-4", value: "1rem", type: "spacing" as const },
      { name: "spacing-6", value: "1.5rem", type: "spacing" as const },
      { name: "spacing-8", value: "2rem", type: "spacing" as const },
      { name: "radius-sm", value: "0.25rem", type: "radius" as const },
      { name: "radius-md", value: "0.375rem", type: "radius" as const },
      { name: "radius-lg", value: "0.5rem", type: "radius" as const },
      { name: "radius-xl", value: "0.75rem", type: "radius" as const },
      { name: "shadow-sm", value: "0 1px 2px 0 rgb(0 0 0 / 0.05)", type: "shadow" as const },
      { name: "shadow-md", value: "0 4px 6px -1px rgb(0 0 0 / 0.1)", type: "shadow" as const },
    ];
    
    for (const token of tokens) {
      await ctx.db.insert("tokens", token);
    }
    
    // Seed components
    const components = [
      {
        name: "Button",
        status: "stable" as const,
        version: "1.2.0",
        code: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick
}) => {
  const baseStyles = "inline-flex items-center justify-center font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  const variants = {
    primary: "bg-blue-500 text-white hover:bg-blue-600 focus:ring-blue-500",
    secondary: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 focus:ring-zinc-500",
    ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 focus:ring-zinc-500"
  };
  
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base"
  };
  
  return (
    <button
      className={\`\${baseStyles} \${variants[variant]} \${sizes[size]} \${disabled ? 'opacity-50 cursor-not-allowed' : ''}\`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};`,
        docs: `# Button

A versatile button component with multiple variants and sizes.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | - | Button content |
| variant | 'primary' \\| 'secondary' \\| 'ghost' | 'primary' | Visual style |
| size | 'sm' \\| 'md' \\| 'lg' | 'md' | Button size |
| disabled | boolean | false | Disabled state |
| onClick | () => void | - | Click handler |

## Usage

\`\`\`tsx
<Button variant="primary" size="md">
  Click me
</Button>
\`\`\`
`
      },
      {
        name: "Input",
        status: "review" as const,
        version: "0.9.0",
        code: `import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-zinc-700">
          {label}
        </label>
      )}
      <input
        className={\`w-full px-3 py-2 border rounded-md text-sm transition-colors
          \${error 
            ? 'border-red-500 focus:ring-red-500' 
            : 'border-zinc-300 focus:ring-blue-500'
          }
          focus:outline-none focus:ring-2 focus:ring-offset-1
          disabled:bg-zinc-50 disabled:cursor-not-allowed
          \${className}\`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      {helperText && !error && <p className="text-xs text-zinc-500">{helperText}</p>}
    </div>
  );
};`,
        docs: `# Input

A form input component with label and error state support.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| label | string | - | Input label |
| error | string | - | Error message |
| helperText | string | - | Helper text |
| ...props | InputHTMLAttributes | - | Native input props |

## Usage

\`\`\`tsx
<Input 
  label="Email"
  placeholder="Enter your email"
  error={errors.email}
/>
\`\`\`
`
      },
      {
        name: "Card",
        status: "draft" as const,
        version: "0.1.0",
        code: `import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md'
}) => {
  const paddingSizes = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };
  
  return (
    <div className={\`bg-white border border-zinc-200 rounded-lg shadow-sm \${paddingSizes[padding]} \${className}\`}>
      {children}
    </div>
  );
};`,
        docs: `# Card

A container component for grouping related content.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| children | ReactNode | - | Card content |
| padding | 'none' \\| 'sm' \\| 'md' \\| 'lg' | 'md' | Internal padding |
| className | string | '' | Additional classes |
`
      }
    ];
    
    for (const component of components) {
      await ctx.db.insert("components", component);
    }
    
    // Log seeding activity
    await ctx.db.insert("activity", {
      user: "System",
      action: "create",
      target: "Initial seed data created",
      targetType: "system",
    });
    
    return { 
      message: "Database seeded successfully",
      tokens: tokens.length,
      components: components.length
    };
  },
});

