"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Palette, ShoppingBag } from "lucide-react";
import type { ActivityItem } from "@/types/dashboard";

interface ActivityTableProps {
  activity: ActivityItem[] | undefined;
  loading: boolean;
}

function statusVariant(status: string) {
  switch (status) {
    case "confirmed":
    case "active":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "sold":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityTable({ activity, loading }: ActivityTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!activity?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.type === "listing" ? (
                      <ShoppingBag className="h-4 w-4 text-success" />
                    ) : (
                      <Palette className="h-4 w-4 text-accent" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/asset/${item.mintAddress}`}
                      className="text-foreground hover:text-accent transition-colors"
                    >
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted text-xs">
                    {formatDate(item.timestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </motion.div>
  );
}
