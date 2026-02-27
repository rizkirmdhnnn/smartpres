type AlertProps = {
  type: "success" | "error";
  children: React.ReactNode;
  className?: string;
};

const STYLES = {
  success:
    "border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200",
} as const;

export function Alert({ type, children, className = "" }: AlertProps) {
  return (
    <div className={`rounded-xl border p-4 ${STYLES[type]} ${className}`}>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}
