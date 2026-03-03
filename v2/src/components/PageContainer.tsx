import { cn } from "@/lib/utils";

export default function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[1600px] mx-auto px-8 lg:px-16 xl:px-24",
        className
      )}
    >
      {children}
    </div>
  );
}
