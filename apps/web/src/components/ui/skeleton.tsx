import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-card-hover animate-shimmer",
        "bg-[length:200%_100%] bg-gradient-to-r from-card-hover via-border/30 to-card-hover",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
