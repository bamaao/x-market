interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {subtitle && <p className="sub">{subtitle}</p>}
      {children}
    </header>
  );
}
